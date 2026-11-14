import { describe, expect, it } from "vitest";
import {
  factionDiscordantExpIds,
  factionDiscordantIds,
} from "./factionData";
import { factionSummaries } from "./factionSummaries";

describe("factionSummaries", () => {
  const dsIds = [...factionDiscordantIds, ...factionDiscordantExpIds];

  it("has a breakthrough for every Discordant Stars faction", () => {
    expect(dsIds.length).toBeGreaterThan(0);
    for (const id of dsIds) {
      const breakthrough = factionSummaries[id]?.breakthrough;
      expect(breakthrough, id).toBeDefined();
      expect(breakthrough!.name.trim(), id).not.toBe("");
      expect(breakthrough!.synergy, id).toHaveLength(2);
      expect(breakthrough!.text.length, id).toBeGreaterThan(0);
    }
  });

  it("has no wiki markup left in the text", () => {
    for (const [id, summary] of Object.entries(factionSummaries)) {
      for (const line of summary.breakthrough?.text ?? []) {
        expect(line, id).not.toMatch(/\[\[|\]\]|'''|\{\{/);
      }
    }
  });
});
