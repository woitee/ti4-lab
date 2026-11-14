/**
 * Slice search: builds a set of slices that meets the slice settings by
 * repairing a random start instead of drawing at random and rejecting.
 *
 * 1. Start from random slices that follow a tier pattern per slice (e.g.
 *    Milty's high/med/low/red/red).
 * 2. Repeatedly swap a tile with a tile of the same tier, either from another
 *    slice or from the unused pool, and keep the swap unless it makes the set
 *    worse. Each slice is scored in its best tile order (value depends on
 *    position: equidistant share, Mecatol path penalties), so tile order is
 *    chosen, not left to chance. The score is how far the set is from meeting
 *    the settings (0 = valid).
 * 3. Restart from a fresh random set when stuck, until a valid set is found or
 *    the time limit runs out. The closest set found is kept for the "Use
 *    closest slices" option and for the error message.
 */
import { systemData } from "~/data/systemData";
import type { System, SystemId, SystemIds } from "~/types";
import {
  buildSliceValueConfig,
  calculateSliceValue,
  DEFAULT_SLICE_VALUE_MODIFIERS,
  evaluateSystem,
  formatSliceValue,
  type SliceValueModifiers,
} from "~/stats";
import { optimalStatsForSystems } from "~/utils/map";
import { neighbors } from "../hex";
import { shuffle } from "../helpers/randomization";
import {
  countedWormholes,
  isAlpha,
  isBeta,
  isLegendary,
  planetCountInRange,
  planetTraitCounts,
  planetTraitsInLimit,
  wormholePositionsOk,
  wormholesPerSliceOk,
} from "../helpers/sliceGeneration";
import type { ChoosableTier, SliceGenerationConfig, WormholesPerSlice } from "../types";

/**
 * How long (ms) one slice search may run before it gives up. Settings that
 * can be met normally finish in 10–300 ms; this is how long settings that
 * can't be met keep the generator busy before it reports the closest slices
 * it found. Generation is synchronous (browser main thread, or the server
 * request for multidraft), so this is also the longest it blocks.
 */
export const SLICE_SEARCH_TIME_LIMIT_MS = 1500;

/** After a value failure: time (ms) per probe, and probes, for how far values can go. */
const REACH_PROBE_MS = 100;
const REACH_PROBES = 4;

/** Safety net in case the clock doesn't advance during synchronous work. */
const MAX_STEPS = 3_000_000;
/** Steps without improvement before restarting from a fresh random set. */
const RESTART_AFTER = 400;

/** Slice positions next to the home system (left, front, right), for "high-quality adjacent". */
export const HOME_ADJACENT_TILES = [0, 1, 2];

// Penalty weights: value and influence/resources shortfalls count 1 per point.
const W = {
  special: 4, // second alpha/beta/legendary in a slice
  planets: 1.5, // per planet outside the limits
  wormholes: 3, // per wormhole missing/extra for "wormholes per slice"
  wormholePosition: 3,
  anomalies: 4, // adjacent anomalies in the slice
  global: 4, // per missing alpha/beta/legendary in the whole set
  quality: 3, // per slice missing for safe path / center / high-quality
};

export type SliceLimits = {
  minValue?: number;
  maxValue?: number;
  minInfluence?: number;
  minResources?: number;
  minPlanets?: number;
  maxPlanets?: number;
  /** Most planets of any one trait in a slice. */
  maxPlanetsPerTrait?: number;
  wormholesPerSlice?: WormholesPerSlice;
  wormholePositions?: boolean[];
  /** At most one alpha, one beta and one legendary in a slice. */
  oneSpecialEach?: boolean;
  /** In the whole set. */
  minAlphas?: number;
  minBetas?: number;
  minLegendaries?: number;
  maxLegendaries?: number;
  /** Number of slices that need each quality. */
  safePath?: number;
  safeCenter?: number;
  highAdjacent?: number;
  valueModifiers?: Partial<SliceValueModifiers>;
};

export type SliceSearchSpec = {
  sliceCount: number;
  pool: SystemId[];
  /** Tier used for swaps; tiles without one aren't used. */
  tierOf: (id: SystemId) => ChoosableTier | undefined;
  /** Tier of each tile to pick, per slice. Called again on each restart. */
  rollPatterns: () => ChoosableTier[][];
  /** A tile fixed at a slice position (Milty minor factions), per slice. */
  pinned?: ({ index: number; systemId: SystemId } | undefined)[];
  /** TTPG slice shape, home first: if given, anomalies can't be adjacent. */
  shape?: string[];
  equidistantIndices: number[];
  mecatolPath: number[];
  /** Slice position checked by "safe center tile". */
  centerTile?: number;
  /** Tiles counted as high quality for "high-quality adjacent". */
  isHighQuality?: (id: SystemId) => boolean;
  limits: SliceLimits;
  /** The format's own checks, run on the final slices as a safety net. */
  validateSlice?: (slice: SystemIds) => boolean;
  validateSet?: (slices: SystemIds[]) => boolean;
  timeLimitMs?: number;
};

