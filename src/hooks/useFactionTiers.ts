import { useQuery } from "@tanstack/react-query";
import { getFactionTiers } from "~/server/factionTiers.functions";
import type { FactionTierList } from "~/utils/factionTiers";

export const factionTiersQueryKey = ["factionTiers"] as const;

/**
 * The shared tier list, read live (admin edits reach running drafts on the
 * next refetch). Undefined while loading or when `enabled` is false.
 */
export function useFactionTiers(enabled = true): FactionTierList | undefined {
  const { data } = useQuery({
    queryKey: factionTiersQueryKey,
    queryFn: () => getFactionTiers(),
    enabled,
    staleTime: 60_000,
    refetchInterval: enabled ? 5 * 60_000 : false,
  });
  return data?.tiers;
}
