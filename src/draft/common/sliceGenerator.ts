import { DraftSettings, FactionId, Map, SystemId, SystemIds } from "~/types";
import {
  groupSystemsByTier,
  poolFitsWormholesPerSlice,
} from "../helpers/sliceGeneration";
import { systemData } from "~/data/systemData";
import {
  ChoosableTier,
  DraftConfig,
  SliceGenerationConfig,
  TieredSlice,
  TieredSystems,
} from "../types";
import { shuffle } from "../helpers/randomization";
import { mapStringOrder } from "~/data/mapStringOrder";
import { generateEmptyMap } from "~/utils/map";
import { draftConfig } from "../draftConfig";
import { systemIdsInSlice, systemIdsToSlices } from "~/utils/slice";
import { calculateMapStats } from "~/utils/mapStats";
import { getTileCount } from "~/utils/hexCoordinates";
import { getAllNeighbors } from "~/utils/hexDistance";
import {
  ANOMALY_RULES,
  areSystemsCompatibleAdjacent,
} from "~/mapgen/utils/mapLegality";
import { getSystemPool } from "~/utils/system";
import { miltySystemTiers } from "~/data/miltyTileTiers";
import {
  recordSliceSearchFailure,
  searchSlices,
  SLICE_SEARCH_TIME_LIMIT_MS,
  SliceLimits,
} from "./sliceSearch";

export type CoreGenerateSlicesArgs = {
  sliceCount: number;
  /** TTPG slice shape (home first), for keeping anomalies apart. */
  sliceShape: string[];
  systemTiers: Record<string, ChoosableTier>;
  availableSystems: SystemId[];
  config: SliceGenerationConfig;
  mecatolPath: number[] | undefined;
  /** Slice positions whose value is shared (equidistants). */
  equidistantIndices: number[];
  /** Slice position checked by "safe center tile". */
  centerTile: number;
  /** What the slices must meet (value, influence/resources, wormholes, ...). */
  limits: SliceLimits;

  /** Tier pattern of a slice; called again when the search restarts. */
  getSliceTiers: (sliceIdx: number) => TieredSlice;
  /** A tile fixed at a slice position (minor factions), per slice. */
  pinned?: ({ index: number; systemId: SystemId } | undefined)[];

  /** The format's own checks, run on the final slices as a safety net. */
  validateSystems: (
    systems: TieredSystems,
    config: SliceGenerationConfig,
  ) => boolean;
  validateSlice: (slice: SystemIds, config: SliceGenerationConfig) => boolean;
};

export function coreRerollSlice(
  settings: DraftSettings,
  map: Map,
  slices: SystemIds[],
  sliceToRerollIdx: number,
  minorFactionPool?: FactionId[],
): { slice: SystemIds; valid: boolean } | undefined {
  const config = draftConfig[settings.type];

  // Collect systems that are currently in use (in the map and other slices)
  const systemsInMap = map
    .filter((tile) => tile.type === "SYSTEM")
    .map((tile) => (tile as { systemId: SystemId }).systemId);

  const systemsInOtherSlices = slices
    .filter((_, idx) => idx !== sliceToRerollIdx)
    .flat();

  // Get all system IDs from the original systems pool that aren't in use
  const allSystems = getSystemPool(settings.tileGameSets);
  const availableSystems = allSystems.filter(
    (id) => !systemsInMap.includes(id) && !systemsInOtherSlices.includes(id),
  );

  const maxAttempts = 1000;
  function attemptReroll(
    currentAttempt: number,
  ): { slice: SystemIds; valid: boolean } | undefined {
    if (currentAttempt > maxAttempts) return undefined;

    const newSlices = config.generateSlices(1, availableSystems, {
      ...settings.sliceGenerationConfig,
      numAlphas: 0,
      numBetas: 0,
      minLegendaries: 0,
      minorFactionPool,
    });
    if (!newSlices || newSlices.length === 0) return undefined;

    const newSlice = newSlices[0];
    const updatedSlices = [...slices];
    updatedSlices[sliceToRerollIdx] = newSlice;

    const isMapValid =
      mapProblems(config, settings, map, updatedSlices).length === 0;
    if (!isMapValid) return attemptReroll(currentAttempt + 1);
    return {
      slice: newSlice,
      valid: isMapValid,
    };
  }

  return attemptReroll(0);
}