export type SliceSearchFailure = {
  /**
   * "slices": no slices meet the settings (default). "map": the slices are
   * fine, but the free map tiles around them failed the map checks.
   */
  kind?: "slices" | "map";
  sliceCount: number;
  limits: Pick<
    SliceLimits,
    | "minValue"
    | "maxValue"
    | "minInfluence"
    | "minResources"
    | "minPlanets"
    | "maxPlanets"
    | "maxPlanetsPerTrait"
  >;
  /** What the closest set still gets wrong, one short sentence each. */
  problems: string[];
  /** Lowest and highest slice value in the closest set. */
  closestValues?: [number, number];
  /**
   * How far all slices got together: every slice at `above` or more (when
   * the range was too high), or at `below` or less (when it was too low).
   */
  reach?: { above?: number; below?: number };
};

export type SliceSearchResult =
  | { valid: true; slices: SystemIds[] }
  | { valid: false; slices: SystemIds[] | undefined; failure: SliceSearchFailure };

// ---------------------------------------------------------------------------
// Failure report side channel. Generation is synchronous, so the entry points
// (draft builder, multidraft) clear it, generate, and read it right after.

let lastFailure: SliceSearchFailure | undefined;

export function recordSliceSearchFailure(failure: SliceSearchFailure) {
  lastFailure = failure;
}

/** The last recorded failure (and clears it). */
export function takeSliceSearchFailure() {
  const failure = lastFailure;
  lastFailure = undefined;
  return failure;
}

/** Turns limits from the slice settings into search limits. */
export function limitsFromConfig(
  config: SliceGenerationConfig,
  overrides: Partial<SliceLimits> = {},
): SliceLimits {
  return {
    minValue: config.minSliceValue,
    maxValue: config.maxSliceValue,
    minInfluence: config.minOptimalInfluence || undefined,
    minResources: config.minOptimalResources || undefined,
    minPlanets: config.minPlanets,
    maxPlanets: config.maxPlanets,
    maxPlanetsPerTrait: config.maxPlanetsPerTrait,
    wormholesPerSlice: config.wormholesPerSlice,
    wormholePositions: config.wormholePositions,
    valueModifiers: config.sliceValueModifiers,
    ...overrides,
  };
}

/**
 * Whether one slice (in its tile order) meets the per-slice value,
 * influence/resources, planet and wormhole limits. Uses the app's own value
 * calculation; doesn't check alpha/beta/legendary duplicates or anomalies.
 */
export function sliceMeetsLimits(
  slice: SystemIds,
  limits: SliceLimits,
  positions: { equidistantIndices: number[]; mecatolPath: number[] },
) {
  const systems = slice.map((id) => systemData[id]);
  const value = calculateSliceValue(
    systems,
    buildSliceValueConfig(
      limits.valueModifiers,
      positions.equidistantIndices,
      positions.mecatolPath,
    ),
  );
  const optimal = optimalStatsForSystems(systems);
  return (
    distanceToRange(value, limits.minValue, limits.maxValue) === 0 &&
    (!limits.minInfluence ||
      optimal.influence + optimal.flex >= limits.minInfluence) &&
    (!limits.minResources ||
      optimal.resources + optimal.flex >= limits.minResources) &&
    planetCountInRange(systems, limits.minPlanets, limits.maxPlanets) &&
    planetTraitsInLimit(systems, limits.maxPlanetsPerTrait) &&
    wormholesPerSliceOk(systems, limits.wormholesPerSlice) &&
    wormholePositionsOk(slice, limits.wormholePositions, limits.wormholesPerSlice)
  );
}

// ---------------------------------------------------------------------------

type TileInfo = {
  id: SystemId;
  tier: ChoosableTier | undefined;
  valueOff: number; // value off the Mecatol path
  valueOn: number; // value on the Mecatol path
  influence: number; // optimal influence + flex
  resources: number; // optimal resources + flex
  planets: number;
  traits: number[]; // planets per trait (cultural, hazardous, industrial)
  alpha: boolean;
  beta: boolean;
  legendary: boolean;
  wormholes: number; // counted (alpha/beta outside a supernova)
  anomaly: boolean;
  safeCenter: boolean; // no anomaly and has planets
  high: boolean;
};

type Arrangement = {
  /** Cost of the best order meeting each quality mask (Infinity = none). */
  best: number[];
  /** Orders (tile per slot) reaching `best`, per mask. */
  orders: number[][][];
};

type SliceEval = { base: number; arrangement: Arrangement };

const PERMUTATIONS: Record<number, number[][]> = {};
function permutations(n: number): number[][] {
  if (PERMUTATIONS[n]) return PERMUTATIONS[n];
  const out: number[][] = [];
  const rec = (rest: number[], acc: number[]) => {
    if (rest.length === 0) {
      out.push(acc);
      return;
    }
    rest.forEach((x, i) =>
      rec([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, x]),
    );
  };
  rec(
    Array.from({ length: n }, (_, i) => i),
    [],
  );
  PERMUTATIONS[n] = out;
  return out;
}

