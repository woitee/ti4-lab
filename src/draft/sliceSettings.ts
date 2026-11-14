// Slice generation settings: types and per-format defaults. Pure data, no UI, so the server-side generators can import it.
import { DEFAULT_SLICE_VALUE_MODIFIERS } from "~/stats";
import type { WormholesPerSlice } from "~/draft/types";

export type SliceSettingsFormatType = "milty" | "miltyeq" | "heisen";

export interface SliceGenerationSettings {
  minSliceValue?: number;
  maxSliceValue?: number;
  /** Planets per slice (all systems in the slice); undefined = no limit. */
  minPlanets?: number;
  maxPlanets?: number;
  minOptimalInfluence?: number;
  minOptimalResources?: number;

  safePathToMecatol: number;
  centerTileNotEmpty: number;
  highQualityAdjacent: number;
  minAlphaWormholes: number;
  minBetaWormholes: number;
  minLegendaries: number;
  maxLegendaries?: number;
  /** Undefined = "any". */
  wormholesPerSlice?: WormholesPerSlice;
  /**
   * Where the wormhole required by wormholesPerSlice must be, per slice
   * position (index order of SLICE_POSITIONS); false = not selected,
   * missing = selected. Ignored when wormholesPerSlice is "any".
   */
  wormholePositions?: boolean[];

  // Slice value modifiers
  entropicScarValue: number;
  techValue: number;
  hopesEndValue: number;
  emelparValue: number;
  industrexValue: number;
  otherLegendaryValue: number;
  tradeStationValue: number;
  equidistantMultiplier: number;
  supernovaOnPathPenalty: number;
  nebulaOnPathPenalty: number;
}

/**
 * The positions of a slice, in the order the generators store slice systems.
 * x/y are the axial offsets from the home system (the formats'
 * `seatTilePositions`). Seat variants that push tiles forward (7p seat 3)
 * keep this order, so a setting applies to the same role there.
 */
export const SLICE_POSITIONS: Record<
  SliceSettingsFormatType,
  { label: string; x: number; y: number }[]
> = {
  milty: [
    { label: "Left", x: -1, y: 0 },
    { label: "Front", x: 0, y: -1 },
    { label: "Right", x: 1, y: -1 },
    { label: "Left equidistant", x: -1, y: -1 },
    { label: "Front far", x: 0, y: -2 },
  ],
  miltyeq: [
    { label: "Left", x: -1, y: 0 },
    { label: "Front", x: 0, y: -1 },
    { label: "Right", x: 1, y: -1 },
    { label: "Front far", x: 0, y: -2 },
  ],
  heisen: [
    { label: "Left", x: -1, y: 0 },
    { label: "Front", x: 0, y: -1 },
    { label: "Right", x: 1, y: -1 },
  ],
};

export const DEFAULT_SLICE_SETTINGS: Record<
  SliceSettingsFormatType,
  SliceGenerationSettings
> = {
  milty: {
    minOptimalInfluence: 4,
    minOptimalResources: 3,
    minSliceValue: 9,
    maxSliceValue: 13,
    safePathToMecatol: 0,
    centerTileNotEmpty: 0,
    highQualityAdjacent: 0,
    minAlphaWormholes: 2,
    minBetaWormholes: 2,
    minLegendaries: 1,
    maxLegendaries: 3,
    ...DEFAULT_SLICE_VALUE_MODIFIERS,
  },
  miltyeq: {
    minOptimalInfluence: 3,
    minOptimalResources: 2,
    minSliceValue: 6,
    maxSliceValue: 10,
    safePathToMecatol: 0,
    centerTileNotEmpty: 0,
    highQualityAdjacent: 0,
    minAlphaWormholes: 2,
    minBetaWormholes: 2,
    minLegendaries: 1,
    maxLegendaries: 3,
    ...DEFAULT_SLICE_VALUE_MODIFIERS,
  },
  heisen: {
    minOptimalInfluence: 0,
    minOptimalResources: 0,
    minSliceValue: 4,
    maxSliceValue: 10,
    minPlanets: 2,
    maxPlanets: 5,
    safePathToMecatol: 0,
    centerTileNotEmpty: 0,
    highQualityAdjacent: 0,
    minAlphaWormholes: 0,
    minBetaWormholes: 0,
    minLegendaries: 0,
    maxLegendaries: undefined,
    ...DEFAULT_SLICE_VALUE_MODIFIERS,
  },
};
