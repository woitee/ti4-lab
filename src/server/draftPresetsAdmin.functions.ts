import { createServerFn } from "@tanstack/react-start";
import {
  deleteDraftPreset,
  listDraftPresetsForAdmin,
  updateDraftPresetFeature,
  type DraftPresetFeatureInput,
} from "~/drizzle/draftPreset.server";
import {
  FEATURED_DESCRIPTION_MAX_LENGTH,
  FEATURED_TITLE_MAX_LENGTH,
} from "~/utils/featuredPresets";
import { requireAdmin } from "./admin.functions";
import { expectRecord, expectString } from "./validate";

function optionalText(value: unknown, max: number, what: string) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`${what} must be text`);
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length > max) {
    throw new Error(`${what} must be at most ${max} characters`);
  }
  return trimmed || null;
}

/** Validates the admin's featured-preset form. */
export function parseFeatureInput(
  input: unknown,
): DraftPresetFeatureInput & { id: string } {
  const record = expectRecord(input);
  const sortOrder = record.sortOrder ?? 0;
  if (typeof sortOrder !== "number" || !Number.isInteger(sortOrder)) {
    throw new Error("Order must be a whole number");
  }
  return {
    id: expectString(record.id, "Preset ID"),
    featured: record.featured === true,
    title: optionalText(record.title, FEATURED_TITLE_MAX_LENGTH, "Title"),
    description: optionalText(
      record.description,
      FEATURED_DESCRIPTION_MAX_LENGTH,
      "Description",
    ),
    sortOrder,
  };
}

export const getAdminDraftPresets = createServerFn()
  .middleware([requireAdmin])
  .handler(async () => ({ presets: await listDraftPresetsForAdmin() }));

export const setDraftPresetFeature = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((input: DraftPresetFeatureInput & { id: string }) =>
    parseFeatureInput(input),
  )
  .handler(async ({ data: { id, ...feature } }) => {
    const updated = await updateDraftPresetFeature(id, feature);
    if (!updated) throw new Error("Preset not found");
  });

export const removeDraftPreset = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((input: { id: string }) => ({
    id: expectString(expectRecord(input).id, "Preset ID"),
  }))
  .handler(async ({ data: { id } }) => {
    const result = await deleteDraftPreset(id);
    if (result.ok) return { ok: true as const };
    return {
      ok: false as const,
      error:
        result.reason === "usedByHubs"
          ? `This preset is a slice set in ${result.hubUses} hub${result.hubUses === 1 ? "" : "s"}, so it can't be deleted.`
          : "Preset not found. It may already be deleted.",
    };
  });