export const coreRerollMap = (settings: DraftSettings, slices: SystemIds[]) => {
  const config = draftConfig[settings.type];
  if (settings.minorFactionsMode?.mode === "random") {
    const generated = config.generateMap?.(
      { ...settings, presetSlices: slices },
      getSystemPool(settings.tileGameSets),
    );
    return generated && { ...generated, valid: true };
  }

  return coreGenerateMap(
    // A map reroll keeps its best attempt (the builder warns when invalid).
    {
      ...settings,
      sliceGenerationConfig: {
        ...settings.sliceGenerationConfig,
        allowInvalidMap: true,
      },
    },
    getSystemPool(settings.tileGameSets),
    0,
    // do not generate slices, just re-use the existing slices
    () => slices,
  );
};

/** Map attempts (each with new slices) before giving up, within the time limit. */
const MAX_MAP_ATTEMPTS = 1000;

/**
 * Generate a map and slices using a core function. The free map tiles
 * (Milty EQ's equidistants) are filled at random and checked; that is retried
 * with new slices. Returns undefined when no slices meet the settings, or no
 * map passes the checks within MAX_MAP_ATTEMPTS / SLICE_SEARCH_TIME_LIMIT_MS
 * (the reason is in takeSliceSearchFailure()). With allowInvalidMap, the
 * attempt with the fewest map problems is returned instead, valid: false.
 */
export function coreGenerateMap(
  settings: DraftSettings,
  systemPool: SystemId[],
  attempts: number = 0,
  generateSlices: (
    sliceCount: number,
    availableSystems: SystemId[],
    config?: SliceGenerationConfig,
    sliceShape?: string[],
    minorFactionPool?: FactionId[],
  ) => SystemIds[] | undefined,
  minorFactionPool?: FactionId[],
) {
  const config = draftConfig[settings.type];
  const numMapTiles = config.modifiableMapTiles.length;
  const deadline = performance.now() + SLICE_SEARCH_TIME_LIMIT_MS;
  let best: { map: Map; slices: SystemIds[]; problems: string[] } | undefined;

  for (; ; attempts++) {
    const map = generateEmptyMap(config);
    const slices = generateSlices(settings.numSlices, systemPool, {
      ...settings.sliceGenerationConfig,
      minorFactionPool,
    });

    if (!slices) return undefined;
    const usedSystemIds = slices.flat(1);
    const remainingSystemIds = shuffle(
      systemPool.filter((id) => !usedSystemIds.includes(id)),
    );
    const mapSystemIds = shuffle(remainingSystemIds).slice(0, numMapTiles);

    // fill map with chosen systems (as far as the pool goes)
    const shortOfTiles = mapSystemIds.length < numMapTiles;
    config.modifiableMapTiles.forEach((idx) => {
      const systemId = mapSystemIds.pop();
      if (!systemId) return;
      map[idx] = {
        idx: idx,
        position: mapStringOrder[idx],
        type: "SYSTEM",
        systemId,
      };
    });

    const problems = shortOfTiles
      ? [
          `not enough tiles left for the map (needs ${numMapTiles}, ${remainingSystemIds.length} left)`,
        ]
      : mapProblems(config, settings, map, slices);
    if (problems.length === 0) return { map, slices, valid: true };
    if (!best || problems.length < best.problems.length) {
      best = { map, slices, problems };
    }

    // Retrying can't add tiles to the pool.
    if (
      shortOfTiles ||
      attempts >= MAX_MAP_ATTEMPTS ||
      performance.now() >= deadline
    ) {
      if (settings.sliceGenerationConfig?.allowInvalidMap) {
        return { map: best.map, slices: best.slices, valid: false };
      }
      recordSliceSearchFailure({
        kind: "map",
        sliceCount: settings.numSlices,
        limits: {},
        problems: best.problems,
      });
      return undefined;
    }
  }
}

