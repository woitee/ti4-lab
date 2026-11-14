import { describe, expect, test } from "vitest";
import { draftConfig } from "~/draft/draftConfig";
import { generateSlices as generateMiltySlices } from "~/draft/milty/sliceGenerator";
import {
  generateMap as generateMiltyEqMap,
  generateSlices as generateMiltyEqSlices,
} from "~/draft/miltyeq/sliceGenerator";
import { generateMap as generateHeisenMap } from "~/draft/heisen/generateMap";
import {
  describeSliceSearchFailure,
  SLICE_SEARCH_TIME_LIMIT_MS,
  takeSliceSearchFailure,
} from "~/draft/common/sliceSearch";
import { miltySystemTiers } from "~/data/miltyTileTiers";
import { factionSystems, systemData } from "~/data/systemData";
import { planetTraitCounts } from "~/draft/helpers/sliceGeneration";
import { buildSliceValueConfig, calculateSliceValue } from "~/stats";
import { optimalStatsForSystems } from "~/utils/map";
import { getSystemPool } from "~/utils/system";
import type { DraftSettings, SystemIds } from "~/types";
import type { SliceGenerationConfig } from "~/draft/types";

// The default pool of the setup page.
const pool = getSystemPool(["base", "pok", "te"]);
const MILTY_PATH = draftConfig.milty.mecatolPathSystemIndices!;
const EQ_PATH = draftConfig.miltyeq.mecatolPathSystemIndices!;
const NUCLEUS_PATH = draftConfig.heisen.mecatolPathSystemIndices!;

const value = (slice: SystemIds, equidistant: number[], path: number[]) =>
  calculateSliceValue(
    slice.map((id) => systemData[id]),
    buildSliceValueConfig(undefined, equidistant, path),
  );

const optimal = (slice: SystemIds) => {
  const o = optimalStatsForSystems(slice.map((id) => systemData[id]));
  return { influence: o.influence + o.flex, resources: o.resources + o.flex };
};

const miltyConfig = (
  min: number,
  max: number,
  extra: Partial<SliceGenerationConfig> = {},
): SliceGenerationConfig => ({
  numAlphas: 2,
  numBetas: 2,
  minLegendaries: 1,
  maxLegendaries: 3,
  minOptimalInfluence: 4,
  minOptimalResources: 3,
  minSliceValue: min,
  maxSliceValue: max,
  mecatolPathSystemIndices: MILTY_PATH,
  ...extra,
});

const nucleusSettings = (
  sliceGenerationConfig: SliceGenerationConfig,
): DraftSettings => ({
  type: "heisen",
  factionGameSets: ["base", "pok", "te"],
  tileGameSets: ["base", "pok", "te"],
  draftSpeaker: false,
  allowEmptyTiles: false,
  allowHomePlanetSearch: false,
  numFactions: 6,
  numSlices: 6,
  randomizeMap: true,
  randomizeSlices: true,
  numPreassignedFactions: 0,
  numMinorFactions: 0,
  minorFactionsInSharedPool: false,
  sliceGenerationConfig: {
    mecatolPathSystemIndices: NUCLEUS_PATH,
    ...sliceGenerationConfig,
  },
});

/** Runs fn, failing if it takes longer than the search time limit. */
const withinTimeLimit = <T>(fn: () => T): T => {
  const start = performance.now();
  const result = fn();
  expect(performance.now() - start).toBeLessThan(SLICE_SEARCH_TIME_LIMIT_MS);
  return result;
};

test.each([
  [9.75, 10.5],
  [10, 10.5],
  [8, 8.5],
])("Milty %s–%s generates reliably within the time limit", (min, max) => {
  for (let i = 0; i < 20; i++) {
    const slices = withinTimeLimit(() =>
      generateMiltySlices(6, [...pool], miltyConfig(min, max)),
    );
    expect(slices).toHaveLength(6);
    for (const slice of slices!) {
      const v = value(slice, [3], MILTY_PATH);
      expect(v).toBeGreaterThanOrEqual(min);
      expect(v).toBeLessThanOrEqual(max);
      expect(optimal(slice).influence).toBeGreaterThanOrEqual(4);
      expect(optimal(slice).resources).toBeGreaterThanOrEqual(3);
    }
  }
}, 60_000);

test("Milty EQ 7–8 generates reliably within the time limit", () => {
  for (let i = 0; i < 20; i++) {
    const slices = withinTimeLimit(() =>
      generateMiltyEqSlices(6, [...pool], {
        ...miltyConfig(7, 8),
        minOptimalInfluence: 3,
        minOptimalResources: 2,
        mecatolPathSystemIndices: EQ_PATH,
      }),
    );
    expect(slices).toHaveLength(6);
    for (const slice of slices!) {
      const v = value(slice, [], EQ_PATH);
      expect(v).toBeGreaterThanOrEqual(7);
      expect(v).toBeLessThanOrEqual(8);
    }
  }
}, 60_000);

