import { useDraft } from "~/draftStore";
import { useFactionTiers } from "~/hooks/useFactionTiers";
import { TIER_COLORS, type Tier } from "~/utils/factionTiers";
import type { FactionId } from "~/types";
import { cx } from "~/ui";
import classes from "./FactionTierBadge.module.css";

/** The tier letter as a small coloured badge. */
export function TierBadge({
  tier,
  className,
}: {
  tier: Tier;
  className?: string;
}) {
  return (
    <span
      className={cx(classes.badge, className)}
      style={{ background: TIER_COLORS[tier] }}
      title={`Tier ${tier}`}
      aria-label={`Tier ${tier}`}
    >
      {tier}
    </span>
  );
}

/**
 * Tier badge for a faction in the current draft. Nothing when the draft's
 * "Show tier badges" rule is off or the faction isn't in the tier list.
 */
export function FactionTierBadge({
  factionId,
  className,
}: {
  factionId: FactionId;
  className?: string;
}) {
  const enabled = useDraft((state) => !!state.draft.settings.showTierBadges);
  const tiers = useFactionTiers(enabled);
  const tier = enabled ? tiers?.[factionId] : undefined;
  if (!tier) return null;
  return <TierBadge tier={tier} className={className} />;
}
