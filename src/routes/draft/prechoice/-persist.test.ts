import { describe, expect, test } from "vitest";
import { DEFAULT_SLICE_SETTINGS } from "~/draft/sliceSettings";
import {
  parseRememberedState,
  serializeRememberedState,
  type RememberedState,
} from "./-persist";
import { DEFAULT_REMEMBERED_SETUP } from "./-store";

const defaults: RememberedState = {
  setup: DEFAULT_REMEMBERED_SETUP,
  sliceSettings: DEFAULT_SLICE_SETTINGS,
};

describe("parseRememberedState", () => {
  test("nothing stored", () => {
    expect(parseRememberedState(null, defaults)).toBeUndefined();
  });

  test("corrupt or other-version data is ignored", () => {
    expect(parseRememberedState("{not json", defaults)).toBeUndefined();
    expect(parseRememberedState("42", defaults)).toBeUndefined();
    expect(parseRememberedState("null", defaults)).toBeUndefined();
    expect(
      parseRememberedState(JSON.stringify({ version: 2 }), defaults),
    ).toBeUndefined();
  });

  test("round-trips a changed setup, including undefined (no limit) values", () => {
    const state: RememberedState = {
      setup: {
        ...DEFAULT_REMEMBERED_SETUP,
        draftMode: "texasStyle",
        playerCount: 5,
        selectedMapType: "miltyeq5p",
        format: { ...DEFAULT_REMEMBERED_SETUP.format, banFactions: true },
        faction: {
          ...DEFAULT_REMEMBERED_SETUP.faction,
          minorFactionsMode: { mode: "separatePool", numMinorFactions: 5 },
          allowedFactions: ["sardakk", "arborec"],
          stratifiedConfig: { "base|pok": 3, te: 2 },
        },
      },
      sliceSettings: {
        ...DEFAULT_SLICE_SETTINGS,
        milty: {
          ...DEFAULT_SLICE_SETTINGS.milty,
          minSliceValue: 10,
          maxPlanetsPerTrait: 2,
          wormholesPerSlice: "atLeastOne",
          wormholePositions: [true, false, true, true, true],
        },
        // Default is 2..5 planets; "no limit" must survive the round trip.
        heisen: { ...DEFAULT_SLICE_SETTINGS.heisen, minPlanets: undefined },
      },
    };
    const parsed = parseRememberedState(
      serializeRememberedState(state),
      defaults,
    );
    expect(parsed).toEqual(state);
    expect(parsed?.sliceSettings.heisen.minPlanets).toBeUndefined();
  });

  test("old data: missing fields get the current defaults", () => {
    const raw = JSON.stringify({
      version: 1,
      setup: { playerCount: 4, format: { banFactions: true } },
      sliceSettings: { miltyeq: { minSliceValue: 7 } },
    });
    const parsed = parseRememberedState(raw, defaults)!;
    expect(parsed.setup).toEqual({
      ...DEFAULT_REMEMBERED_SETUP,
      playerCount: 4,
      format: { ...DEFAULT_REMEMBERED_SETUP.format, banFactions: true },
    });
    expect(parsed.sliceSettings).toEqual({
      ...DEFAULT_SLICE_SETTINGS,
      miltyeq: { ...DEFAULT_SLICE_SETTINGS.miltyeq, minSliceValue: 7 },
    });
  });

  test("invalid values fall back to defaults; unknown fields are dropped", () => {
    const raw = JSON.stringify({
      version: 1,
      setup: {
        draftMode: "chaos",
        playerCount: 42,
        numSlices: "7",
        texas: { factionHandSize: 9, allowRedraw: false },
        contentFlags: { withPokTiles: "yes", madeUp: true },
        faction: {
          minorFactionsMode: { mode: "separatePool" },
          allowedFactions: [1, 2],
          stratifiedConfig: { bogus: 1 },
        },
      },
      sliceSettings: {
        milty: { minSliceValue: "high", techValue: null, wormholesPerSlice: "lots" },
        heisen: [],
        unknownFormat: {},
      },
    });
    const parsed = parseRememberedState(raw, defaults)!;
    expect(parsed.setup).toEqual({
      ...DEFAULT_REMEMBERED_SETUP,
      texas: { ...DEFAULT_REMEMBERED_SETUP.texas, allowRedraw: false },
    });
    expect(parsed.sliceSettings).toEqual(DEFAULT_SLICE_SETTINGS);
  });
});
