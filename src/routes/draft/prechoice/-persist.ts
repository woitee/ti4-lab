// Remembers the draft setup page's settings in the browser (localStorage), so
// the next visit starts from the owner's last choices instead of defaults.
//
// Player names and anything draft-specific (ids, seeds, Discord or seeded map
// data) are not remembered. Saved data is only trusted field by field: missing
// or invalid fields fall back to the current defaults, so settings added later
// get their defaults and old or corrupt data never crashes the page.
import type {
  FactionId,
  FactionStratification,
  MinorFactionsMode,
} from "~/types";
import type { WormholesPerSlice } from "~/draft/types";
import type {
  SliceGenerationSettings,
  SliceSettingsFormatType,
} from "~/draft/sliceSettings";

export const SETUP_STORAGE_KEY = "ti4lab:draftSetup:v1";

export type SliceSettingsByFormat = Record<
  SliceSettingsFormatType,
  SliceGenerationSettings
>;

/** The remembered part of the setup store. */
export type RememberedSetup = {
  draftMode: "base" | "twilightFalls" | "texasStyle";
  playerCount: number;
  selectedMapType: string;
  numSlices: number;
  numReferenceCardPacks: number;
  numKings: number;
  texas: { factionHandSize: number; allowRedraw: boolean };
  contentFlags: Record<string, boolean>;
  format: Record<string, boolean>;
  multidraft: { isMultidraft: boolean; numDrafts: number };
  faction: {
    numFactions: number;
    minorFactionsMode: MinorFactionsMode | undefined;
    preassignedFactions: number | undefined;
    allowedFactions: FactionId[] | undefined;
    requiredFactions: FactionId[] | undefined;
    stratifiedConfig: FactionStratification | undefined;
  };
};

export type RememberedState = {
  setup: RememberedSetup;
  sliceSettings: SliceSettingsByFormat;
};

// ---------------------------------------------------------------------------
// Field validators. Each returns the valid value, or NOPE to use the default.

const NOPE = Symbol("invalid");
type Check<T> = (v: unknown) => T | typeof NOPE;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const int =
  (min: number, max: number): Check<number> =>
  (v) =>
    typeof v === "number" && Number.isInteger(v) && v >= min && v <= max
      ? v
      : NOPE;
const num: Check<number> = (v) =>
  typeof v === "number" && Number.isFinite(v) ? v : NOPE;
const bool: Check<boolean> = (v) => (typeof v === "boolean" ? v : NOPE);
/** `null` in storage stands for undefined ("no limit", "off", ...). */
const optional =
  <T>(check: Check<T>): Check<T | undefined> =>
  (v) =>
    v === null ? undefined : check(v);
const oneOf =
  <T extends string>(...values: T[]): Check<T> =>
  (v) =>
    values.includes(v as T) ? (v as T) : NOPE;
const stringArray: Check<string[]> = (v) =>
  Array.isArray(v) && v.every((x) => typeof x === "string") ? v : NOPE;

const minorFactionsMode: Check<MinorFactionsMode> = (v) => {
  if (!isObj(v)) return NOPE;
  if (v.mode === "random" || v.mode === "sharedPool") return { mode: v.mode };
  if (v.mode === "separatePool") {
    const n = int(0, 100)(v.numMinorFactions);
    return n === NOPE ? NOPE : { mode: "separatePool", numMinorFactions: n };
  }
  return NOPE;
};

const STRATIFICATION_KEYS = ["base|pok", "te", "discordant|discordantexp"];
const stratification: Check<FactionStratification> = (v) => {
  if (!isObj(v)) return NOPE;
  const out: Record<string, number> = {};
  for (const [k, n] of Object.entries(v)) {
    if (!STRATIFICATION_KEYS.includes(k)) return NOPE;
    if (n === null || n === undefined) continue;
    if (int(0, 100)(n) === NOPE) return NOPE;
    out[k] = n as number;
  }
  return out as FactionStratification;
};

/**
 * Every slice setting field. Typed as a full Record so adding a field to
 * SliceGenerationSettings fails to compile until it's handled here.
 */
const SLICE_FIELDS: {
  [K in keyof SliceGenerationSettings]-?: Check<SliceGenerationSettings[K]>;
} = {
  minSliceValue: optional(num),
  maxSliceValue: optional(num),
  minPlanets: optional(num),
  maxPlanets: optional(num),
  maxPlanetsPerTrait: optional(num),
  minOptimalInfluence: optional(num),
  minOptimalResources: optional(num),
  safePathToMecatol: num,
  centerTileNotEmpty: num,
  highQualityAdjacent: num,
  minAlphaWormholes: num,
  minBetaWormholes: num,
  minLegendaries: num,
  maxLegendaries: optional(num),
  wormholesPerSlice: optional(
    oneOf<WormholesPerSlice>("any", "atLeastOne", "exactlyOne"),
  ),
  wormholePositions: optional((v) =>
    Array.isArray(v) && v.every((x) => typeof x === "boolean") ? v : NOPE,
  ),
  entropicScarValue: num,
  techValue: num,
  hopesEndValue: num,
  emelparValue: num,
  industrexValue: num,
  otherLegendaryValue: num,
  tradeStationValue: num,
  equidistantMultiplier: num,
  supernovaOnPathPenalty: num,
  nebulaOnPathPenalty: num,
};

