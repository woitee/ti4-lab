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

    const isMapValid = validateMap(config, settings, map, updatedSlices);
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
    settings,
    getSystemPool(settings.tileGameSets),
    0,
    // do not generate slices, just re-use the existing slices
    () => slices,
  );
};

/**
 * Generate a map and slices using a core function. Returns undefined when no
 * slices meet the settings (the reason is in takeSliceSearchFailure()).
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

    // fill map with chosen systems
    config.modifiableMapTiles.forEach((idx) => {
      map[idx] = {
        idx: idx,
        position: mapStringOrder[idx],
        type: "SYSTEM",
        systemId: mapSystemIds.pop()!,
      };
    });

    // if we have gone past max attempts, return the map regardless of validation
    if (attempts > 1000) return { map, slices, valid: false };
    if (validateMap(config, settings, map, slices)) {
      return { map, slices, valid: true };
    }
  }
}

const validateMap = (
  config: DraftConfig,
  settings: DraftSettings,
  map: Map,
  slices: SystemIds[],
) => {
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

  return (
    stats.redTiles >= redTilesRequired &&
    stats.totalLegendary <= maxLegendaries &&
    !hasAdjacentAnomalies(chosenMapLocations)
  );
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
