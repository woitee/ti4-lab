import { eq, sql } from "drizzle-orm";
import { db } from "./config.server";
import { factionTierList } from "./schema.server";
import {
  DEFAULT_FACTION_TIERS,
  parseFactionTierList,
  type FactionTierList,
} from "~/utils/factionTiers";

const ROW_ID = 1;

export type StoredFactionTiers = {
  tiers: FactionTierList;
  /** False while the built-in default is in use (nothing saved yet). */
  customized: boolean;
  updatedAt: string | null;
};

export async function getStoredFactionTiers(): Promise<StoredFactionTiers> {
  const rows = await db
    .select()
    .from(factionTierList)
    .where(eq(factionTierList.id, ROW_ID))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return { tiers: DEFAULT_FACTION_TIERS, customized: false, updatedAt: null };
  }
  let data: unknown;
  try {
    data = JSON.parse(row.data);
  } catch {
    data = {};
  }
  return {
    tiers: parseFactionTierList(data),
    customized: true,
    updatedAt: row.updatedAt,
  };
}

export async function saveFactionTiers(tiers: FactionTierList) {
  const data = JSON.stringify(tiers);
  await db
    .insert(factionTierList)
    .values({ id: ROW_ID, data })
    .onConflictDoUpdate({
      target: factionTierList.id,
      set: { data, updatedAt: sql`CURRENT_TIMESTAMP` },
    });
}

/** Drops the saved list, so the built-in default applies again. */
export async function resetFactionTiers() {
  await db.delete(factionTierList).where(eq(factionTierList.id, ROW_ID));
}
