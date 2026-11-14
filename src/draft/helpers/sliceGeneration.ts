/**
 * NOTE: CODE PORTED FROM TTPG.
 * @link https://github.com/TI4-Online/TI4-TTPG/blob/main/src/lib/draft/abstract/abstract-slice-generator.js
 * Has been adapted to 'typescript' and minor modifications to better fit
 * with the aesthetic of this project, but largely unchanged.
 */
import { SystemIds, System, SystemId } from "~/types";
import { systemData } from "~/data/systemData";
import { ChoosableTier, TieredSystems, WormholesPerSlice } from "../types";
import { shuffle } from "./randomization";

export const isAlpha = (system: System) => system.wormholes.includes("ALPHA");
export const isBeta = (system: System) => system.wormholes.includes("BETA");
export const isLegendary = (system: System) =>
  !!system.planets.find((p) => p.legendary);

/** Whether a slice's total planet count is within the (optional) limits. */
export const planetCountInRange = (
  systems: System[],
  minPlanets: number | undefined,
  maxPlanets: number | undefined,
) => {
  const planets = systems.reduce((sum, s) => sum + s.planets.length, 0);
  if (minPlanets !== undefined && planets < minPlanets) return false;
  if (maxPlanets !== undefined && planets > maxPlanets) return false;
  return true;
};

/** Alpha and beta wormholes in a system; ones inside a supernova don't count. */
export const countedWormholes = (system: System) =>
  system.anomalies.includes("SUPERNOVA")
    ? 0
    : system.wormholes.filter((w) => w === "ALPHA" || w === "BETA").length;

/** Whether a slice meets the "wormholes per slice" setting. */
export const wormholesPerSliceOk = (
  systems: System[],
  mode: WormholesPerSlice | undefined,
) => {
  if (!mode || mode === "any") return true;
  const count = systems.reduce((sum, s) => sum + countedWormholes(s), 0);
  return mode === "exactlyOne" ? count === 1 : count >= 1;
};

/**
 * Whether the slice's required wormhole sits on a selected position: with
 * "at least 1" / "exactly 1" wormholes per slice, at least one counted
 * wormhole must be on a selected position (others may be anywhere). With
 * "any" the positions have no effect.
 */
export const wormholePositionsOk = (
  slice: SystemIds,
  selected: boolean[] | undefined,
  mode: WormholesPerSlice | undefined,
) =>
  !selected ||
  !mode ||
  mode === "any" ||
  slice.some(
    (id, idx) =>
      selected[idx] !== false && countedWormholes(systemData[id]) > 0,
  );

/**
 * If no counted wormhole is on a selected position, swap one onto a
 * selected position. Best effort: the slice may have no wormhole at all.
 */
export function moveWormholeToSelectedPosition(
  slice: SystemIds,
  selected: boolean[] | undefined,
  mode: WormholesPerSlice | undefined,
): SystemIds {
  const result = [...slice];
  if (wormholePositionsOk(result, selected, mode)) return result;
  const indices = shuffle(result.map((_, idx) => idx));
  const from = indices.find((i) => countedWormholes(systemData[result[i]]) > 0);
  const to = indices.find((i) => selected?.[i] !== false);
  if (from === undefined || to === undefined) return result;
  [result[from], result[to]] = [result[to], result[from]];
  return result;
}

/**
 * Whether the systems going into `sliceCount` slices hold enough counted
 * wormholes for the "wormholes per slice" setting (exactly one per slice
 * needs exactly `sliceCount` of them in total).
 */
export const poolFitsWormholesPerSlice = (
  systems: System[],
  sliceCount: number,
  mode: WormholesPerSlice | undefined,
) => {
  if (!mode || mode === "any") return true;
  const count = systems.reduce((sum, s) => sum + countedWormholes(s), 0);
  return mode === "exactlyOne" ? count === sliceCount : count >= sliceCount;
};

export function filterTieredSystems(
  tieredSystems: TieredSystems,
  filter: (system: System) => boolean,
) {
  const matchingSystems: SystemId[] = [];
  const runForTier = (systems: SystemId[]) => {
    for (let i = 0; i < systems.length; i++) {
      const s = systems[i];
      const system = systemData[s];
      if (!system) throw new Error(`no system for tile ${s}`);
      if (filter(system)) matchingSystems.push(s);
    }
  };
  runForTier(tieredSystems.high);
  runForTier(tieredSystems.med);
  runForTier(tieredSystems.low);
  runForTier(tieredSystems.red);
  return matchingSystems;
}

export function groupSystemsByTier(
  systems: SystemId[],
  tiers: Record<string, ChoosableTier>,
): Record<ChoosableTier, SystemId[]> {
  return systems.reduce(
    (acc, id) => {
      const tier = tiers[id];
      if (acc[tier]) {
        acc[tier].push(id);
      } else {
        acc[tier] = [id];
      }
      return acc;
    },
    {} as Record<ChoosableTier, SystemId[]>,
  );
}