test("an infeasible range fails with the closest set, or uses it on request", () => {
  takeSliceSearchFailure();
  const start = performance.now();
  const slices = generateMiltySlices(6, [...pool], miltyConfig(17, 17.5));
  // The search gives up at the time limit (plus a few short probes).
  expect(performance.now() - start).toBeLessThan(SLICE_SEARCH_TIME_LIMIT_MS + 1000);
  expect(slices).toBeUndefined();

  const failure = takeSliceSearchFailure()!;
  expect(failure).toBeDefined();
  expect(failure.limits).toMatchObject({ minValue: 17, maxValue: 17.5 });
  expect(failure.closestValues![0]).toBeLessThan(17);
  expect(failure.problems.join(" ")).toMatch(/below value 17/);
  // All slices got at least this far together.
  expect(failure.reach?.above).toBeGreaterThanOrEqual(failure.closestValues![0]);
  expect(failure.reach?.above).toBeLessThan(17);
  const { lines } = describeSliceSearchFailure(failure);
  expect(lines[0]).toMatch(/Couldn't find 6 slices with value 17–17.5/);
  expect(lines.join(" ")).toMatch(/Closest set found/);

  const closest = generateMiltySlices(
    6,
    [...pool],
    miltyConfig(17, 17.5, { allowClosestSlices: true }),
  );
  expect(closest).toHaveLength(6);
  for (const slice of closest!) {
    // Close to the range: the closest set isn't far off.
    expect(value(slice, [3], MILTY_PATH)).toBeGreaterThan(15);
  }
}, 30_000);

test("impossible wormhole positions fail at once", () => {
  takeSliceSearchFailure();
  const slices = withinTimeLimit(() =>
    generateMiltySlices(
      6,
      [...pool],
      miltyConfig(9, 13, {
        wormholesPerSlice: "atLeastOne",
        wormholePositions: [false, false, false, false, false],
      }),
    ),
  );
  expect(slices).toBeUndefined();
  expect(takeSliceSearchFailure()?.problems).toEqual([
    "No wormhole position is selected.",
  ]);
});

test("slice quality counts are met, not just attempted", () => {
  const isAnomaly = (id: string) => systemData[id].anomalies.length > 0;
  for (let i = 0; i < 10; i++) {
    const slices = generateMiltySlices(
      6,
      [...pool],
      miltyConfig(9, 13, {
        safePathToMecatol: 6,
        centerTileNotEmpty: 6,
        highQualityAdjacent: 6,
      }),
    );
    expect(slices).toHaveLength(6);
    for (const slice of slices!) {
      expect(MILTY_PATH.some((pos) => isAnomaly(slice[pos]))).toBe(false);
      expect(isAnomaly(slice[1]) || systemData[slice[1]].planets.length === 0).toBe(false);
      expect(
        // Left, front or right of home.
        [0, 1, 2].some((pos) => miltySystemTiers[slice[pos]] === "high"),
      ).toBe(true);
    }
  }
}, 60_000);

test("Milty minor factions are valued on the equidistant", () => {
  const minorFactionPool = ["mahact", "nomad", "winnu", "barony", "sardakk", "argent", "jolnar"] as const;
  const homes = new Set(minorFactionPool.map((f) => factionSystems[f]!.id));
  for (let i = 0; i < 10; i++) {
    const slices = generateMiltySlices(
      6,
      [...pool],
      miltyConfig(9, 13, {
        hasMinorFactions: true,
        minorFactionPool: [...minorFactionPool],
      }),
    );
    expect(slices).toHaveLength(6);
    for (const slice of slices!) {
      expect(homes.has(slice[3])).toBe(true);
      const v = value(slice, [3], MILTY_PATH);
      expect(v).toBeGreaterThanOrEqual(9);
      expect(v).toBeLessThanOrEqual(13);
    }
  }
}, 60_000);

test("Nucleus never returns slices outside the settings", () => {
  for (const [min, max] of [
    [5, 7],
    [6, 7],
  ]) {
    for (let i = 0; i < 10; i++) {
      takeSliceSearchFailure();
      const result = generateHeisenMap(
        nucleusSettings({ minSliceValue: min, maxSliceValue: max }),
        [...pool],
      );
      if (!result) {
        // Allowed, but then it must say why.
        expect(takeSliceSearchFailure()).toBeDefined();
        continue;
      }
      expect(result.valid).toBe(true);
      for (const slice of result.slices) {
        const v = value(slice, [], NUCLEUS_PATH);
        expect(v).toBeGreaterThanOrEqual(min);
        expect(v).toBeLessThanOrEqual(max);
      }
    }
  }
}, 120_000);

test("Nucleus reports an impossible range, and uses the closest slices on request", () => {
  takeSliceSearchFailure();
  const strict = generateHeisenMap(
    nucleusSettings({ minSliceValue: 14, maxSliceValue: 15 }),
    [...pool],
  );
  expect(strict).toBeUndefined();
  expect(takeSliceSearchFailure()?.closestValues).toBeDefined();

  const closest = generateHeisenMap(
    nucleusSettings({
      minSliceValue: 14,
      maxSliceValue: 15,
      allowClosestSlices: true,
    }),
    [...pool],
  );
  expect(closest?.valid).toBe(false);
  expect(closest?.slices).toHaveLength(6);
}, 30_000);

test("Milty EQ reports a map that keeps failing its checks, and uses it on request", () => {
  // Base + PoK with only 7 red tiles: slices and the 6 free map tiles can
  // never reach the 11 red tiles a 6p map needs.
  const keptRed = new Set(["39", "40", "46", "47", "48", "49", "50"]);
  const fewReds = getSystemPool(["base", "pok"]).filter(
    (id) => miltySystemTiers[id] !== "red" || keptRed.has(id),
  );
  const settings: DraftSettings = {
    ...nucleusSettings({}),
    type: "miltyeq",
    sliceGenerationConfig: {
      ...miltyConfig(6, 10),
      minOptimalInfluence: 3,
      minOptimalResources: 2,
      mecatolPathSystemIndices: EQ_PATH,
    },
  };

  takeSliceSearchFailure();
  const start = performance.now();
  expect(generateMiltyEqMap(settings, [...fewReds])).toBeUndefined();
  expect(performance.now() - start).toBeLessThan(SLICE_SEARCH_TIME_LIMIT_MS + 1000);
  const failure = takeSliceSearchFailure()!;
  expect(failure.kind).toBe("map");
  expect(failure.problems.join(" ")).toMatch(
    /the map is short of red tiles \(needs 11, got [0-7]\)/,
  );
  const { title, lines } = describeSliceSearchFailure(failure);
  expect(title).toBe("Couldn't generate the map");
  expect(lines[0]).toMatch(/short of red tiles/);

  const anyway = generateMiltyEqMap(
    {
      ...settings,
      sliceGenerationConfig: { ...settings.sliceGenerationConfig, allowInvalidMap: true },
    },
    [...fewReds],
  );
  expect(anyway?.valid).toBe(false);
  expect(anyway?.slices).toHaveLength(6);
}, 30_000);

describe("max planets of one trait", () => {
  const maxTrait = (slice: SystemIds) =>
    Math.max(...planetTraitCounts(slice.map((id) => systemData[id])));

  const generators = (extra: Partial<SliceGenerationConfig>) => ({
    milty: () => generateMiltySlices(6, [...pool], miltyConfig(9, 13, extra)),
    miltyeq: () =>
      generateMiltyEqSlices(6, [...pool], {
        ...miltyConfig(6, 10, extra),
        minOptimalInfluence: 3,
        minOptimalResources: 2,
        mecatolPathSystemIndices: EQ_PATH,
      }),
    nucleus: () =>
      generateHeisenMap(nucleusSettings({ ...extra }), [...pool])?.slices,
  });

  // Max 1 is too tight for Milty / Milty EQ slices (it fails with the reason).
  test.each([
    [2, ["milty", "miltyeq", "nucleus"]],
    [1, ["nucleus"]],
  ])("is respected (max %i): %s", (max, formats) => {
    for (const [format, generate] of Object.entries(
      generators({ maxPlanetsPerTrait: max }),
    ).filter(([format]) => formats.includes(format))) {
      for (let i = 0; i < 10; i++) {
        takeSliceSearchFailure();
        const slices = generate();
        if (max === 1 && !slices) {
          // Nucleus max 1 is tight (~98% succeed); a failure must say why.
          expect(takeSliceSearchFailure()?.problems.join(" ")).toMatch(/of one trait/);
          continue;
        }
        expect(slices, format).toHaveLength(6);
        for (const slice of slices!) expect(maxTrait(slice), format).toBeLessThanOrEqual(max);
      }
    }
  }, 60_000);

  test("has no effect when off", () => {
    // Without the limit, Milty slices regularly have 3+ planets of a trait.
    const { milty } = generators({});
    let over = 0;
    for (let i = 0; i < 20; i++) {
      over += milty()!.filter((slice) => maxTrait(slice) > 2).length;
    }
    expect(over).toBeGreaterThan(0);
  }, 60_000);

  test("an impossible limit names it in the failure", () => {
    takeSliceSearchFailure();
    // Milty slices have 3 blue tiles; with min 5 planets some trait repeats.
    expect(
      generateMiltySlices(6, [...pool], miltyConfig(9, 13, { maxPlanetsPerTrait: 1, minPlanets: 7 })),
    ).toBeUndefined();
    const failure = takeSliceSearchFailure()!;
    expect(failure.problems.join(" ")).toMatch(/more than 1 planet of one trait/);
    expect(describeSliceSearchFailure(failure).lines[0]).toMatch(/at most 1 planet of one trait/);
  }, 30_000);
});
