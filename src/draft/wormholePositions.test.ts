import { expect, test } from "vitest";
import { draftConfig } from "~/draft/draftConfig";
import { SLICE_POSITIONS } from "~/draft/sliceSettings";
import { generateSlices as generateMiltySlices } from "~/draft/milty/sliceGenerator";
import { generateSlices as generateMiltyEqSlices } from "~/draft/miltyeq/sliceGenerator";
import { generateMap as generateHeisenMap } from "~/draft/heisen/generateMap";
import {
  countedWormholes,
  moveWormholeToSelectedPosition,
  wormholePositionsOk,
} from "~/draft/helpers/sliceGeneration";
import { getSystemPool } from "~/utils/system";
import { systemData } from "~/data/systemData";
import type { DraftSettings, SystemIds } from "~/types";
import type { DraftType, WormholesPerSlice } from "~/draft/types";

const basePok = getSystemPool(["base", "pok"]);
// Thunder's Edge adds wormholes, enough for one in each of 7 slices.
const basePokTe = getSystemPool(["base", "pok", "te"]);

/** Indices of the slice positions holding a counted wormhole. */
const wormholeIndices = (slice: SystemIds) =>
  slice.flatMap((id, idx) => (countedWormholes(systemData[id]) > 0 ? [idx] : []));

/** Every slice has a wormhole on a selected position (and, for exactly 1, no other). */
const expectRequiredOnSelected = (
  slices: SystemIds[],
  selected: boolean[],
  mode: WormholesPerSlice,
) => {
  for (const slice of slices) {
    const indices = wormholeIndices(slice);
    expect(indices.some((idx) => selected[idx] !== false)).toBe(true);
    if (mode === "exactlyOne") expect(indices).toHaveLength(1);
  }
};

// 26 = Lodor (alpha), 40 = empty beta, 4276 = alpha + beta in a supernova,
// 19 = plain planet.
test("rule: one wormhole on a selected position, others anywhere", () => {
  const frontAndRight = [false, true, true];
  // At least 1: a second wormhole on an unselected position is fine.
  expect(wormholePositionsOk(["26", "40", "19"], frontAndRight, "atLeastOne")).toBe(true);
  expect(wormholePositionsOk(["26", "19", "19"], frontAndRight, "atLeastOne")).toBe(false);
  // Exactly 1: the one wormhole must be on a selected position.
  expect(wormholePositionsOk(["19", "26", "19"], frontAndRight, "exactlyOne")).toBe(true);
  expect(wormholePositionsOk(["26", "19", "19"], frontAndRight, "exactlyOne")).toBe(false);
  // Any (or unset): positions are ignored.
  expect(wormholePositionsOk(["26", "19", "19"], frontAndRight, "any")).toBe(true);
  expect(wormholePositionsOk(["26", "19", "19"], frontAndRight, undefined)).toBe(true);
  // A wormhole in a supernova doesn't count; missing entries are selected.
  expect(wormholePositionsOk(["19", "4276"], [false, true], "atLeastOne")).toBe(false);
  expect(wormholePositionsOk(["19", "26"], [false], "atLeastOne")).toBe(true);
  expect(wormholePositionsOk(["26"], undefined, "exactlyOne")).toBe(true);

  const moved = moveWormholeToSelectedPosition(["26", "19", "20"], [false, false, true], "atLeastOne");
  expect(moved[2]).toBe("26");
  expect([...moved].sort()).toEqual(["19", "20", "26"]);
  expect(moveWormholeToSelectedPosition(["26", "19", "20"], [false, false, true], "any")).toEqual(["26", "19", "20"]);
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

const miltyConfig = (
  mode: WormholesPerSlice,
  wormholePositions: boolean[],
  type: DraftType = "milty",
) => ({
  numAlphas: 2,
  numBetas: 2,
  minLegendaries: 1,
  wormholesPerSlice: mode,
  wormholePositions,
  mecatolPathSystemIndices: draftConfig[type].mecatolPathSystemIndices,
});

// Typical use: the wormhole not next to the home system.
const notNextToHome = [false, false, false, true, true];

test("Milty: exactly 1, on a selected position", () => {
  for (let i = 0; i < 10; i++) {
    const slices = generateMiltySlices(6, [...basePok], miltyConfig("exactlyOne", notNextToHome));
    expect(slices).toBeDefined();
    expectRequiredOnSelected(slices!, notNextToHome, "exactlyOne");
  }
}, 60_000);

test("Milty: at least 1 on a selected position", () => {
  const frontFar = [false, false, false, false, true];
  for (let i = 0; i < 10; i++) {
    const slices = generateMiltySlices(6, [...basePok], miltyConfig("atLeastOne", frontFar));
    expect(slices).toBeDefined();
    expectRequiredOnSelected(slices!, frontFar, "atLeastOne");
  }
}, 60_000);

test("Milty: with any, the positions are ignored", () => {
  const nothingSelected = [false, false, false, false, false];
  const indices = new Set<number>();
  for (let i = 0; i < 10; i++) {
    const slices = generateMiltySlices(6, [...basePok], miltyConfig("any", nothingSelected));
    expect(slices).toBeDefined();
    slices!.forEach((slice) => wormholeIndices(slice).forEach((idx) => indices.add(idx)));
  }
  // Wormholes still land on the (unselected) positions next to home.
  expect([...indices].some((idx) => idx < 3)).toBe(true);
}, 60_000);

test("7p Milty and Milty EQ apply the positions by role, also to the pushed-forward seat", () => {
  // The pushed-forward seat places slice tiles in the same role order
  // (left, front, right, ...), only on different hexes.
  for (const type of ["milty7p", "miltyeq7p"] as const) {
    const config = draftConfig[type];
    const pushedSeat = Object.values(config.seatTilePlacement).find(
      (tiles) => JSON.stringify(tiles).includes("[2,-1]"),
    );
    expect(pushedSeat).toHaveLength(config.numSystemsInSlice);
  }

  const eqFrontFar = [false, false, false, true];
  for (let i = 0; i < 5; i++) {
    const milty = generateMiltySlices(
      7,
      [...basePokTe],
      miltyConfig("exactlyOne", notNextToHome, "milty7p"),
    );
    expect(milty).toBeDefined();
    expectRequiredOnSelected(milty!, notNextToHome, "exactlyOne");

    const eq = generateMiltyEqSlices(
      7,
      [...basePokTe],
      miltyConfig("atLeastOne", eqFrontFar, "miltyeq7p"),
    );
    expect(eq).toBeDefined();
    expectRequiredOnSelected(eq!, eqFrontFar, "atLeastOne");
  }
}, 60_000);

test("Nucleus: the required wormhole on a selected position", () => {
  const settings = (mode: WormholesPerSlice): DraftSettings => ({
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
      wormholesPerSlice: mode,
      // Only the front position (toward Mecatol).
      wormholePositions: [false, true, false],
      mecatolPathSystemIndices: draftConfig.heisen.mecatolPathSystemIndices,
    },
  });
  for (const mode of ["atLeastOne", "exactlyOne"] as const) {
    for (let i = 0; i < 5; i++) {
      const result = generateHeisenMap(settings(mode), [...basePok])!;
      expect(result.valid).toBe(true);
      expectRequiredOnSelected(result.slices, [false, true, false], mode);
    }
  }
}, 60_000);

test("no selected position fails like other impossible settings", () => {
  const slices = generateMiltySlices(
    6,
    [...basePok],
    miltyConfig("atLeastOne", [false, false, false, false, false]),
  );
  expect(slices).toBeUndefined();
}, 60_000);
