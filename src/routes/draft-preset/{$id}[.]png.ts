import { createFileRoute } from "@tanstack/react-router";
import { pngResponse } from "~/utils/imageResponse.server";
import { featuredDraftPresetById } from "~/drizzle/draftPreset.server";
import {
  generateDraftSlicesImage,
  generatePresetDraftImage,
} from "~/skiaRendering/slicesImageGenerator.server";
import { requestPublicBaseUrl } from "~/utils/publicBaseUrl.server";
import { displayHost } from "~/utils/publicBaseUrl.shared";
import type { Draft } from "~/types";

// Preset data never changes after saving, so rendered previews are kept in
// memory. Small: only featured presets are ever rendered.
const MAX_CACHED = 40;
const cache = new Map<string, Buffer>();

/** Slice or map preview of a featured preset, for the public preset list. */
export const Route = createFileRoute("/draft-preset/{$id}.png")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const preset = await featuredDraftPresetById(params.id ?? "");
        if (!preset) return new Response("Preset not found", { status: 404 });

        let image = cache.get(preset.id);
        if (!image) {
          const draft = {
            ...preset.data,
            // Random factions differ every draft, so don't show the saved ones.
            availableFactions: preset.keepFactions
              ? preset.data.availableFactions
              : [],
            players: Array.from({ length: preset.playerCount }, (_, id) => ({
              id,
              name: "",
            })),
            selections: [],
            pickOrder: [],
            integrations: {},
          } as Draft;
          const options = {
            urlText: `${displayHost(requestPublicBaseUrl())}/draft/prechoice`,
            factionsNote: preset.keepFactions ? undefined : "Random factions",
          };
          image =
            draft.settings.draftGameMode === "presetMap"
              ? await generatePresetDraftImage(draft, preset.id, options)
              : await generateDraftSlicesImage(draft, preset.id, options);
          if (cache.size >= MAX_CACHED) {
            cache.delete(cache.keys().next().value!);
          }
          cache.set(preset.id, image);
        }

        // Short cache: un-featuring a preset should take its preview down soon.
        return pngResponse(image, "public, max-age=600");
      },
    },
  },
});
