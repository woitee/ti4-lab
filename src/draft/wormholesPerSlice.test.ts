import { describe, expect, test } from "vitest";
import { draftConfig } from "~/draft/draftConfig";
import { generateSlices as generateMiltySlices } from "~/draft/milty/sliceGenerator";
import { generateSlices as generateMiltyEqSlices } from "~/draft/miltyeq/sliceGenerator";
import { generateMap as generateHeisenMap } from "~/draft/heisen/generateMap";
import {
  countedWormholes,
  wormholesPerSliceOk,
} from "~/draft/helpers/sliceGeneration";
import { getSystemPool } from "~/utils/system";
import { systemData } from "~/data/systemData";
import type { DraftSettings, SystemIds } from "~/types";
import type { WormholesPerSlice } from "~/draft/types";

const basePok = getSystemPool(["base", "pok"]);

const wormholes = (slice: SystemIds) =>
  slice.reduce((sum, id) => sum + countedWormholes(systemData[id]), 0);

const expectMode = (slices: SystemIds[], mode: WormholesPerSlice) => {
  for (const slice of slices) {
    if (mode === "exactlyOne") expect(wormholes(slice)).toBe(1);
    else expect(wormholes(slice)).toBeGreaterThanOrEqual(1);
  }
};

test("counts alpha and beta wormholes, but not inside a supernova", () => {
  expect(countedWormholes(systemData["26"])).toBe(1); // Lodor, alpha
  expect(countedWormholes(systemData["40"])).toBe(1); // empty beta
  expect(countedWormholes(systemData["82"])).toBe(2); // Mallice: alpha + beta (+ gamma)
  expect(countedWormholes(systemData["51"])).toBe(0); // Creuss: delta only
  expect(countedWormholes(systemData["4276"])).toBe(0); // alpha + beta in a supernova

  const slice = [systemData["26"], systemData["40"]];
  expect(wormholesPerSliceOk(slice, "any")).toBe(true);
  expect(wormholesPerSliceOk(slice, undefined)).toBe(true);
  expect(wormholesPerSliceOk(slice, "atLeastOne")).toBe(true);
  expect(wormholesPerSliceOk(slice, "exactlyOne")).toBe(false);
  expect(wormholesPerSliceOk([systemData["4276"]], "atLeastOne")).toBe(false);
});

describe.each(["atLeastOne", "exactlyOne"] as const)("%s", (mode) => {
  test("Milty", () => {
    for (let i = 0; i < 10; i++) {
      const slices = generateMiltySlices(6, [...basePok], {
        numAlphas: 2,
        numBetas: 2,
        minLegendaries: 1,
        wormholesPerSlice: mode,
        mecatolPathSystemIndices: draftConfig.milty.mecatolPathSystemIndices,
      });
      expect(slices).toBeDefined();
      expectMode(slices!, mode);
    }
  }, 60_000);

  test("Milty EQ", () => {
    for (let i = 0; i < 10; i++) {
      const slices = generateMiltyEqSlices(6, [...basePok], {
        numAlphas: 2,
        numBetas: 2,
        minLegendaries: 1,
        wormholesPerSlice: mode,
        mecatolPathSystemIndices: draftConfig.miltyeq.mecatolPathSystemIndices,
      });
      expect(slices).toBeDefined();
      expectMode(slices!, mode);
    }
  }, 60_000);

  test("Nucleus", () => {
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
        minSliceValue: 4,
        maxSliceValue: 10,
        wormholesPerSlice: mode,
        mecatolPathSystemIndices: draftConfig.heisen.mecatolPathSystemIndices,
      },
    };
    for (let i = 0; i < 10; i++) {
      const result = generateHeisenMap(settings, [...basePok]);
      expect(result.valid).toBe(true);
      expectMode(result.slices, mode);
    }
  }, 60_000);
});

test("fails like other impossible settings when the pool lacks wormholes", () => {
  // Base + PoK have 6 counted wormholes, so 7 slices can't each get one.
  const slices = generateMiltySlices(7, [...basePok], {
    numAlphas: 0,
    numBetas: 0,
    minLegendaries: 0,
    wormholesPerSlice: "atLeastOne",
    mecatolPathSystemIndices: draftConfig.milty.mecatolPathSystemIndices,
  });
  expect(slices).toBeUndefined();
}, 60_000);