const randomInt = (n: number) => Math.floor(Math.random() * n);

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/** How far a number is outside [min, max] (0 inside; missing bounds are open). */
const distanceToRange = (value: number, min?: number, max?: number) =>
  min !== undefined && value < min
    ? min - value
    : max !== undefined && value > max
      ? value - max
      : 0;

class Search {
  private readonly tiles: TileInfo[] = [];
  private readonly index = new Map<SystemId, number>();
  private readonly byTier: Record<string, number[]> = {};
  private readonly pinned: ({ index: number; tile: number } | undefined)[];
  private readonly qualityFlags: { need: number; bit: number }[] = [];
  private readonly adjacentMask: boolean[] = [];
  private readonly modifiers: SliceValueModifiers;
  private cache = new Map<string, SliceEval>();
  private limits: SliceLimits;

  constructor(private readonly spec: SliceSearchSpec) {
    this.limits = spec.limits;
    this.modifiers = {
      ...DEFAULT_SLICE_VALUE_MODIFIERS,
      ...spec.limits.valueModifiers,
    };
    const seen = new Set<SystemId>();
    for (const id of spec.pool) {
      if (seen.has(id) || !systemData[id]) continue;
      seen.add(id);
      const tier = spec.tierOf(id);
      if (!tier) continue;
      const t = this.addTile(id, tier);
      (this.byTier[tier] ??= []).push(t);
    }
    this.pinned = Array.from({ length: spec.sliceCount }, (_, i) => {
      const pin = spec.pinned?.[i];
      return pin ? { index: pin.index, tile: this.addTile(pin.systemId, undefined) } : undefined;
    });

    const quality: [number | undefined, number][] = [
      [spec.limits.safePath, 1],
      [spec.limits.safeCenter, 2],
      [spec.limits.highAdjacent, 4],
    ];
    for (const [need, bit] of quality) {
      if (need && need > 0)
        this.qualityFlags.push({ need: Math.min(need, spec.sliceCount), bit });
    }
  }

  private addTile(id: SystemId, tier: ChoosableTier | undefined) {
    const existing = this.index.get(id);
    if (existing !== undefined) return existing;
    const s: System = systemData[id];
    const flexInf = s.optimalSpend.influence + s.optimalSpend.flex;
    const flexRes = s.optimalSpend.resources + s.optimalSpend.flex;
    const info: TileInfo = {
      id,
      tier,
      valueOff: evaluateSystem(s, this.modifiers, false).total,
      valueOn: evaluateSystem(s, this.modifiers, true).total,
      influence: flexInf,
      resources: flexRes,
      planets: s.planets.length,
      traits: planetTraitCounts([s]),
      alpha: isAlpha(s),
      beta: isBeta(s),
      legendary: isLegendary(s),
      wormholes: countedWormholes(s),
      anomaly: s.anomalies.length > 0,
      safeCenter: s.anomalies.length === 0 && s.planets.length > 0,
      high: this.spec.isHighQuality?.(id) ?? false,
    };
    this.index.set(id, this.tiles.length);
    this.tiles.push(info);
    return this.tiles.length - 1;
  }

  /** Whether a set of slot positions (bitmask) holds two adjacent hexes. */
  private hasAdjacent(mask: number) {
    const cached = this.adjacentMask[mask];
    if (cached !== undefined) return cached;
    const shape = this.spec.shape!;
    const hexes = new Set<string>();
    for (let i = 0; i < 31; i++) if (mask & (1 << i)) hexes.add(shape[i + 1]);
    let adjacent = false;
    for (const hex of hexes) {
      if (neighbors(hex).some((n: string) => hexes.has(n))) adjacent = true;
    }
    this.adjacentMask[mask] = adjacent;
    return adjacent;
  }

  /** Cost of one slice: order-independent part plus its best orders. */
  private evaluate(sliceIdx: number, tiles: number[]): SliceEval {
    const pin = this.pinned[sliceIdx];
    const key =
      (pin ? `${pin.index}:${pin.tile}|` : "|") +
      [...tiles].sort((a, b) => a - b).join(",");
    const hit = this.cache.get(key);
    if (hit) return hit;

    const L = this.limits;
    const all = pin ? [...tiles, pin.tile] : tiles;
    const infos = all.map((t) => this.tiles[t]);
    let base = 0;
    if (L.oneSpecialEach) {
      const count = (f: (t: TileInfo) => boolean) =>
        Math.max(0, infos.filter(f).length - 1);
      base +=
        W.special *
        (count((t) => t.alpha) + count((t) => t.beta) + count((t) => t.legendary));
    }
    const influence = infos.reduce((a, t) => a + t.influence, 0);
    const resources = infos.reduce((a, t) => a + t.resources, 0);
    if (L.minInfluence) base += Math.max(0, L.minInfluence - influence);
    if (L.minResources) base += Math.max(0, L.minResources - resources);
    const planets = infos.reduce((a, t) => a + t.planets, 0);
    base += W.planets * distanceToRange(planets, L.minPlanets, L.maxPlanets);
    if (L.maxPlanetsPerTrait !== undefined) {
      for (let trait = 0; trait < 3; trait++) {
        const n = infos.reduce((a, t) => a + t.traits[trait], 0);
        base += W.planets * Math.max(0, n - L.maxPlanetsPerTrait);
      }
    }
    const wormholes = infos.reduce((a, t) => a + t.wormholes, 0);
    const mode = L.wormholesPerSlice;
    if (mode === "atLeastOne") base += W.wormholes * Math.max(0, 1 - wormholes);
    if (mode === "exactlyOne") base += W.wormholes * Math.abs(1 - wormholes);

    const result = { base, arrangement: this.arrange(sliceIdx, tiles) };
    this.cache.set(key, result);
    return result;
  }

