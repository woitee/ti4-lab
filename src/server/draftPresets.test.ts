import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { runWithStartContext } from "@tanstack/start-storage-context";

const admin = vi.hoisted(() => ({ isAdmin: false }));
vi.mock("~/utils/adminAuth.server", () => ({
  isAdmin: async () => admin.isAdmin,
  adminAuthEnabled: () => true,
  checkAdminPassword: () => false,
  startAdminSession: async () => {},
  endAdminSession: async () => {},
}));

const MIGRATIONS = "src/drizzle/migrations";
const FEATURE_MIGRATION = "0016_featured_draft_presets";

const dir = mkdtempSync(join(tmpdir(), "ti4-lab-presets-"));
const dbPath = join(dir, "test.db");

/** Migrations folder as it was before the featured-presets migration. */
function migrationsBeforeFeature() {
  const folder = join(dir, "migrations-before");
  cpSync(MIGRATIONS, folder, { recursive: true });
  const journalPath = join(folder, "meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8"));
  journal.entries = journal.entries.filter(
    (entry: { tag: string }) => entry.tag !== FEATURE_MIGRATION,
  );
  writeFileSync(journalPath, JSON.stringify(journal));
  rmSync(join(folder, `${FEATURE_MIGRATION}.sql`));
  return folder;
}

const presetData = (type = "milty") =>
  JSON.stringify({
    settings: { type, factionGameSets: ["base"] },
    slices: [],
    presetMap: {},
    availableFactions: ["sol"],
  });

type Mod = {
  presets: typeof import("~/drizzle/draftPreset.server");
  admin: typeof import("./draftPresetsAdmin.functions");
  pub: typeof import("./draftPresets.functions");
};
let mod: Mod;