/** Takes each field of `saved` that passes its check, the default otherwise. */
function mergeFields<T extends object>(
  defaults: T,
  saved: unknown,
  checks: { [K in keyof T]-?: Check<T[K]> },
): T {
  const out = { ...defaults };
  if (!isObj(saved)) return out;
  for (const key of Object.keys(checks) as (keyof T)[]) {
    if (!(key in saved)) continue;
    const value = checks[key](saved[key as string]);
    if (value !== NOPE) out[key] = value as T[keyof T];
  }
  return out;
}

const boolFields = <T extends Record<string, boolean>>(defaults: T) =>
  Object.fromEntries(Object.keys(defaults).map((k) => [k, bool])) as {
    [K in keyof T]-?: Check<boolean>;
  };

function mergeSetup(
  defaults: RememberedSetup,
  saved: unknown,
): RememberedSetup {
  const s = isObj(saved) ? saved : {};
  const top = mergeFields(defaults, s, {
    draftMode: oneOf("base", "twilightFalls", "texasStyle"),
    playerCount: int(3, 8),
    selectedMapType: (v) => (typeof v === "string" ? v : NOPE),
    numSlices: int(1, 20),
    numReferenceCardPacks: int(1, 10),
    numKings: int(1, 8),
    // Nested objects are merged below.
    texas: () => NOPE,
    contentFlags: () => NOPE,
    format: () => NOPE,
    multidraft: () => NOPE,
    faction: () => NOPE,
  });
  return {
    ...top,
    texas: mergeFields(defaults.texas, s.texas, {
      factionHandSize: int(2, 3),
      allowRedraw: bool,
    }),
    contentFlags: mergeFields(
      defaults.contentFlags,
      s.contentFlags,
      boolFields(defaults.contentFlags),
    ),
    format: mergeFields(defaults.format, s.format, boolFields(defaults.format)),
    multidraft: mergeFields(defaults.multidraft, s.multidraft, {
      isMultidraft: bool,
      numDrafts: int(1, 20),
    }),
    faction: mergeFields(defaults.faction, s.faction, {
      numFactions: int(1, 100),
      minorFactionsMode: optional(minorFactionsMode),
      preassignedFactions: optional(int(0, 100)),
      allowedFactions: optional(stringArray) as Check<FactionId[] | undefined>,
      requiredFactions: optional(stringArray) as Check<FactionId[] | undefined>,
      stratifiedConfig: optional(stratification),
    }),
  };
}

/**
 * Parses the stored JSON and merges it over `defaults`. Returns undefined when
 * nothing usable is stored (missing, corrupt or another version's shape).
 */
export function parseRememberedState(
  raw: string | null,
  defaults: RememberedState,
): RememberedState | undefined {
  if (raw === null) return undefined;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!isObj(data) || data.version !== 1) return undefined;

  const savedSlices = isObj(data.sliceSettings) ? data.sliceSettings : {};
  const sliceSettings = Object.fromEntries(
    (Object.keys(defaults.sliceSettings) as SliceSettingsFormatType[]).map(
      (format) => [
        format,
        mergeFields(
          defaults.sliceSettings[format],
          savedSlices[format],
          SLICE_FIELDS,
        ),
      ],
    ),
  ) as SliceSettingsByFormat;

  return { setup: mergeSetup(defaults.setup, data.setup), sliceSettings };
}

/** JSON for storage; undefined values are kept as null so they survive. */
export function serializeRememberedState(state: RememberedState): string {
  return JSON.stringify({ version: 1, ...state }, (_key, value) =>
    value === undefined ? null : value,
  );
}

// ---------------------------------------------------------------------------
// Storage access. Every call is guarded: blocked storage just means nothing is
// remembered.

export function readRememberedState(
  defaults: RememberedState,
): RememberedState | undefined {
  try {
    return parseRememberedState(
      window.localStorage.getItem(SETUP_STORAGE_KEY),
      defaults,
    );
  } catch {
    return undefined;
  }
}

/** Saves `state`, or clears the key when it equals the defaults. */
export function writeRememberedState(
  state: RememberedState,
  defaults: RememberedState,
) {
  try {
    const json = serializeRememberedState(state);
    if (json === serializeRememberedState(defaults)) {
      window.localStorage.removeItem(SETUP_STORAGE_KEY);
    } else {
      window.localStorage.setItem(SETUP_STORAGE_KEY, json);
    }
  } catch {
    /* storage unavailable: nothing is remembered */
  }
}

export function clearRememberedState() {
  try {
    window.localStorage.removeItem(SETUP_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