  /** Scores every order of the slice's tiles over its free slots. */
  private arrange(sliceIdx: number, tiles: number[]): Arrangement {
    const pin = this.pinned[sliceIdx];
    const length = tiles.length + (pin ? 1 : 0);
    const free = Array.from({ length }, (_, i) => i).filter(
      (i) => i !== pin?.index,
    );
    const L = this.limits;
    const masks = 1 << this.qualityFlags.length;
    const best: number[] = Array(masks).fill(Infinity);
    const orders: number[][][] = Array.from({ length: masks }, () => []);
    const path = this.spec.mecatolPath;
    const equi = this.spec.equidistantIndices;
    const mult = this.modifiers.equidistantMultiplier;
    const positions = L.wormholePositions;
    const checkPositions =
      !!positions && !!L.wormholesPerSlice && L.wormholesPerSlice !== "any";
    const order: number[] = Array(length);
    if (pin) order[pin.index] = pin.tile;

    for (const perm of permutations(tiles.length)) {
      perm.forEach((p, i) => (order[free[i]] = tiles[p]));
      // Same order of operations as calculateSliceValue, so values match exactly.
      let v = 0;
      let anomalyMask = 0;
      let wormholeOk = !checkPositions;
      for (let pos = 0; pos < length; pos++) {
        const t = this.tiles[order[pos]];
        const raw = path.includes(pos) ? t.valueOn : t.valueOff;
        v += raw * (equi.includes(pos) ? mult : 1);
        if (t.anomaly) anomalyMask |= 1 << pos;
        if (!wormholeOk && t.wormholes > 0 && positions![pos] !== false)
          wormholeOk = true;
      }
      let cost = distanceToRange(v, L.minValue, L.maxValue);
      if (this.spec.shape && this.hasAdjacent(anomalyMask)) cost += W.anomalies;
      if (!wormholeOk) cost += W.wormholePosition;

      let flags = 0;
      this.qualityFlags.forEach(({ bit }, f) => {
        if (this.hasQuality(bit, order, length)) flags |= 1 << f;
      });
      // Update every quality mask this order satisfies.
      for (let m = flags; ; m = (m - 1) & flags) {
        if (cost < best[m] - 1e-9) {
          best[m] = cost;
          orders[m] = [order.slice()];
        } else if (Math.abs(cost - best[m]) <= 1e-9) {
          orders[m].push(order.slice());
        }
        if (m === 0) break;
      }
    }
    return { best, orders };
  }

  private hasQuality(bit: number, order: number[], length: number) {
    const t = (pos: number) => this.tiles[order[pos]];
    if (bit === 1)
      return this.spec.mecatolPath.every((pos) => pos >= length || !t(pos).anomaly);
    if (bit === 2) {
      const c = this.spec.centerTile;
      return !c || c >= length || t(c).safeCenter;
    }
    return HOME_ADJACENT_TILES.some((pos) => pos < length && t(pos).high);
  }

