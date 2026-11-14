import { SystemId, SystemIds, FactionId } from "~/types";
import { SLICE_SHAPES } from "../sliceShapes";
import { miltySystemTiers, minorFactionTiers } from "~/data/miltyTileTiers";
import { ChoosableTier, SliceGenerationConfig, TieredSystems } from "../types";
import {
  filterTieredSystems,
  isAlpha,
  isBeta,
  isLegendary,
  planetCountInRange,
  planetTraitsInLimit,
  wormholePositionsOk,
  wormholesPerSliceOk,
} from "../helpers/sliceGeneration";
import { factionSystems, systemData } from "~/data/systemData";
import { optimalStatsForSystems } from "~/utils/map";
import { buildSliceValueConfig, calculateSliceValue } from "~/stats";
import { coreGenerateSlices } from "../common/sliceGenerator";
import { limitsFromConfig } from "../common/sliceSearch";
import { shuffle } from "../helpers/randomization";

const SLICE_TIERS: ChoosableTier[] = ["high", "med", "low", "red", "red"];
/** Slice position of the equidistant; minor factions are placed there. */
const EQUIDISTANT_INDEX = 3;

export function generateSlices(
  sliceCount: number,
  availableSystems: SystemId[],
  config: SliceGenerationConfig = {
    numAlphas: 2,
    numBetas: 2,
    minLegendaries: 1,
    maxSliceValue: undefined,
    minSliceValue: undefined,
    minorFactionPool: undefined,
  },
  sliceShape: string[] = SLICE_SHAPES.milty,
) {
  // Validation function for systems
  const validateSystems = (
    systems: TieredSystems,
    config: SliceGenerationConfig,
  ) => {
    const alphas = filterTieredSystems(systems, isAlpha).length;
    const betas = filterTieredSystems(systems, isBeta).length;
    const legendaries = filterTieredSystems(systems, isLegendary).length;

    const minAlphas = config.numAlphas ?? 2;
    const minBetas = config.numBetas ?? 2;
    const minLegendaries = config.minLegendaries ?? 1;
    const maxLegendaries = config.maxLegendaries;

    const meetsMinLegendaries = legendaries >= minLegendaries;
    const meetsMaxLegendaries =
      maxLegendaries === undefined || legendaries <= maxLegendaries;

    return (
      alphas >= minAlphas &&
      betas >= minBetas &&
      meetsMinLegendaries &&
      meetsMaxLegendaries
    );
  };

  // Validation function for a single slice
  const validateSlice = (slice: SystemIds, config: SliceGenerationConfig) => {
    const systems = slice.map((systemId) => systemData[systemId]);

    // can't have 2 alpha, beta or legendaries
    if (
      systems.filter(isAlpha).length > 1 ||
      systems.filter(isBeta).length > 1 ||
      systems.filter(isLegendary).length > 1
    ) {
      return false;
    }

    const totalOptimal = calculateSliceValue(
      systems,
      buildSliceValueConfig(
        config.sliceValueModifiers,
        [3],
        config.mecatolPathSystemIndices!,
      ),
    );
    const rawOptimal = optimalStatsForSystems(systems);
    const infOptimal = rawOptimal.influence + rawOptimal.flex;
    const resOptimal = rawOptimal.resources + rawOptimal.flex;

    if (config.minOptimalInfluence && infOptimal < config.minOptimalInfluence)
      return false;
    if (config.minOptimalResources && resOptimal < config.minOptimalResources)
      return false;
    if (config.maxSliceValue && totalOptimal > config.maxSliceValue)
      return false;
    if (config.minSliceValue && totalOptimal < config.minSliceValue)
      return false;
    if (!planetCountInRange(systems, config.minPlanets, config.maxPlanets))
      return false;
    if (!planetTraitsInLimit(systems, config.maxPlanetsPerTrait)) return false;
    if (!wormholesPerSliceOk(systems, config.wormholesPerSlice)) return false;
    if (
      !wormholePositionsOk(
        slice,
        config.wormholePositions,
        config.wormholesPerSlice,
      )
    )
      return false;
    return true;
  };

  // Minor factions sit on the equidistant, in place of a blue tile of their
  // tier, so the search values each slice with its minor faction.
  const minorFactions: FactionId[] =
    config.hasMinorFactions && config.minorFactionPool
      ? shuffle(
          config.minorFactionPool.filter((faction) => faction !== "keleres"),
        ).slice(0, sliceCount)
      : [];
  const pinned = minorFactions.map((faction) => ({
    index: EQUIDISTANT_INDEX,
    systemId: factionSystems[faction]!.id,
  }));

  const sliceTiers = (sliceIdx: number): ChoosableTier[] => {
    const minorFaction = minorFactions[sliceIdx];
    if (!minorFaction) return SLICE_TIERS;
    const minorFactionTier =
      (Object.entries(minorFactionTiers).find(([, factions]) =>
        factions.includes(minorFaction),
      )?.[0] as ChoosableTier | undefined) ?? "med";
    // A blue tile of the same tier, or any blue tile.
    let replaced = SLICE_TIERS.indexOf(minorFactionTier);
    if (replaced === -1 || minorFactionTier === "red")
      replaced = SLICE_TIERS.findIndex((tier) => tier !== "red");
    return SLICE_TIERS.filter((_, idx) => idx !== replaced);
  };

  return coreGenerateSlices({
    mecatolPath: config.mecatolPathSystemIndices!,
    equidistantIndices: [EQUIDISTANT_INDEX],
    centerTile: 1,
    sliceCount,
    availableSystems,
    config,
    sliceShape,
    systemTiers: miltySystemTiers,
    getSliceTiers: sliceTiers,
    pinned: pinned.length > 0 ? pinned : undefined,
    limits: limitsFromConfig(config, {
      // As validateSlice: 0 or unset means no limit.
      minValue: config.minSliceValue || undefined,
      maxValue: config.maxSliceValue || undefined,
      oneSpecialEach: true,
      minAlphas: config.numAlphas ?? 2,
      minBetas: config.numBetas ?? 2,
      minLegendaries: config.minLegendaries ?? 1,
      // The map check caps legendaries at 3 when unset; match it here.
      maxLegendaries: config.maxLegendaries ?? 3,
      safePath: config.safePathToMecatol,
      safeCenter: config.centerTileNotEmpty,
      highAdjacent: config.highQualityAdjacent,
    }),
    validateSystems,
    validateSlice,
  });
}