/** What a map (with its slices) gets wrong; empty when it passes. */
const mapProblems = (
  config: DraftConfig,
  settings: DraftSettings,
  map: Map,
  slices: SystemIds[],
): string[] => {
  // For validating 'globals', we grab the N richest slices.
  const slicesToValidate = systemIdsToSlices(
    config,
    slices,
    settings.sliceGenerationConfig?.sliceValueModifiers,
  )
    .slice(0, config.numPlayers)
    .map((s) => systemIdsInSlice(s));

  const stats = calculateMapStats(slicesToValidate, map);

  const redTilesRequired = Math.floor(
    numTilesAvailable(config) * RED_TILE_RATIO,
  );

  // Use maxLegendaries from config if set, otherwise use default of 3
  const maxLegendaries = settings.sliceGenerationConfig?.maxLegendaries ?? 3;

  const chosenMapLocations = map.reduce(
    (acc, tile) => {
      if (tile.type === "SYSTEM") acc[tile.idx] = tile.systemId;
      return acc;
    },
    {} as Record<number, SystemId>,
  );

  const problems: string[] = [];
  if (stats.redTiles < redTilesRequired) {
    problems.push(
      `the map is short of red tiles (needs ${redTilesRequired}, got ${stats.redTiles})`,
    );
  }
  if (stats.totalLegendary > maxLegendaries) {
    problems.push(
      `too many legendary planets (at most ${maxLegendaries}, got ${stats.totalLegendary})`,
    );
  }
  if (hasAdjacentAnomalies(chosenMapLocations)) {
    problems.push("anomalies next to each other on the map");
  }
  return problems;
};

/**
 * Generates slices for Milty-style formats with the slice search
 * (see sliceSearch.ts). Returns undefined when no set meets the settings
 * within the time limit, unless config.allowClosestSlices asks for the
 * closest set instead; either way the failure is recorded for the caller.
 */
export function coreGenerateSlices({
  mecatolPath,
  centerTile,
  availableSystems,
  systemTiers,
  sliceShape,
  sliceCount,
  config,
  equidistantIndices,
  limits,
  getSliceTiers,
  pinned,
  validateSystems,
  validateSlice,
}: CoreGenerateSlicesArgs): SystemIds[] | undefined {
  const pinnedIds = new Set(pinned?.flatMap((pin) => (pin ? [pin.systemId] : [])));

  const result = searchSlices({
    sliceCount,
    pool: availableSystems.filter((id) => !pinnedIds.has(id)),
    tierOf: (id) => systemTiers[id],
    rollPatterns: () =>
      Array.from({ length: sliceCount }, (_, i) =>
        getSliceTiers(i).filter(
          (tier): tier is ChoosableTier => tier !== "resolved",
        ),
      ),
    pinned,
    shape: sliceShape,
    equidistantIndices,
    mecatolPath: mecatolPath ?? [],
    centerTile,
    isHighQuality: (id) => miltySystemTiers[id] === "high",
    limits,
    validateSlice: (slice) => validateSlice(slice, config),
    validateSet: (slices) => {
      const chosen = slices.flat().filter((id) => !pinnedIds.has(id));
      const grouped = groupSystemsByTier(chosen, systemTiers);
      const tiered: TieredSystems = {
        high: grouped.high ?? [],
        med: grouped.med ?? [],
        low: grouped.low ?? [],
        red: grouped.red ?? [],
      };
      return (
        validateSystems(tiered, config) &&
        poolFitsWormholesPerSlice(
          chosen.map((id) => systemData[id]),
          sliceCount,
          config.wormholesPerSlice,
        )
      );
    },
  });

  if (result.valid) return result.slices;
  recordSliceSearchFailure(result.failure);
  return config.allowClosestSlices ? result.slices : undefined;
}

// Regular 6p map has 36 tiles, 11 of which are red.
// This ratio is used to calculate the number of red tiles that should be required for a given map size.
export const RED_TILE_RATIO = 11 / 36;

export const numTilesAvailable = (config: DraftConfig) => {
  // subtract 1 because the center tile is not editable (mecatol rex)
  const rawTotal = getTileCount(config.mapSize ?? 3) - 1;
  return (
    rawTotal -
    config.closedMapTiles.length -
    // only subtract preset tiles that are hyperlanes
    // as those aren't 'real' tiles.
    Object.values(config.presetTiles).filter(
      (tile) => systemData[tile.systemId].hyperlanes !== undefined,
    ).length
  );
};

/**
 * Check if there are any adjacent anomalies in the map
 */
export function hasAdjacentAnomalies(
  chosenMapLocations: Record<number, SystemId>,
): boolean {
  return Object.entries(chosenMapLocations).some(([posStr, systemId]) =>
    getAdjacentPositions(Number(posStr)).some((adjPos) => {
      const adjSystemId = chosenMapLocations[adjPos];
      return (
        adjSystemId &&
        !areSystemsCompatibleAdjacent(systemId, adjSystemId, ANOMALY_RULES)
      );
    }),
  );
}

const STANDARD_GRID = mapStringOrder.map((position) => ({ position }));

/**
 * Get positions adjacent to the given map string index on the standard grid
 */
export function getAdjacentPositions(position: number): number[] {
  return getAllNeighbors(STANDARD_GRID, position);
}
