import { v4 as uuidv4 } from "uuid";
import { asc, count, eq } from "drizzle-orm";
import { db } from "./config.server";
import { draftPresets, hubSliceSets } from "./schema.server";
import type { DraftPresetData } from "~/utils/draftPreset";

export type DraftPreset = {
  id: string;
  name: string;
  data: DraftPresetData;
  keepFactions: boolean;
  playerCount: number;
  createdAt: string;
};

type Row = typeof draftPresets.$inferSelect;

function rowToPreset(row: Row): DraftPreset {
  return {
    id: row.id,
    name: row.name,
    data: JSON.parse(row.data) as DraftPresetData,
    keepFactions: row.keepFactions,
    playerCount: row.playerCount,
    createdAt: row.createdAt,
  };
}

export async function draftPresetByName(
  name: string,
): Promise<DraftPreset | undefined> {
  const rows = await db
    .select()
    .from(draftPresets)
    .where(eq(draftPresets.name, name))
    .limit(1);
  return rows[0] ? rowToPreset(rows[0]) : undefined;
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "SQLITE_CONSTRAINT_UNIQUE"
  );
}

/** Returns undefined when a preset with the same name already exists. */
export async function createDraftPreset(input: {
  name: string;
  keepFactions: boolean;
  playerCount: number;
  data: DraftPresetData;
}): Promise<DraftPreset | undefined> {
  try {
    const rows = await db
      .insert(draftPresets)
      .values({
        id: uuidv4(),
        name: input.name,
        data: JSON.stringify(input.data),
        keepFactions: input.keepFactions,
        playerCount: input.playerCount,
      })
      .returning();
    return rowToPreset(rows[0]);
  } catch (error) {
    if (isUniqueConstraintError(error)) return undefined;
    throw error;
  }
}

/** Draft type and mode of a preset, read from its saved settings. */
function presetFormat(data: string) {
  try {
    const parsed = JSON.parse(data) as Partial<DraftPresetData>;
    return {
      draftType: parsed.settings?.type ?? null,
      gameMode: parsed.settings?.draftGameMode ?? null,
    };
  } catch {
    return { draftType: null, gameMode: null };
  }
}

export type AdminDraftPresetListing = {
  id: string;
  name: string;
  playerCount: number;
  keepFactions: boolean;
  createdAt: string;
  featured: boolean;
  title: string | null;
  description: string | null;
  sortOrder: number;
  draftType: string | null;
  gameMode: string | null;
  /** Hub slice sets that point at this preset (they block deleting it). */
  hubUses: number;
};

export async function listDraftPresetsForAdmin(): Promise<
  AdminDraftPresetListing[]
> {
  const uses = await db
    .select({ presetId: hubSliceSets.presetId, uses: count() })
    .from(hubSliceSets)
    .groupBy(hubSliceSets.presetId);
  const usesById = new Map(uses.map((row) => [row.presetId, row.uses]));

  const rows = await db.select().from(draftPresets);
  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      playerCount: row.playerCount,
      keepFactions: row.keepFactions,
      createdAt: row.createdAt,
      featured: row.featured,
      title: row.title,
      description: row.description,
      sortOrder: row.sortOrder,
      ...presetFormat(row.data),
      hubUses: usesById.get(row.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        Number(b.featured) - Number(a.featured) ||
        (a.featured ? a.sortOrder - b.sortOrder : 0) ||
        b.createdAt.localeCompare(a.createdAt),
    );
}

/** What anyone may see about a featured preset. */
export type FeaturedDraftPreset = {
  id: string;
  title: string;
  description: string;
  playerCount: number;
  keepFactions: boolean;
  draftType: string | null;
  gameMode: string | null;
};

export async function listFeaturedDraftPresets(): Promise<
  FeaturedDraftPreset[]
> {
  const rows = await db
    .select()
    .from(draftPresets)
    .where(eq(draftPresets.featured, true))
    .orderBy(asc(draftPresets.sortOrder), asc(draftPresets.createdAt));
  return rows.map((row) => ({
    id: row.id,
    title: row.title?.trim() || row.name,
    description: row.description?.trim() ?? "",
    playerCount: row.playerCount,
    keepFactions: row.keepFactions,
    ...presetFormat(row.data),
  }));
}

/** Returns the preset only when it is featured. */
export async function featuredDraftPresetById(
  id: string,
): Promise<DraftPreset | undefined> {
  const rows = await db
    .select()
    .from(draftPresets)
    .where(eq(draftPresets.id, id))
    .limit(1);
  const row = rows[0];
  return row?.featured ? rowToPreset(row) : undefined;
}

export type DraftPresetFeatureInput = {
  featured: boolean;
  title: string | null;
  description: string | null;
  sortOrder: number;
};

/** Returns false when no preset has that id. */
export async function updateDraftPresetFeature(
  id: string,
  input: DraftPresetFeatureInput,
): Promise<boolean> {
  const rows = await db
    .update(draftPresets)
    .set({
      featured: input.featured,
      title: input.title,
      description: input.description,
      sortOrder: input.sortOrder,
    })
    .where(eq(draftPresets.id, id))
    .returning({ id: draftPresets.id });
  return rows.length > 0;
}

export type DeleteDraftPresetResult =
  | { ok: true }
  | { ok: false; reason: "notFound" | "usedByHubs"; hubUses?: number };

/**
 * Deletes a preset. Presets that hub slice sets point at are kept, so a hub
 * never loses a slice set without its owner knowing.
 */
export async function deleteDraftPreset(
  id: string,
): Promise<DeleteDraftPresetResult> {
  const [{ uses }] = await db
    .select({ uses: count() })
    .from(hubSliceSets)
    .where(eq(hubSliceSets.presetId, id));
  if (uses > 0) return { ok: false, reason: "usedByHubs", hubUses: uses };

  const rows = await db
    .delete(draftPresets)
    .where(eq(draftPresets.id, id))
    .returning({ id: draftPresets.id });
  return rows.length > 0 ? { ok: true } : { ok: false, reason: "notFound" };
}