  /** Best total quality-mask assignment over slices (exact DP over counts). */
  private assign(evals: SliceEval[]): { cost: number; masks: number[] } {
    const flags = this.qualityFlags;
    if (flags.length === 0) {
      return {
        cost: evals.reduce((a, e) => a + e.base + e.arrangement.best[0], 0),
        masks: evals.map(() => 0),
      };
    }
    const dims = flags.map((f) => f.need + 1);
    const size = dims.reduce((a, b) => a * b, 1);
    const encode = (counts: number[]) =>
      counts.reduce((acc, c, i) => acc * dims[i] + c, 0);
    const decode = (code: number) => {
      const counts: number[] = Array(dims.length);
      for (let i = dims.length - 1; i >= 0; i--) {
        counts[i] = code % dims[i];
        code = Math.floor(code / dims[i]);
      }
      return counts;
    };
    let dp: number[] = Array(size).fill(Infinity);
    dp[0] = 0;
    const choice: Int16Array[] = [];
    const from: Int32Array[] = [];
    const masks = 1 << flags.length;
    evals.forEach((e) => {
      const next: number[] = Array(size).fill(Infinity);
      const ch = new Int16Array(size);
      const fr = new Int32Array(size);
      for (let code = 0; code < size; code++) {
        if (dp[code] === Infinity) continue;
        const counts = decode(code);
        for (let m = 0; m < masks; m++) {
          const c = e.arrangement.best[m];
          if (c === Infinity) continue;
          const nc = counts.map((x, i) =>
            Math.min(dims[i] - 1, x + ((m >> i) & 1)),
          );
          const target = encode(nc);
          const total = dp[code] + e.base + c;
          if (total < next[target]) {
            next[target] = total;
            ch[target] = m;
            fr[target] = code;
          }
        }
      }
      dp = next;
      choice.push(ch);
      from.push(fr);
    });
    let bestCode = 0;
    let bestCost = Infinity;
    for (let code = 0; code < size; code++) {
      if (dp[code] === Infinity) continue;
      const counts = decode(code);
      const missing = counts.reduce((a, c, i) => a + (flags[i].need - c), 0);
      const total = dp[code] + W.quality * missing;
      if (total < bestCost) {
        bestCost = total;
        bestCode = code;
      }
    }
    const chosen: number[] = Array(evals.length);
    let code = bestCode;
    for (let i = evals.length - 1; i >= 0; i--) {
      chosen[i] = choice[i][code];
      code = from[i][code];
    }
    return { cost: bestCost, masks: chosen };
  }

  private globalPenalty(slices: number[][]) {
    const L = this.limits;
    let alphas = 0;
    let betas = 0;
    let legendaries = 0;
    slices.forEach((slice, i) => {
      const pin = this.pinned[i];
      for (const t of pin ? [...slice, pin.tile] : slice) {
        const info = this.tiles[t];
        if (info.alpha) alphas++;
        if (info.beta) betas++;
        if (info.legendary) legendaries++;
      }
    });
    return (
      W.global *
      (Math.max(0, (L.minAlphas ?? 0) - alphas) +
        Math.max(0, (L.minBetas ?? 0) - betas) +
        Math.max(0, (L.minLegendaries ?? 0) - legendaries) +
        (L.maxLegendaries !== undefined
          ? Math.max(0, legendaries - L.maxLegendaries)
          : 0))
    );
  }

  private totalCost(slices: number[][], evals: SliceEval[]) {
    return this.assign(evals).cost + this.globalPenalty(slices);
  }

  /** Final slices (tile ids in slot order) for a state. */
  private materialize(evals: SliceEval[]): SystemIds[] {
    const { masks } = this.assign(evals);
    return evals.map((e, i) => {
      const options = e.arrangement.orders[masks[i]];
      const order = options[randomInt(options.length)];
      return order.map((t) => this.tiles[t].id);
    });
  }

  private patternsFit(patterns: ChoosableTier[][]) {
    const need: Record<string, number> = {};
    patterns.flat().forEach((t) => (need[t] = (need[t] ?? 0) + 1));
    return Object.entries(need).every(
      ([tier, n]) => (this.byTier[tier]?.length ?? 0) >= n,
    );
  }

