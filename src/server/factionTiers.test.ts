import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import {
  DEFAULT_FACTION_TIERS,
  parseFactionTierList,
} from "~/utils/factionTiers";
import {
  baseFactionIds,
  pokFactionIds,
  teFactionIds,
} from "~/data/factionData";

const admin = vi.hoisted(() => ({ isAdmin: false }));
vi.mock("~/utils/adminAuth.server", () => ({
  isAdmin: async () => admin.isAdmin,
  adminAuthEnabled: () => true,
  checkAdminPassword: () => false,
  startAdminSession: async () => {},
  endAdminSession: async () => {},
}));

const MIGRATIONS = "src/drizzle/migrations";
const TIER_MIGRATION = "0017_faction_tier_list";

const dir = mkdtempSync(join(tmpdir(), "ti4-lab-tiers-"));
const dbPath = join(dir, "test.db");

/** Migrations folder as it was before the tier list migration. */
function migrationsBeforeTiers() {
  const folder = join(dir, "migrations-before");
  cpSync(MIGRATIONS, folder, { recursive: true });
  const journalPath = join(folder, "meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  // Drop it and everything after it (drizzle skips migrations older than the
  // newest applied one, so later ones must not be applied first).
  const cut = journal.entries.findIndex(
    (entry: { tag: string }) => entry.tag === TIER_MIGRATION,
  );
  journal.entries = journal.entries.slice(0, cut);
  writeFileSync(journalPath, JSON.stringify(journal));
  rmSync(join(folder, `${TIER_MIGRATION}.sql`));
  return folder;
}

let store: typeof import("~/drizzle/factionTiers.server");

beforeAll(async () => {
  // An existing database from before the feature.
  const sqlite = new Database(dbPath);
  migrate(drizzle(sqlite), { migrationsFolder: migrationsBeforeTiers() });
  sqlite.close();

  // The app migrates on startup (config.server.ts).
  process.env.TI4_LAB_DATABASE_PATH = pathToFileURL(dbPath).href;
  store = await import("~/drizzle/factionTiers.server");
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

beforeEach(() => {
  admin.isAdmin = false;
});

describe("default tier list", () => {
  it("matches the owner's list", () => {
    expect(DEFAULT_FACTION_TIERS).toEqual({
      mahact: "S", crimson: "S", sol: "S", saar: "S", dws: "S", jolnar: "S",
      yssaril: "A", titans: "A", vulraith: "A", hacan: "A", naazrokha: "A", creuss: "A",
      naalu: "B", nekro: "B", empyrean: "B", keleres: "B", barony: "B", nomad: "B",
      yin: "C", ralnel: "C", l1z1x: "C", arborec: "C", bastion: "C",
      winnu: "D", muaat: "D", sardakk: "D",
      argent: "F", mentak: "F", xxcha: "F", firmament: "F",
    });
  });

  it("covers every base, PoK and Thunder's Edge faction", () => {
    const core = [...baseFactionIds, ...pokFactionIds, ...teFactionIds];
    expect(Object.keys(DEFAULT_FACTION_TIERS).sort()).toEqual(core.sort());
  });
});

describe("tier list validation", () => {
  it("drops unknown factions and tiers leniently", () => {
    expect(
      parseFactionTierList({ sol: "S", nope: "A", hacan: "Z", xxcha: null }),
    ).toEqual({ sol: "S" });
  });

  it("rejects them strictly (admin input)", () => {
    expect(() => parseFactionTierList({ nope: "A" }, { strict: true })).toThrow();
    expect(() => parseFactionTierList({ sol: "Z" }, { strict: true })).toThrow();
    expect(() => parseFactionTierList([], { strict: true })).toThrow();
  });
});

describe("stored tier list", () => {
  it("migration applies; empty table serves the default", async () => {
    const db = new Database(dbPath, { readonly: true });
    const columns = db
      .prepare("select name from pragma_table_info('factionTierList')")
      .all()
      .map((row) => (row as { name: string }).name);
    db.close();
    expect(columns.sort()).toEqual(["data", "id", "updatedAt"]);

    expect(await store.getStoredFactionTiers()).toEqual({
      tiers: DEFAULT_FACTION_TIERS,
      customized: false,
      updatedAt: null,
    });
  });

  it("saves, overwrites and resets", async () => {
    await store.saveFactionTiers({ sol: "F", hacan: "S" });
    await store.saveFactionTiers({ sol: "A" });
    const saved = await store.getStoredFactionTiers();
    expect(saved.tiers).toEqual({ sol: "A" });
    expect(saved.customized).toBe(true);

    await store.resetFactionTiers();
    expect((await store.getStoredFactionTiers()).tiers).toEqual(
      DEFAULT_FACTION_TIERS,
    );
  });
});

describe("server functions", () => {
  const source = readFileSync("src/server/factionTiers.functions.ts", "utf8");
  // The Start compiler turns server functions into RPC stubs, so their
  // middleware can't be inspected at runtime; check the source instead.
  const fns = Object.fromEntries(
    source
      .split("export const ")
      .slice(1)
      .map((chunk) => [chunk.split(" ")[0], chunk]),
  );

  it("admin functions use requireAdmin", () => {
    for (const name of [
      "getAdminFactionTiers",
      "setFactionTiers",
      "resetFactionTiersToDefault",
    ]) {
      expect(fns[name]).toMatch(/createServerFn\([^)]*\)\s*\.middleware\(\[requireAdmin\]\)/);
    }
  });

  it("the public read is open and returns only the tiers", () => {
    expect(fns.getFactionTiers).toBeDefined();
    expect(fns.getFactionTiers).not.toMatch(/requireAdmin/);
    expect(fns.getFactionTiers).toMatch(/return \{ tiers \}/);
  });

  it("requireAdmin rejects non-admins without running the handler", async () => {
    type GuardFn = (opts: { next: () => Promise<string> }) => Promise<string>;
    const { requireAdmin } = await import("./admin.functions");
    const guard = (requireAdmin as unknown as { options: { server: GuardFn } })
      .options.server;
    const next = vi.fn(async () => "ran");
    await expect(guard({ next })).rejects.toThrow("Unauthorized");
    expect(next).not.toHaveBeenCalled();
  });
});
