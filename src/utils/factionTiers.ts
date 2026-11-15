// Admin-curated faction tier list (S–F), shown as small badges next to
// faction names in drafts. One shared list, stored server-side; when nothing
// is stored the default below is used. Safe to import on the client.
import type { FactionId } from "~/types";
import { allFactionIds } from "~/data/factionData";

export const TIERS = ["S", "A", "B", "C", "D", "F"] as const;
export type Tier = (typeof TIERS)[number];

/** factionId → tier. Factions that aren't listed get no badge. */
export type FactionTierList = Partial<Record<FactionId, Tier>>;

/** Badge fill per tier; text is dark on every fill, in both themes. */
export const TIER_COLORS: Record<Tier, string> = {
  S: "#ef5b5b",
  A: "#f59a3c",
  B: "#ecc94b",
  C: "#5fc77a",
  D: "#5aa6e8",
  F: "#a1a5b8",
};

/**
 * The owner's default list (base, PoK and Thunder's Edge factions).
 * To add Discordant Stars factions, add their ids to the tier arrays.
 */
export const DEFAULT_TIER_GROUPS: Record<Tier, FactionId[]> = {
  S: ["mahact", "crimson", "sol", "saar", "dws", "jolnar"],
  A: ["yssaril", "titans", "vulraith", "hacan", "naazrokha", "creuss"],
  B: ["naalu", "nekro", "empyrean", "keleres", "barony", "nomad"],
  C: ["yin", "ralnel", "l1z1x", "arborec", "bastion"],
  D: ["winnu", "muaat", "sardakk"],
  F: ["argent", "mentak", "xxcha", "firmament"],
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
 * Validates an untrusted tier list: unknown factions and tiers are rejected
 * when `strict`, dropped otherwise (for stored data from older versions).
 */
export function parseFactionTierList(
  input: unknown,
  { strict = false } = {},
): FactionTierList {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    if (strict) throw new Error("Tier list must be an object");
    return {};
  }
  const list: FactionTierList = {};
  for (const [factionId, tier] of Object.entries(input)) {
    if (tier === null || tier === undefined) continue;
    if (!knownFactions.has(factionId) || !isTier(tier)) {
      if (strict) throw new Error(`Invalid tier for ${factionId}`);
      continue;
    }
    list[factionId as FactionId] = tier;
  }
  return list;
}