  /** Runs the search until a valid set is found or time runs out. */
  run(
    timeLimitMs: number,
    options: { limits?: SliceLimits; verify?: boolean } = {},
  ): {
    valid: boolean;
    slices?: SystemIds[];
    best?: { slices: number[][]; evals: SliceEval[]; cost: number };
    patternsNeverFit: boolean;
  } {
    this.limits = options.limits ?? this.spec.limits;
    this.cache = new Map();
    const verify = options.verify ?? true;
    const deadline = performance.now() + timeLimitMs;
    let steps = 0;
    let fitted = false;
    let best: { slices: number[][]; evals: SliceEval[]; cost: number } | undefined;
    const K = this.spec.sliceCount;
    const timeLeft = () => performance.now() < deadline && steps < MAX_STEPS;

    let rolls = 0;
    while (timeLeft()) {
      const patterns = this.spec.rollPatterns();
      rolls++;
      if (!this.patternsFit(patterns)) {
        steps += 50;
        if (!fitted && rolls > 200) break;
        continue;
      }
      fitted = true;

      // Random start following the patterns.
      const unused: Record<string, number[]> = {};
      for (const tier in this.byTier) unused[tier] = shuffle(this.byTier[tier]);
      const slices = patterns.map((pattern) =>
        pattern.map((tier) => unused[tier].pop()!),
      );
      const tierOfSlot = patterns;
      let evals = slices.map((s, i) => this.evaluate(i, s));
      let cost = this.totalCost(slices, evals);
      let since = 0;

      while (since < RESTART_AFTER) {
        if ((steps & 31) === 0 && !timeLeft()) break;
        if (cost < 1e-9) {
          const out = this.materialize(evals);
          if (!verify || this.verified(out)) {
            return { valid: true, slices: out, patternsNeverFit: false };
          }
          break; // a format check disagrees: restart
        }
        steps++;
        since++;

        // Pick a slice, preferring ones that break a rule.
        const bad: number[] = [];
        evals.forEach((e, i) => {
          if (e.base + e.arrangement.best[0] > 0) bad.push(i);
        });
        const i = bad.length > 0 && Math.random() < 0.8 ? bad[randomInt(bad.length)] : randomInt(K);
        if (slices[i].length === 0) continue;
        const pos = randomInt(slices[i].length);
        const tier = tierOfSlot[i][pos];

        let undo: () => void;
        const changed: number[] = [i];
        if (K > 1 && Math.random() < 0.5) {
          let j = randomInt(K - 1);
          if (j >= i) j++;
          const candidates: number[] = [];
          tierOfSlot[j].forEach((t, x) => t === tier && candidates.push(x));
          if (candidates.length === 0) continue;
          const posJ = candidates[randomInt(candidates.length)];
          const a = slices[i][pos];
          const b = slices[j][posJ];
          slices[i][pos] = b;
          slices[j][posJ] = a;
          undo = () => {
            slices[i][pos] = a;
            slices[j][posJ] = b;
          };
          changed.push(j);
        } else {
          const pool = unused[tier];
          if (!pool || pool.length === 0) continue;
          const k = randomInt(pool.length);
          const a = slices[i][pos];
          const b = pool[k];
          slices[i][pos] = b;
          pool[k] = a;
          undo = () => {
            slices[i][pos] = a;
            pool[k] = b;
          };
        }

        const newEvals = evals.slice();
        changed.forEach((x) => (newEvals[x] = this.evaluate(x, slices[x])));
        const newCost = this.totalCost(slices, newEvals);
        if (newCost < cost - 1e-9) since = 0;
        if (newCost <= cost + 1e-9 || Math.random() < 0.02) {
          cost = newCost;
          evals = newEvals;
        } else {
          undo();
        }
        if (!best || cost < best.cost - 1e-9) {
          best = { slices: slices.map((s) => [...s]), evals: evals.slice(), cost };
        }
      }
      if (!best || cost < best.cost - 1e-9) {
        best = { slices: slices.map((s) => [...s]), evals: evals.slice(), cost };
      }
    }
    return { valid: false, best, patternsNeverFit: !fitted };
  }

  private verified(slices: SystemIds[]) {
    if (this.spec.validateSlice && !slices.every(this.spec.validateSlice))
      return false;
    if (this.spec.validateSet && !this.spec.validateSet(slices)) return false;
    return true;
  }

  materializeBest(best: { evals: SliceEval[] }) {
    return this.materialize(best.evals);
  }

  /** Slice values for slices in their chosen order. */
  valueOf(slice: SystemIds) {
    let v = 0;
    const mult = this.modifiers.equidistantMultiplier;
    slice.forEach((id, pos) => {
      const t = this.tiles[this.index.get(id)!];
      const raw = this.spec.mecatolPath.includes(pos) ? t.valueOn : t.valueOff;
      v += raw * (this.spec.equidistantIndices.includes(pos) ? mult : 1);
    });
    return v;
  }

