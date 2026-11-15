import type { DiscordData, Draft, DraftSettings, Player } from "~/types";
import type { SliceSearchFailure } from "~/draft/common/sliceSearch";
import type {
  SliceGenerationSettings,
  SliceSettingsFormatType,
} from "~/draft/sliceSettings";

/** The setup page's slice settings, kept across a failed attempt. */
export type SetupSliceSettings = Record<
  SliceSettingsFormatType,
  SliceGenerationSettings
>;

/**
 * What the setup pages hand to /draft/new through history state: either
 * settings to generate a draft from, or a saved draft (preset) to restore.
 */
export type NewDraftHandoff =
  | {
      draftSettings: DraftSettings;
      players: Player[];
      discordData?: DiscordData;
      setupSliceSettings?: SetupSliceSettings;
    }
  | {
      savedDraftState: Draft;
      /** The preset's fixed factions gave way to the setup's ban phase. */
      droppedFixedFactions?: boolean;
    };

declare module "@tanstack/react-router" {
  interface HistoryState {
    newDraft?: NewDraftHandoff;
    /** Set when /draft/new bounced back because the settings couldn't build a draft. */
    invalidDraftParameters?: boolean;
    /** Why no slices could be generated, when the slice search knows. */
    sliceSearchFailure?: SliceSearchFailure;
    /** The settings that failed, for "Use closest slices". */
    failedDraftSettings?: DraftSettings;
    /** The setup page's slice settings when it failed, restored on return. */
    setupSliceSettings?: SetupSliceSettings;
  }
}
