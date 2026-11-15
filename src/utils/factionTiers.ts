// Admin-curated faction tier list (S–F), shown as small badges next to
// faction names in drafts. One shared list, stored server-side; when nothing
// is stored the default below is used. Safe to import on the client.
import type { FactionId } from "~/types";
import { allFactionIds } from "~/data/factionData";

export const TIERS = ["S+", "S", "A", "B", "C", "D", "F"] as const;
export type Tier = (typeof TIERS)[number];

/** factionId → tier. Factions that aren't listed get no badge. */
export type FactionTierList = Partial<Record<FactionId, Tier>>;

/**
 * What's stored: factionId → tier, or null for an explicit "no tier".
 * Factions not mentioned at all fall back to the code default, so factions
 * added to the default later reach lists saved before them.
 */
export type StoredTierList = Partial<Record<FactionId, Tier | null>>;

/**
 * Badge fill (a CSS background) per tier; text is dark on every fill, in
 * both themes. S+ is the meme tier: a pink-to-gold gradient.
 */
export const TIER_COLORS: Record<Tier, string> = {
  "S+": "linear-gradient(135deg, #ff7ab6 0%, #ffb35c 55%, #ffe27a 100%)",
  S: "#ef5b5b",
  A: "#f59a3c",
  B: "#ecc94b",
  C: "#5fc77a",
  D: "#5aa6e8",
  F: "#a1a5b8",
};

/**
 * The owner's default list: base, PoK, Thunder's Edge and Discordant Stars
 * (DS from .claude/analysis/ds-tiers.md). Yssaril is S+ for memes.
 */
export const DEFAULT_TIER_GROUPS: Record<Tier, FactionId[]> = {
  "S+": ["yssaril"],
  S: [
    "mahact", "crimson", "sol", "saar", "dws", "jolnar",
    "edyn", "bentor", "nivyn", "kollecc", "veldyr",
  ],
  A: ["titans", "vulraith", "hacan", "naazrokha", "creuss", "khrask", "olradin", "ilyxum"],
  B: [
    "naalu", "nekro", "empyrean", "keleres", "barony", "nomad",
    "mirveda", "rhodun", "vaden", "axis", "kjalengard", "gledge", "rohdina",
    "lanefir", "cheiran", "lizho",
  ],
  C: [
    "yin", "ralnel", "l1z1x", "arborec", "bastion",
    "myko", "tnelis", "freesystems", "vaylerian", "florzen",
  ],
  D: [
    "winnu", "muaat", "sardakk",
    "celdauri", "mortheus", "ghoti", "zelian", "kolume", "kortali", "dihmohn",
  ],
  F: ["argent", "mentak", "xxcha", "firmament", "nokar", "cymiae", "ghemina", "kyro"],
};

export function tierListFromGroups(
  groups: Partial<Record<Tier, FactionId[]>>,
): FactionTierList {
  const list: FactionTierList = {};
  for (const tier of TIERS) {
    for (const id of groups[tier] ?? []) list[id] = tier;
  }
  return list;
}

export const DEFAULT_FACTION_TIERS: FactionTierList =
  tierListFromGroups(DEFAULT_TIER_GROUPS);

const knownFactions = new Set<string>(allFactionIds);
const isTier = (value: unknown): value is Tier =>
  typeof value === "string" && (TIERS as readonly string[]).includes(value);

/**
 * Validates an untrusted stored tier list (null = explicit "no tier").
 * Unknown factions and tiers are rejected when `strict`, dropped otherwise
 * (for stored data from older versions).
 */
export function parseStoredTierList(
  input: unknown,
  { strict = false } = {},
): StoredTierList {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    if (strict) throw new Error("Tier list must be an object");
    return {};
  }
  const list: StoredTierList = {};
  for (const [factionId, tier] of Object.entries(input)) {
    if (tier === undefined) continue;
    if (!knownFactions.has(factionId) || (tier !== null && !isTier(tier))) {
      if (strict) throw new Error(`Invalid tier for ${factionId}`);
      continue;
    }
    list[factionId as FactionId] = tier;
  }
  return list;
}

/** The effective list: the code default, overridden by what's stored. */
export function resolveTierList(stored: StoredTierList): FactionTierList {
  const list: FactionTierList = { ...DEFAULT_FACTION_TIERS };
  for (const [id, tier] of Object.entries(stored) as [FactionId, Tier | null][]) {
    if (tier) list[id] = tier;
    else delete list[id];
  }
  return list;
}

/** What admin saves: every known faction, with null for "no tier". */
export function toStoredTierList(list: FactionTierList): StoredTierList {
  const stored: StoredTierList = {};
  for (const id of allFactionIds) stored[id] = list[id] ?? null;
  return stored;
}
