import { getRouteApi } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import type { DraftSettings, DiscordData } from "~/types";
import type {
  SliceGenerationSettings,
  SliceSettingsFormatType,
} from "~/draft/sliceSettings";
import { useEffect, useState } from "react";
import { DEFAULT_SLICE_SETTINGS } from "~/draft/sliceSettings";
import {
  DEFAULT_REMEMBERED_SETUP,
  rememberedSetupOf,
  useDraftSetup,
} from "./-store";
import {
  clearRememberedState,
  readRememberedState,
  writeRememberedState,
  type RememberedState,
  type SliceSettingsByFormat,
} from "./-persist";
import { buildSliceGenerationConfig } from "./-utils";
import { decodeSeededMapData } from "~/mapgen/utils/mapToDraft";
import { createMultiDraft } from "~/server/drafts.functions";
import type { SetupSliceSettings } from "../new/-handoff";
import { notify } from "~/ui";

const prechoiceRoute = getRouteApi("/draft/prechoice");

export const useDraftSettingsBuilder = (
  sliceSettings: Record<SliceSettingsFormatType, SliceGenerationSettings>,
) => {
  const content = useDraftSetup((state) => state.content);
  const map = useDraftSetup((state) => state.map);
  const faction = useDraftSetup((state) => state.faction);
  const slices = useDraftSetup((state) => state.slices);
  const format = useDraftSetup((state) => state.format);

  const buildDraftSettings = (): DraftSettings => {
    const factionGameSets = content.getFactionGameSets();
    const tileGameSets = content.getTileGameSets();
    const hasMinorFactions = !!faction.minorFactionsMode;

    const draftSettings: DraftSettings = {
      factionGameSets,
      tileGameSets,
      type: map.selectedMapType,
      numFactions: faction.numFactions,
      randomizeMap: !faction.minorFactionsMode,
      numPreassignedFactions: faction.preassignedFactions,
      minorFactionsMode: faction.minorFactionsMode,
      numSlices: Number(slices.numSlices),
      randomizeSlices: true,
      draftSpeaker: format.draftSpeaker,
      showMonumentImagesInFactionInfo: format.showMonumentImagesInFactionInfo,
      allowHomePlanetSearch: format.allowHomePlanetSearch,
      allowEmptyTiles: format.allowEmptyTiles,
      draftPlayerColors: format.draftPlayerColors,
      modifiers: format.banFactions
        ? { banFactions: { numFactions: 1 } }
        : undefined,
      allowedFactions: faction.allowedFactions,
      requiredFactions: faction.requiredFactions,
      factionStratification: faction.stratifiedConfig,
    };

    const sliceConfig = buildSliceGenerationConfig(
      map.selectedMapType,
      sliceSettings,
      hasMinorFactions,
    );

    if (sliceConfig) {
      draftSettings.sliceGenerationConfig = sliceConfig;
    }

    if (faction.minorFactionsMode?.mode === "sharedPool") {
      draftSettings.minorFactionsInSharedPool = true;
    } else if (faction.minorFactionsMode?.mode === "separatePool") {
      draftSettings.numMinorFactions =
        faction.minorFactionsMode.numMinorFactions;
    }

    return draftSettings;
  };

  return { buildDraftSettings };
};

export const useDraftNavigation = (discordData?: DiscordData) => {
  const navigate = prechoiceRoute.useNavigate();
  const mapSlicesString = prechoiceRoute.useSearch({ select: (s) => s.mapSlices });
  const multiDraft = useMutation({
    mutationFn: createMultiDraft,
    onError: (error) =>
      notify({
        tone: "danger",
        title: "Could not create the drafts",
        message: error instanceof Error ? error.message : String(error),
      }),
  });
  const player = useDraftSetup((state) => state.player);
  const multidraft = useDraftSetup((state) => state.multidraft);
  const map = useDraftSetup((state) => state.map);

  /** setupSliceSettings: the page's slice settings, restored if this fails. */
  const navigateToDraft = (
    draftSettings: DraftSettings,
    setupSliceSettings?: SetupSliceSettings,
  ) => {
    // Check if we have seeded map data in URL params AND it's compatible with selected map type
    let finalDraftSettings = draftSettings;

    if (mapSlicesString) {
      const seededData = decodeSeededMapData(mapSlicesString);
      // Only use seeded data if the current map type is compatible
      if (
        seededData &&
        seededData.compatibleDraftTypes.includes(map.selectedMapType)
      ) {
        finalDraftSettings = {
          ...draftSettings,
          randomizeSlices: false, // Use pre-seeded slices instead of generating
          presetSlices: seededData.slices,
          presetMap: seededData.presetMap,
        };
      }
    }

    if (multidraft.isMultidraft) {
      multiDraft.mutate(
        {
          data: {
            settings: finalDraftSettings,
            players: player.players,
            discordData,
            numDrafts: multidraft.numDrafts,
          },
        },
        {
          onSuccess: (result) => {
            if ("sliceSearchFailure" in result) {
              // Same notice as a single draft that can't be generated.
              navigate({
                to: "/draft/prechoice",
                search: (prev) => prev,
                state: {
                  invalidDraftParameters: true,
                  sliceSearchFailure: result.sliceSearchFailure,
                  failedDraftSettings: finalDraftSettings,
                  setupSliceSettings,
                },
                replace: true,
              });
              return;
            }
            navigate({
              to: "/multidraft/$id",
              params: { id: result.prettyUrl },
            });
          },
        },
      );
      return;
    }

    navigate({
      to: "/draft/new",
      state: {
        newDraft: {
          draftSettings: finalDraftSettings,
          players: player.players,
          discordData,
          setupSliceSettings,
        },
      },
    });
  };

  return { navigateToDraft };
};

const REMEMBERED_DEFAULTS: RememberedState = {
  setup: DEFAULT_REMEMBERED_SETUP,
  sliceSettings: DEFAULT_SLICE_SETTINGS,
};

/**
 * Restores the setup remembered in this browser after mount (so server and
 * client render the same defaults first), then saves every change.
 * Returns a function that forgets the remembered setup and resets to defaults.
 */
export const useRememberedSetup = (
  sliceSettings: SliceSettingsByFormat,
  setSliceSettings: (settings: SliceSettingsByFormat) => void,
  /** Slice settings handed back from a failed attempt win over storage. */
  keepSliceSettings: boolean,
) => {
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const saved = readRememberedState(REMEMBERED_DEFAULTS);
    if (saved) {
      useDraftSetup.getState().restoreRememberedSetup(saved.setup);
      if (!keepSliceSettings) setSliceSettings(saved.sliceSettings);
    }
    setRestored(true);
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!restored) return;
    const save = () =>
      writeRememberedState(
        {
          setup: rememberedSetupOf(useDraftSetup.getState()),
          sliceSettings,
        },
        REMEMBERED_DEFAULTS,
      );
    save();
    return useDraftSetup.subscribe(save);
  }, [restored, sliceSettings]);

  const resetToDefaults = () => {
    clearRememberedState();
    useDraftSetup.getState().restoreRememberedSetup(DEFAULT_REMEMBERED_SETUP);
    setSliceSettings(DEFAULT_SLICE_SETTINGS);
  };

  return { resetToDefaults };
};