beforeAll(async () => {
  // An existing database from before the feature, with presets in it.
  const sqlite = new Database(dbPath);
  migrate(drizzle(sqlite), { migrationsFolder: migrationsBeforeFeature() });
  const insert = sqlite.prepare(
    "insert into draftPresets (id, name, data, keepFactions, playerCount) values (?, ?, ?, ?, ?)",
  );
  insert.run("old-1", "old-one", presetData(), 1, 6);
  insert.run("old-2", "old-two", presetData("milty4p"), 0, 4);
  sqlite.close();

  // The app migrates on startup (config.server.ts).
  process.env.TI4_LAB_DATABASE_PATH = pathToFileURL(dbPath).href;
  mod = {
    presets: await import("~/drizzle/draftPreset.server"),
    admin: await import("./draftPresetsAdmin.functions"),
    pub: await import("./draftPresets.functions"),
  };
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

beforeEach(() => {
  admin.isAdmin = false;
});

describe("featured presets migration", () => {
  it("keeps existing presets, unfeatured", async () => {
    const all = await mod.presets.listDraftPresetsForAdmin();
    const old = all.find((preset) => preset.name === "old-one");
    expect(old).toMatchObject({
      featured: false,
      title: null,
      description: null,
      sortOrder: 0,
      playerCount: 6,
      draftType: "milty",
    });
    expect(await mod.presets.draftPresetByName("old-two")).toMatchObject({
      keepFactions: false,
      playerCount: 4,
    });
  });
});

describe("public featured list", () => {
  it("returns only featured presets, in order, with public fields only", async () => {
    const a = await mod.presets.createDraftPreset({
      name: "feat-a",
      keepFactions: true,
      playerCount: 6,
      data: JSON.parse(presetData()),
    });
    const b = await mod.presets.createDraftPreset({
      name: "feat-b",
      keepFactions: false,
      playerCount: 4,
      data: JSON.parse(presetData("milty4p")),
    });
    await mod.presets.updateDraftPresetFeature(a!.id, {
      featured: true,
      title: null,
      description: "Second",
      sortOrder: 5,
    });
    await mod.presets.updateDraftPresetFeature(b!.id, {
      featured: true,
      title: "First up",
      description: null,
      sortOrder: 1,
    });

    const list = await mod.presets.listFeaturedDraftPresets();
    expect(list.map((preset) => preset.title)).toEqual(["First up", "feat-a"]);
    expect(Object.keys(list[0]).sort()).toEqual(
      [
        "description",
        "draftType",
        "gameMode",
        "id",
        "keepFactions",
        "playerCount",
        "title",
      ].sort(),
    );
    expect(list[1].description).toBe("Second");
  });

  it("loads featured presets by id but not unfeatured ones", async () => {
    const [first] = await mod.presets.listFeaturedDraftPresets();
    expect(await mod.presets.featuredDraftPresetById(first.id)).toBeDefined();
    expect(await mod.presets.featuredDraftPresetById("old-1")).toBeUndefined();
  });
});

describe("delete", () => {
  it("deletes a preset", async () => {
    expect(await mod.presets.deleteDraftPreset("old-2")).toEqual({ ok: true });
    expect(await mod.presets.draftPresetByName("old-two")).toBeUndefined();
    expect(await mod.presets.deleteDraftPreset("old-2")).toEqual({
      ok: false,
      reason: "notFound",
    });
  });

  it("keeps presets that a hub slice set uses", async () => {
    const sqlite = new Database(dbPath);
    sqlite.exec(`
      insert into users (id, username) values ('u1', 'owner');
      insert into hubs (id, ownerId, slug, name) values ('h1', 'u1', 'hub', 'Hub');
      insert into hubSliceSets (id, hubId, presetId, title) values ('s1', 'h1', 'old-1', 'Set');
    `);
    sqlite.close();
    expect(await mod.presets.deleteDraftPreset("old-1")).toEqual({
      ok: false,
      reason: "usedByHubs",
      hubUses: 1,
    });
    expect(await mod.presets.draftPresetByName("old-one")).toBeDefined();
  });
});

describe("admin feature input", () => {
  it("trims text and turns blanks into null", () => {
    expect(
      mod.admin.parseFeatureInput({
        id: "x",
        featured: true,
        title: "  Big   game ",
        description: "   ",
        sortOrder: 2,
      }),
    ).toEqual({
      id: "x",
      featured: true,
      title: "Big game",
      description: null,
      sortOrder: 2,
    });
  });

  it("rejects bad order and long titles", () => {
    expect(() =>
      mod.admin.parseFeatureInput({ id: "x", sortOrder: 1.5 }),
    ).toThrow();
    expect(() =>
      mod.admin.parseFeatureInput({ id: "x", title: "a".repeat(81) }),
    ).toThrow();
  });
});

describe("admin guard", () => {
  type GuardFn = (opts: { next: () => Promise<string> }) => Promise<string>;
  const guard = async () => {
    const { requireAdmin } = await import("./admin.functions");
    return (requireAdmin as unknown as { options: { server: GuardFn } })
      .options.server;
  };

  it("requireAdmin rejects non-admins without running the handler", async () => {
    const next = vi.fn(async () => "ran");
    await expect((await guard())({ next })).rejects.toThrow("Unauthorized");
    expect(next).not.toHaveBeenCalled();
  });

  it("requireAdmin lets admins through", async () => {
    admin.isAdmin = true;
    const next = vi.fn(async () => "ran");
    expect(await (await guard())({ next })).toBe("ran");
  });

  it("every preset admin server function uses requireAdmin", () => {
    // The Start compiler turns server functions into RPC stubs, so their
    // middleware can't be inspected at runtime; check the source instead.
    const source = readFileSync(
      "src/server/draftPresetsAdmin.functions.ts",
      "utf8",
    );
    const fns = source.split("createServerFn(").slice(1);
    expect(fns).toHaveLength(3);
    for (const fn of fns) {
      expect(fn).toMatch(/^[^.]*\)\s*\.middleware\(\[requireAdmin\]\)/);
    }
  });
});
