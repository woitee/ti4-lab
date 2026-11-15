import type { Draft } from "~/types";

const DRAFT_PRESET_KEYS = [
  "settings",
  "slices",
  "presetMap",
  "availableFactions",
  "availableMinorFactions",
  "availableReferenceCardPacks",
] as const;

/** The subset of a draft that is persisted in a preset. */
export type DraftPresetData = Pick<Draft, (typeof DRAFT_PRESET_KEYS)[number]>;

export function draftToPresetData(draft: DraftPresetData): DraftPresetData {
  return Object.fromEntries(
    DRAFT_PRESET_KEYS.map((key) => [key, draft[key]]),
  ) as DraftPresetData;
}

/** Error message when a preset is started with the wrong number of players. */
export function presetPlayerCountError(
  preset: { name: string; playerCount: number },
  playerCount: number,
): string | undefined {
  if (playerCount === preset.playerCount) return undefined;
  return `Preset "${preset.name}" was saved for ${preset.playerCount} players, but ${playerCount} were provided.`;
}

/** The setup page's "Draft rules" that override a preset's own. */
export type SetupDraftRules = {
  banFactions: boolean;
  draftSpeaker: boolean;
  draftPlayerColors: boolean;
};

/**
 * Applies the setup page's draft rules to a preset's data. Twilight's Fall
 * presets have no such rules and are returned unchanged. A ban phase wins over
 * a preset's fixed faction pool: factions are rolled after the bans instead,
 * reported as `droppedFixedFactions`.
 */
export function applySetupDraftRules<T extends Pick<DraftPresetData, "settings">>(
  data: T,
  rules: SetupDraftRules,
  keepFactions: boolean,
): { data: T; droppedFixedFactions: boolean } {
  const { settings } = data;
  if (settings.draftGameMode === "twilightsFall") {
    return { data, droppedFixedFactions: false };
  }

  // Bans can't be combined with a shared minor faction pool (as on setup).
  const sharedMinorPool =
    settings.minorFactionsInSharedPool ||
    settings.minorFactionsMode?.mode === "sharedPool";
  const banFactions = rules.banFactions && !sharedMinorPool;
  const { banFactions: _, ...otherModifiers } = settings.modifiers ?? {};
  const modifiers = banFactions
    ? { ...otherModifiers, banFactions: { numFactions: 1 } }
    : otherModifiers;

  return {
    data: {
      ...data,
      settings: {
        ...settings,
        draftSpeaker: rules.draftSpeaker,
        draftPlayerColors: rules.draftPlayerColors,
        modifiers: Object.keys(modifiers).length > 0 ? modifiers : undefined,
      },
    },
    droppedFixedFactions:
      banFactions && keepFactions && !settings.modifiers?.banFactions,
  };
}
