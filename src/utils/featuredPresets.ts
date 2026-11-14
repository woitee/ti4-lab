import { MAPS } from "~/routes/draft/prechoice/-maps";

export const FEATURED_TITLE_MAX_LENGTH = 80;
export const FEATURED_DESCRIPTION_MAX_LENGTH = 300;

/** Human name of a preset's draft format, e.g. "Milty EQ 4p" or "Preset map". */
export function draftFormatLabel(
  draftType: string | null,
  gameMode: string | null,
): string {
  if (gameMode === "presetMap") return "Preset map";
  const typeTitle =
    (draftType && MAPS[draftType as keyof typeof MAPS]?.title) ??
    draftType ??
    "Draft";
  return gameMode === "twilightsFall"
    ? `${typeTitle} · Twilight's Fall`
    : typeTitle;
}

/** Presets for the chosen player count, or all of them. */
export function filterFeaturedPresets<T extends { playerCount: number }>(
  presets: T[],
  playerCount: number,
  showAll: boolean,
): T[] {
  return showAll
    ? presets
    : presets.filter((preset) => preset.playerCount === playerCount);
}
