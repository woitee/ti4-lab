import { createServerFn } from "@tanstack/react-start";
import {
  getStoredFactionTiers,
  resetFactionTiers,
  saveFactionTiers,
} from "~/drizzle/factionTiers.server";
import {
  parseStoredTierList,
  type StoredTierList,
} from "~/utils/factionTiers";
import { requireAdmin } from "./admin.functions";
import { expectRecord } from "./validate";

/** Public: the current tier list, read live by every draft. */
export const getFactionTiers = createServerFn().handler(async () => {
  const { tiers } = await getStoredFactionTiers();
  return { tiers };
});

export const getAdminFactionTiers = createServerFn()
  .middleware([requireAdmin])
  .handler(() => getStoredFactionTiers());

export const setFactionTiers = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .validator((input: { tiers: StoredTierList }) => ({
    tiers: parseStoredTierList(expectRecord(input).tiers, { strict: true }),
  }))
  .handler(async ({ data: { tiers } }) => {
    await saveFactionTiers(tiers);
  });

export const resetFactionTiersToDefault = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    await resetFactionTiers();
  });
