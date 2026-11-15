import { describe, expect, it } from "vitest";
import type { DraftSettings } from "~/types";
import { applySetupDraftRules, type SetupDraftRules } from "./draftPreset";

const presetSettings = (overrides: Partial<DraftSettings> = {}) =>
  ({
    type: "milty",
    numFactions: 6,
    draftSpeaker: false,
    draftPlayerColors: false,
    ...overrides,
  }) as DraftSettings;

const rules = (overrides: Partial<SetupDraftRules> = {}): SetupDraftRules => ({
  banFactions: false,
  draftSpeaker: false,
  draftPlayerColors: false,
  ...overrides,
});

describe("applySetupDraftRules", () => {
  it("adds a ban phase to a preset saved without one", () => {
    const { data, droppedFixedFactions } = applySetupDraftRules(
      { settings: presetSettings() },
      rules({ banFactions: true }),
      false,
    );
    expect(data.settings.modifiers).toEqual({ banFactions: { numFactions: 1 } });
    expect(droppedFixedFactions).toBe(false);
  });

  it("removes a preset's ban phase when the setup has none", () => {
    const { data } = applySetupDraftRules(
      {
        settings: presetSettings({
          modifiers: { banFactions: { numFactions: 1 } },
        }),
      },
      rules(),
      false,
    );
    expect(data.settings.modifiers).toBeUndefined();
  });

  it("drops a fixed faction pool when the ban phase is on", () => {
    const { droppedFixedFactions, data } = applySetupDraftRules(
      { settings: presetSettings() },
      rules({ banFactions: true }),
      true,
    );
    expect(droppedFixedFactions).toBe(true);
    expect(data.settings.modifiers?.banFactions).toBeDefined();
  });

  it("keeps a fixed faction pool without a ban phase", () => {
    const preset = { settings: presetSettings(), availableFactions: ["sol"] };
    const { data, droppedFixedFactions } = applySetupDraftRules(
      preset,
      rules(),
      true,
    );
    expect(droppedFixedFactions).toBe(false);
    expect(data).toEqual(preset);
  });

  it("overrides draft speaker and player colors, keeping other settings", () => {
    const { data } = applySetupDraftRules(
      { settings: presetSettings({ numFactions: 9 }) },
      rules({ draftSpeaker: true, draftPlayerColors: true }),
      false,
    );
    expect(data.settings).toMatchObject({
      numFactions: 9,
      draftSpeaker: true,
      draftPlayerColors: true,
    });
  });

  it("leaves Twilight's Fall presets alone", () => {
    const preset = {
      settings: presetSettings({ draftGameMode: "twilightsFall" }),
    };
    const result = applySetupDraftRules(
      preset,
      rules({ banFactions: true, draftSpeaker: true }),
      true,
    );
    expect(result).toEqual({ data: preset, droppedFixedFactions: false });
  });

  it("skips the ban phase with a shared minor faction pool", () => {
    const { data, droppedFixedFactions } = applySetupDraftRules(
      { settings: presetSettings({ minorFactionsMode: { mode: "sharedPool" } }) },
      rules({ banFactions: true }),
      true,
    );
    expect(data.settings.modifiers).toBeUndefined();
    expect(droppedFixedFactions).toBe(false);
  });
});
