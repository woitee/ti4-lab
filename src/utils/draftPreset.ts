import {
  getDraftableFactions,
  getTakenNonPrimaryFactions,
  randomizeFactions,
} from "~/draft/buildInitialDraft";
import { getFactionPool } from "~/utils/factions";
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
  /** Faction bag size per player; undefined when faction bags are off. */
  preassignedFactions: number | undefined;
};

/** Why a preset's fixed faction pool was dropped, if it was. */
export type DroppedFixedFactions = "ban" | "bags" | undefined;

/**
 * Applies the setup page's draft rules to a preset's data. Rules are only
 * given on "Base draft", where the setup shows them. Twilight's Fall
 * presets have no such rules and are returned unchanged. The setup's rules
 * win over a preset's fixed faction pool: with a ban phase factions are rolled
 * after the bans; with faction bags of a size the pool doesn't match, factions
 * are re-rolled to fill the bags. `droppedFixedFactions` says which happened.
 */
export function applySetupDraftRules(
  data: DraftPresetData,
  /** Undefined when the setup page doesn't show its draft rules. */
  rules: SetupDraftRules | undefined,
  keepFactions: boolean,
  playerCount: number,
): { data: DraftPresetData; droppedFixedFactions: DroppedFixedFactions } {
  const { settings } = data;
  if (!rules || settings.draftGameMode === "twilightsFall") {
    return { data, droppedFixedFactions: undefined };
  }

  // Bans and bags can't be combined with a shared minor faction pool (as on setup).
  const sharedMinorPool =
    settings.minorFactionsInSharedPool ||
    settings.minorFactionsMode?.mode === "sharedPool";
  const banFactions = rules.banFactions && !sharedMinorPool;
  const { banFactions: _, ...otherModifiers } = settings.modifiers ?? {};
  const modifiers = banFactions
    ? { ...otherModifiers, banFactions: { numFactions: 1 } }
    : otherModifiers;

  // Bags need bagSize factions per player, within the faction pool and at
  // least the stratification total (otherwise setup turns bags off too).
  // Preset map drafts never deal bags.
  const factionPool = getDraftableFactions(
    getFactionPool(settings.factionGameSets),
    getTakenNonPrimaryFactions(data),
    settings.allowedFactions,
  );
  const stratifiedTotal = Object.values(
    settings.factionStratification ?? {},
  ).reduce((sum, n) => sum + n, 0);
  const bagSize =
    rules.preassignedFactions !== undefined &&
    !sharedMinorPool &&
    settings.draftGameMode !== "presetMap" &&
    rules.preassignedFactions * playerCount <= factionPool.length &&
    rules.preassignedFactions * playerCount >= stratifiedTotal
      ? rules.preassignedFactions
      : undefined;
  const numFactions =
    bagSize !== undefined ? bagSize * playerCount : settings.numFactions;

  const newSettings = {
    ...settings,
    draftSpeaker: rules.draftSpeaker,
    draftPlayerColors: rules.draftPlayerColors,
    modifiers: Object.keys(modifiers).length > 0 ? modifiers : undefined,
    numPreassignedFactions: bagSize,
    numFactions,
  };

  // A ban phase re-rolls the pool after the bans anyway; otherwise bags must
  // be dealt from a pool of exactly the right size.
  const rerollForBags =
    bagSize !== undefined &&
    !banFactions &&
    data.availableFactions.length !== numFactions;
  const availableFactions = rerollForBags
    ? randomizeFactions(
        numFactions,
        factionPool,
        settings.requiredFactions,
        settings.factionStratification,
      )
    : data.availableFactions;

  const hadBans = !!settings.modifiers?.banFactions;
  return {
    data: { ...data, settings: newSettings, availableFactions },
    droppedFixedFactions: !keepFactions
      ? undefined
      : banFactions && !hadBans
        ? "ban"
        : rerollForBags
          ? "bags"
          : undefined,
  };
}
