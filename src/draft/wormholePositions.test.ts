import { expect, test } from "vitest";
import { draftConfig } from "~/draft/draftConfig";
import { SLICE_POSITIONS } from "~/draft/sliceSettings";
import { generateSlices as generateMiltySlices } from "~/draft/milty/sliceGenerator";
import { generateSlices as generateMiltyEqSlices } from "~/draft/miltyeq/sliceGenerator";
import { generateMap as generateHeisenMap } from "~/draft/heisen/generateMap";
import {
  countedWormholes,
  moveWormholesToAllowedPositions,
  wormholePositionsOk,
} from "~/draft/helpers/sliceGeneration";
import { getSystemPool } from "~/utils/system";
import { systemData } from "~/data/systemData";
import type { DraftSettings, SystemIds } from "~/types";
import type { DraftType } from "~/draft/types";

const basePok = getSystemPool(["base", "pok"]);

/** Indices of the slice positions holding a counted wormhole. */
const wormholeIndices = (slice: SystemIds) =>
  slice.flatMap((id, idx) => (countedWormholes(systemData[id]) > 0 ? [idx] : []));

const expectOnlyAllowed = (slices: SystemIds[], allowed: boolean[]) => {
  for (const slice of slices)
    for (const idx of wormholeIndices(slice)) expect(allowed[idx]).not.toBe(false);
};

test("mask check: forbidden positions, supernova and missing entries", () => {
  // 26 = Lodor (alpha), 4276 = alpha + beta in a supernova, 19 = plain planet.
  expect(wormholePositionsOk(["26", "19", "19"], [false, true, true])).toBe(false);
  expect(wormholePositionsOk(["19", "26", "19"], [false, true, true])).toBe(true);
  expect(wormholePositionsOk(["4276", "19"], [false, false])).toBe(true);
  expect(wormholePositionsOk(["19", "26"], [false])).toBe(true); // missing = allowed
  expect(wormholePositionsOk(["26"], undefined)).toBe(true);

  const moved = moveWormholesToAllowedPositions(["26", "19", "20"], [false, false, true]);
  expect(moved[2]).toBe("26");
  expect([...moved].sort()).toEqual(["19", "20", "26"]);
});

test("positions in the settings match the order the drafts place slice tiles", () => {
  const formats: Record<keyof typeof SLICE_POSITIONS, DraftType> = {
    milty: "milty",
    miltyeq: "miltyeq",
    heisen: "heisen",
  };
  for (const [format, type] of Object.entries(formats)) {
    const config = draftConfig[type];
    const positions = SLICE_POSITIONS[format as keyof typeof SLICE_POSITIONS];
    expect(positions).toHaveLength(config.numSystemsInSlice);
    positions.forEach(({ x, y }, idx) =>
      expect(config.seatTilePositions[idx + 1]).toEqual({ x, y }),
    );
  }
});

// Typical use: no wormhole next to the home system.
const notNextToHome = [false, false, false, true, true];

test("Milty keeps wormholes out of forbidden positions", () => {
  for (let i = 0; i < 10; i++) {
    const slices = generateMiltySlices(6, [...basePok], {
      numAlphas: 2,
      numBetas: 2,
      minLegendaries: 1,
      wormholePositions: notNextToHome,
      mecatolPathSystemIndices: draftConfig.milty.mecatolPathSystemIndices,
    });
    expect(slices).toBeDefined();
    expectOnlyAllowed(slices!, notNextToHome);
  }
}, 60_000);

test("7p Milty and Milty EQ apply the mask by role, also to the pushed-forward seat", () => {
  // The pushed-forward seat places slice tiles in the same role order
  // (left, front, right, ...), only on different hexes.
  for (const type of ["milty7p", "miltyeq7p"] as const) {
    const config = draftConfig[type];
    const pushedSeat = Object.values(config.seatTilePlacement).find(
      (tiles) => JSON.stringify(tiles).includes("[2,-1]"),
    );
    expect(pushedSeat).toHaveLength(config.numSystemsInSlice);
  }

  const eqMask = [false, false, false, true];
  for (let i = 0; i < 5; i++) {
    const milty = generateMiltySlices(7, [...basePok], {
      numAlphas: 2,
      numBetas: 2,
      minLegendaries: 1,
      wormholePositions: notNextToHome,
      mecatolPathSystemIndices: draftConfig.milty7p.mecatolPathSystemIndices,
    });
    expect(milty).toBeDefined();
    expectOnlyAllowed(milty!, notNextToHome);

    const eq = generateMiltyEqSlices(7, [...basePok], {
      numAlphas: 2,
      numBetas: 2,
      minLegendaries: 1,
      wormholePositions: eqMask,
      mecatolPathSystemIndices: draftConfig.miltyeq7p.mecatolPathSystemIndices,
    });
    expect(eq).toBeDefined();
    expectOnlyAllowed(eq!, eqMask);
  }
}, 60_000);

test("Nucleus keeps wormholes out of forbidden positions", () => {
  const settings = (wormholePositions: boolean[]): DraftSettings => ({
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
      wormholesPerSlice: "atLeastOne",
      wormholePositions,
      mecatolPathSystemIndices: draftConfig.heisen.mecatolPathSystemIndices,
    },
  });
  // Only the front position (toward Mecatol) may hold the wormhole.
  for (let i = 0; i < 10; i++) {
    const result = generateHeisenMap(settings([false, true, false]), [...basePok]);
    expect(result.valid).toBe(true);
    for (const slice of result.slices) expect(wormholeIndices(slice)).toEqual([1]);
  }
}, 60_000);

test("an impossible mask fails like other impossible settings", () => {
  // Every slice needs a wormhole, but no position may hold one.
  const slices = generateMiltySlices(6, [...basePok], {
    numAlphas: 0,
    numBetas: 0,
    minLegendaries: 0,
    wormholesPerSlice: "atLeastOne",
    wormholePositions: [false, false, false, false, false],
    mecatolPathSystemIndices: draftConfig.milty.mecatolPathSystemIndices,
  });
  expect(slices).toBeUndefined();
}, 60_000);
