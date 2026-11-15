import { useDraft } from "~/draftStore";
import { useFactionTiers } from "~/hooks/useFactionTiers";
import { TIER_COLORS, type Tier } from "~/utils/factionTiers";
import type { FactionId } from "~/types";
import { cx } from "~/ui";
import classes from "./FactionTierBadge.module.css";

/** The tier letter as a small coloured badge. */
export function TierBadge({
  tier,
  size = "md",
  className,
}: {
  tier: Tier;
  /** "sm" for dense rows: chips, pick order, tables. */
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cx(classes.badge, size === "sm" && classes.sm, className)}
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
  show,
  size,
  className,
}: {
  factionId: FactionId;
  /** Overrides the current draft's setting (for pages outside a draft). */
  show?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const fromDraft = useDraft((state) => !!state.draft.settings.showTierBadges);
  const enabled = show ?? fromDraft;
  const tiers = useFactionTiers(enabled);
  const tier = enabled ? tiers?.[factionId] : undefined;
  if (!tier) return null;
  return <TierBadge tier={tier} size={size} className={className} />;
}
