import { describe, expect, it } from "vitest";
import type { DraftSettings, FactionId } from "~/types";
import { getFactionPool } from "~/utils/factions";
import {
  applySetupDraftRules,
  type DraftPresetData,
  type SetupDraftRules,
} from "./draftPreset";

const PLAYERS = 6;
const fixedFactions = getFactionPool(["base", "pok"]).slice(0, 6) as FactionId[];

const preset = (overrides: Partial<DraftSettings> = {}): DraftPresetData => ({
  settings: {
    type: "milty",
    factionGameSets: ["base", "pok"],
    numFactions: 6,
    draftSpeaker: false,
    draftPlayerColors: false,
    ...overrides,
  } as DraftSettings,
  slices: [],
  presetMap: [],
  availableFactions: fixedFactions,
});

const rules = (overrides: Partial<SetupDraftRules> = {}): SetupDraftRules => ({
  banFactions: false,
  draftSpeaker: false,
  draftPlayerColors: false,
  preassignedFactions: undefined,
  ...overrides,
});

const apply = (
  data: DraftPresetData,
  setup: SetupDraftRules | undefined,
  keepFactions = true,
) => applySetupDraftRules(data, setup, keepFactions, PLAYERS);

describe("applySetupDraftRules", () => {
  it("leaves the preset alone when the setup shows no draft rules", () => {
    const data = preset({ draftSpeaker: true });
    expect(apply(data, undefined)).toEqual({
      data,
      droppedFixedFactions: undefined,
    });
  });

  it("adds a ban phase to a preset saved without one", () => {
    const { data, droppedFixedFactions } = apply(
      preset(),
      rules({ banFactions: true }),
      false,
    );
    expect(data.settings.modifiers).toEqual({ banFactions: { numFactions: 1 } });
    expect(droppedFixedFactions).toBeUndefined();
  });

  it("removes a preset's ban phase when the setup has none", () => {
    const { data } = apply(
      preset({ modifiers: { banFactions: { numFactions: 1 } } }),
      rules(),
    );
    expect(data.settings.modifiers).toBeUndefined();
  });

  it("drops a fixed faction pool when the ban phase is on", () => {
    const { droppedFixedFactions, data } = apply(
      preset(),
      rules({ banFactions: true }),
    );
    expect(droppedFixedFactions).toBe("ban");
    expect(data.settings.modifiers?.banFactions).toBeDefined();
  });

  it("keeps a fixed faction pool without a ban phase or bags", () => {
    const { data, droppedFixedFactions } = apply(preset(), rules());
    expect(droppedFixedFactions).toBeUndefined();
    expect(data.availableFactions).toEqual(fixedFactions);
  });

  it("overrides draft speaker and player colors, keeping other settings", () => {
    const { data } = apply(
      preset({ numFactions: 9 }),
      rules({ draftSpeaker: true, draftPlayerColors: true }),
    );
    expect(data.settings).toMatchObject({
      numFactions: 9,
      draftSpeaker: true,
      draftPlayerColors: true,
    });
  });

  it("leaves Twilight's Fall presets alone", () => {
    const data = preset({ draftGameMode: "twilightsFall" });
    expect(apply(data, rules({ banFactions: true }))).toEqual({
      data,
      droppedFixedFactions: undefined,
    });
  });

  it("skips the ban phase with a shared minor faction pool", () => {
    const { data, droppedFixedFactions } = apply(
      preset({ minorFactionsMode: { mode: "sharedPool" } }),
      rules({ banFactions: true, preassignedFactions: 2 }),
    );
    expect(data.settings.modifiers).toBeUndefined();
    expect(data.settings.numPreassignedFactions).toBeUndefined();
    expect(droppedFixedFactions).toBeUndefined();
  });

  describe("faction bags", () => {
    it("re-rolls a fixed pool that doesn't fill the bags", () => {
      const { data, droppedFixedFactions } = apply(
        preset(),
        rules({ preassignedFactions: 2 }),
      );
      expect(data.settings.numPreassignedFactions).toBe(2);
      expect(data.settings.numFactions).toBe(12);
      expect(new Set(data.availableFactions).size).toBe(12);
      expect(droppedFixedFactions).toBe("bags");
    });

    it("keeps a fixed pool that already fills the bags", () => {
      const { data, droppedFixedFactions } = apply(
        preset(),
        rules({ preassignedFactions: 1 }),
      );
      expect(data.settings.numPreassignedFactions).toBe(1);
      expect(data.availableFactions).toEqual(fixedFactions);
      expect(droppedFixedFactions).toBeUndefined();
    });

    it("re-rolls a re-rolled preset's pool without a notice", () => {
      const { data, droppedFixedFactions } = apply(
        preset(),
        rules({ preassignedFactions: 3 }),
        false,
      );
      expect(data.availableFactions).toHaveLength(18);
      expect(droppedFixedFactions).toBeUndefined();
    });

    it("turns off a preset's bags when the setup has none", () => {
      const { data } = apply(
        preset({ numPreassignedFactions: 2, numFactions: 12 }),
        rules(),
      );
      expect(data.settings.numPreassignedFactions).toBeUndefined();
      expect(data.settings.numFactions).toBe(12);
    });

    it("with a ban phase, sizes the post-ban pool for the bags", () => {
      const { data, droppedFixedFactions } = apply(
        preset(),
        rules({ banFactions: true, preassignedFactions: 2 }),
      );
      expect(data.settings.numFactions).toBe(12);
      expect(data.settings.numPreassignedFactions).toBe(2);
      // The pool is rolled after the bans, so no re-roll now.
      expect(data.availableFactions).toEqual(fixedFactions);
      expect(droppedFixedFactions).toBe("ban");
    });

    it("skips bags that don't fit the faction pool", () => {
      const { data } = apply(preset(), rules({ preassignedFactions: 20 }));
      expect(data.settings.numPreassignedFactions).toBeUndefined();
      expect(data.availableFactions).toEqual(fixedFactions);
    });

    it("skips bags on preset map drafts", () => {
      const { data } = apply(
        preset({ draftGameMode: "presetMap" }),
        rules({ preassignedFactions: 2 }),
      );
      expect(data.settings.numPreassignedFactions).toBeUndefined();
    });
  });
});
