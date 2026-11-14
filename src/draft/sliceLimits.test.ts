import { expect, test } from "vitest";
import { draftConfig } from "~/draft/draftConfig";
import { generateSlices as generateMiltySlices } from "~/draft/milty/sliceGenerator";
import { generateSlices as generateMiltyEqSlices } from "~/draft/miltyeq/sliceGenerator";
import { generateMap as generateHeisenMap } from "~/draft/heisen/generateMap";
import { buildSliceValueConfig, calculateSliceValue } from "~/stats";
import { getSystemPool } from "~/utils/system";
import { systemData } from "~/data/systemData";
import type { DraftSettings, SystemIds } from "~/types";

const pool = getSystemPool(["base", "pok"]);

const planets = (slice: SystemIds) =>
  slice.reduce((sum, id) => sum + systemData[id].planets.length, 0);

const value = (slice: SystemIds, equidistant: number[], path: number[]) =>
  calculateSliceValue(
    slice.map((id) => systemData[id]),
    buildSliceValueConfig(undefined, equidistant, path),
  );

test("Milty enforces planets per slice and quarter slice values", () => {
  const path = draftConfig.milty.mecatolPathSystemIndices!;
  for (let i = 0; i < 50; i++) {
    const slices = generateMiltySlices(6, [...pool], {
      numAlphas: 2,
      numBetas: 2,
      minLegendaries: 1,
      minSliceValue: 9.75,
      maxSliceValue: 12.25,
      minPlanets: 5,
      maxPlanets: 5,
      mecatolPathSystemIndices: path,
    });
    expect(slices).toBeDefined();
    for (const slice of slices!) {
      expect(planets(slice)).toBe(5);
      const v = value(slice, [3], path);
      expect(v).toBeGreaterThanOrEqual(9.75);
      expect(v).toBeLessThanOrEqual(12.25);
    }
  }
}, 60_000);

test("Milty EQ enforces planets per slice and quarter slice values", () => {
  const path = draftConfig.miltyeq.mecatolPathSystemIndices!;
  for (let i = 0; i < 20; i++) {
    const slices = generateMiltyEqSlices(6, [...pool], {
      numAlphas: 2,
      numBetas: 2,
      minLegendaries: 1,
      minSliceValue: 6.25,
      maxSliceValue: 9.75,
      minPlanets: 3,
      maxPlanets: 4,
      mecatolPathSystemIndices: path,
    });
    expect(slices).toBeDefined();
    for (const slice of slices!) {
      expect(planets(slice)).toBeGreaterThanOrEqual(3);
      expect(planets(slice)).toBeLessThanOrEqual(4);
      const v = value(slice, [], path);
      expect(v).toBeGreaterThanOrEqual(6.25);
      expect(v).toBeLessThanOrEqual(9.75);
    }
  }
}, 60_000);

test("Milty slices are unconstrained by planets when no limit is set", () => {
  const counts = new Set<number>();
  for (let i = 0; i < 30; i++) {
    generateMiltySlices(6, [...pool], {
      numAlphas: 2,
      numBetas: 2,
      minLegendaries: 1,
      mecatolPathSystemIndices: draftConfig.milty.mecatolPathSystemIndices,
    })?.forEach((s) => counts.add(planets(s)));
  }
  expect(counts.size).toBeGreaterThan(1);
});

test("Nucleus uses configurable planet limits and quarter slice values", () => {
  const path = draftConfig.heisen.mecatolPathSystemIndices!;
  const settings: DraftSettings = {
    type: "heisen",
    factionGameSets: ["base", "pok"],
    tileGameSets: ["base", "pok"],
    draftSpeaker: false,
    allowEmptyTiles: false,
    allowHomePlanetSearch: false,
    numFactions: 6,
    numSlices: 6,
    randomizeMap: false,
    randomizeSlices: false,
    numPreassignedFactions: 0,
    numMinorFactions: 0,
    minorFactionsInSharedPool: false,
    sliceGenerationConfig: {
      minSliceValue: 4.25,
      maxSliceValue: 9.75,
      minPlanets: 2,
      maxPlanets: 4,
      mecatolPathSystemIndices: path,
    },
  };
  for (let i = 0; i < 10; i++) {
    const result = generateHeisenMap(settings, [...pool]);
    expect(result.valid).toBe(true);
    for (const slice of result.slices) {
      const p = planets(slice);
      expect(p).toBeGreaterThanOrEqual(2);
      expect(p).toBeLessThanOrEqual(4);
      const v = value(slice, [], path);
      expect(v).toBeGreaterThanOrEqual(4.25);
      expect(v).toBeLessThanOrEqual(9.75);
    }
  }
}, 120_000);