  /** What the given slices still get wrong. */
  describeProblems(slices: SystemIds[]): string[] {
    const L = this.spec.limits;
    const problems: string[] = [];
    const n = (count: number, what: string) =>
      `${count} ${count === 1 ? "slice" : "slices"} ${what}`;
    const infos = slices.map((s) => s.map((id) => this.tiles[this.index.get(id)!]));
    const values = slices.map((s) => this.valueOf(s));

    const low = values.filter((v) => L.minValue !== undefined && v < L.minValue).length;
    const high = values.filter((v) => L.maxValue !== undefined && v > L.maxValue).length;
    if (low) problems.push(n(low, `below value ${formatSliceValue(L.minValue!)}`));
    if (high) problems.push(n(high, `above value ${formatSliceValue(L.maxValue!)}`));
    const sum = (s: TileInfo[], f: (t: TileInfo) => number) => s.reduce((a, t) => a + f(t), 0);
    if (L.minInfluence) {
      const c = infos.filter((s) => sum(s, (t) => t.influence) < L.minInfluence!).length;
      if (c) problems.push(n(c, `below ${L.minInfluence} optimal influence`));
    }
    if (L.minResources) {
      const c = infos.filter((s) => sum(s, (t) => t.resources) < L.minResources!).length;
      if (c) problems.push(n(c, `below ${L.minResources} optimal resources`));
    }
    const planets = infos.map((s) => sum(s, (t) => t.planets));
    const fewPlanets = planets.filter((p) => L.minPlanets !== undefined && p < L.minPlanets).length;
    const manyPlanets = planets.filter((p) => L.maxPlanets !== undefined && p > L.maxPlanets).length;
    if (fewPlanets) problems.push(n(fewPlanets, `with fewer than ${L.minPlanets} planets`));
    if (manyPlanets) problems.push(n(manyPlanets, `with more than ${L.maxPlanets} planets`));
    if (L.maxPlanetsPerTrait !== undefined) {
      const c = infos.filter((s) =>
        [0, 1, 2].some((trait) => sum(s, (t) => t.traits[trait]) > L.maxPlanetsPerTrait!),
      ).length;
      if (c) problems.push(n(c, `with more than ${plural(L.maxPlanetsPerTrait, "planet")} of one trait`));
    }
    const wormholes = infos.map((s) => sum(s, (t) => t.wormholes));
    if (L.wormholesPerSlice === "atLeastOne" || L.wormholesPerSlice === "exactlyOne") {
      const none = wormholes.filter((w) => w === 0).length;
      const extra = wormholes.filter((w) => w > 1).length;
      if (none) problems.push(n(none, "without a wormhole"));
      if (extra && L.wormholesPerSlice === "exactlyOne")
        problems.push(n(extra, "with more than one wormhole"));
      if (L.wormholePositions) {
        const misplaced = slices.filter(
          (s, i) =>
            wormholes[i] > 0 &&
            !s.some((id, pos) => L.wormholePositions![pos] !== false && this.tiles[this.index.get(id)!].wormholes > 0),
        ).length;
        if (misplaced) problems.push(n(misplaced, "with the wormhole outside the selected positions"));
      }
    }
    if (L.oneSpecialEach) {
      const dup = infos.filter(
        (s) =>
          s.filter((t) => t.alpha).length > 1 ||
          s.filter((t) => t.beta).length > 1 ||
          s.filter((t) => t.legendary).length > 1,
      ).length;
      if (dup) problems.push(n(dup, "with two alphas, betas or legendaries"));
    }
    if (this.spec.shape) {
      const adjacent = slices.filter((s) => {
        let mask = 0;
        s.forEach((id, pos) => {
          if (this.tiles[this.index.get(id)!].anomaly) mask |= 1 << pos;
        });
        return this.hasAdjacent(mask);
      }).length;
      if (adjacent) problems.push(n(adjacent, "with adjacent anomalies"));
    }
    const all = infos.flat();
    const count = (f: (t: TileInfo) => boolean) => all.filter(f).length;
    if ((L.minAlphas ?? 0) > count((t) => t.alpha)) problems.push(`fewer than ${plural(L.minAlphas!, "alpha wormhole")} in the slices`);
    if ((L.minBetas ?? 0) > count((t) => t.beta)) problems.push(`fewer than ${plural(L.minBetas!, "beta wormhole")} in the slices`);
    const legendaries = count((t) => t.legendary);
    if ((L.minLegendaries ?? 0) > legendaries) problems.push(`fewer than ${plural(L.minLegendaries!, "legendary planet")} in the slices`);
    if (L.maxLegendaries !== undefined && legendaries > L.maxLegendaries)
      problems.push(`more than ${plural(L.maxLegendaries, "legendary planet")} in the slices`);
    const quality: [number | undefined, number, string][] = [
      [L.safePath, 1, "a safe path to Mecatol"],
      [L.safeCenter, 2, "a safe center tile"],
      [L.highAdjacent, 4, "a high-quality tile next to home"],
    ];
    for (const [need, bit, label] of quality) {
      if (!need) continue;
      const have = slices.filter((s) =>
        this.hasQuality(bit, s.map((id) => this.index.get(id)!), s.length),
      ).length;
      if (have < Math.min(need, slices.length))
        problems.push(`only ${have} of ${need} slices with ${label}`);
    }
    return problems;
  }
}

function failureBase(spec: SliceSearchSpec): SliceSearchFailure {
  const { minValue, maxValue, minInfluence, minResources, minPlanets, maxPlanets, maxPlanetsPerTrait } =
    spec.limits;
  return {
    sliceCount: spec.sliceCount,
    limits: { minValue, maxValue, minInfluence, minResources, minPlanets, maxPlanets, maxPlanetsPerTrait },
    problems: [],
  };
}

/** Problems no search can fix, found without searching. */
function structuralProblem(spec: SliceSearchSpec): string | undefined {
  const { wormholesPerSlice: mode, wormholePositions } = spec.limits;
  if (mode === "atLeastOne" || mode === "exactlyOne") {
    const sliceLength = Math.max(
      ...spec.rollPatterns().map((p, i) => p.length + (spec.pinned?.[i] ? 1 : 0)),
    );
    if (
      wormholePositions &&
      !Array.from({ length: sliceLength }, (_, i) => wormholePositions[i] !== false).some(Boolean)
    ) {
      return "No wormhole position is selected.";
    }
    const available = spec.pool.filter((id) => {
      const n = systemData[id] ? countedWormholes(systemData[id]) : 0;
      return n > 0 && (mode === "atLeastOne" || n === 1) && spec.tierOf(id);
    }).length;
    if (available < spec.sliceCount) {
      return `The selected tiles have ${available} usable wormholes, but ${spec.sliceCount} slices each need one.`;
    }
  }
  return undefined;
}

/**
 * Searches for slices meeting `spec.limits`. On failure, returns the closest
 * set found (if any) and a description of what it gets wrong.
 */
export function searchSlices(spec: SliceSearchSpec): SliceSearchResult {
  const structural = structuralProblem(spec);
  if (structural) {
    return {
      valid: false,
      slices: undefined,
      failure: { ...failureBase(spec), problems: [structural] },
    };
  }

  const search = new Search(spec);
  const result = search.run(spec.timeLimitMs ?? SLICE_SEARCH_TIME_LIMIT_MS);
  if (result.valid) return { valid: true, slices: result.slices! };

  const failure = failureBase(spec);
  if (result.patternsNeverFit || !result.best) {
    failure.problems = ["The selected tiles are too few for this many slices."];
    return { valid: false, slices: undefined, failure };
  }

  const closest = search.materializeBest(result.best);
  failure.problems = search.describeProblems(closest);
  if (failure.problems.length === 0) {
    // Only a format check disagreed; shouldn't happen, but say something.
    failure.problems = ["No set of slices passed all checks."];
  }
  const values = closest.map((s) => search.valueOf(s));
  failure.closestValues = [Math.min(...values), Math.max(...values)];

  failure.reach = estimateReach(search, spec, values, failure.problems.length);
  return { valid: false, slices: closest, failure };
}

/**
 * When only the value range failed in one direction, how far all slices can
 * go together: start from the closest set (all slices are at least its lowest
 * value) and probe a quarter point further each time, with the other rules
 * kept and the far bound dropped.
 */
function estimateReach(
  search: Search,
  spec: SliceSearchSpec,
  closestValues: number[],
  problemCount: number,
): SliceSearchFailure["reach"] {
  const { minValue, maxValue } = spec.limits;
  const tooLow = minValue !== undefined && closestValues.some((v) => v < minValue);
  const tooHigh = maxValue !== undefined && closestValues.some((v) => v > maxValue);
  // Only when the value range is the one thing the closest set misses.
  if (tooLow === tooHigh || problemCount !== 1) return undefined;

  const probe = (limits: SliceLimits) =>
    search.run(REACH_PROBE_MS, { limits, verify: false }).valid;
  if (tooLow) {
    let reached = Math.min(...closestValues);
    for (let i = 0; i < REACH_PROBES && reached + 0.25 < minValue!; i++) {
      if (!probe({ ...spec.limits, minValue: reached + 0.25, maxValue: undefined })) break;
      reached += 0.25;
    }
    return { above: reached };
  }
  let reached = Math.max(...closestValues);
  for (let i = 0; i < REACH_PROBES && reached - 0.25 > maxValue!; i++) {
    if (!probe({ ...spec.limits, minValue: undefined, maxValue: reached - 0.25 })) break;
    reached -= 0.25;
  }
  return { below: reached };
}

/** A short title and lines explaining a failure, for notices and errors. */
export function describeSliceSearchFailure(failure: SliceSearchFailure): {
  title: string;
  lines: string[];
} {
  const { limits, sliceCount } = failure;
  if (failure.kind === "map") {
    return {
      title: "Couldn't generate the map",
      lines: [
        `The slices are fine, but the map tiles around them kept failing the map checks: ${failure.problems.join("; ")}.`,
        "Try more tile sets or other slice settings, or use a map with this problem anyway.",
      ],
    };
  }
  const wanted: string[] = [];
  if (limits.minValue !== undefined || limits.maxValue !== undefined) {
    const range =
      limits.minValue !== undefined && limits.maxValue !== undefined
        ? `${formatSliceValue(limits.minValue)}–${formatSliceValue(limits.maxValue)}`
        : limits.minValue !== undefined
          ? `at least ${formatSliceValue(limits.minValue)}`
          : `at most ${formatSliceValue(limits.maxValue!)}`;
    wanted.push(`value ${range}`);
  }
  if (limits.maxPlanetsPerTrait !== undefined) {
    wanted.push(`at most ${plural(limits.maxPlanetsPerTrait, "planet")} of one trait`);
  }
  if (limits.minInfluence || limits.minResources) {
    wanted.push(
      `at least ${limits.minInfluence ?? 0} influence / ${limits.minResources ?? 0} resources`,
    );
  }
  const lines = [
    `Couldn't find ${sliceCount} slices${wanted.length ? ` with ${wanted.join(", ")}` : ""} that meet all slice settings.`,
  ];
  if (failure.closestValues) {
    const [lo, hi] = failure.closestValues.map(formatSliceValue);
    lines.push(
      `Closest set found: values ${lo === hi ? lo : `${lo}–${hi}`}; ${failure.problems.join(", ")}.`,
    );
  } else {
    lines.push(...failure.problems);
  }
  const { above, below } = failure.reach ?? {};
  if (above !== undefined) {
    lines.push(
      `With these tiles, the generator got all ${sliceCount} slices to ${formatSliceValue(above)} or more, but no higher.`,
    );
  }
  if (below !== undefined) {
    lines.push(
      `With these tiles, the generator got all ${sliceCount} slices to ${formatSliceValue(below)} or less, but no lower.`,
    );
  }
  return { title: "Couldn't generate slices", lines };
}
