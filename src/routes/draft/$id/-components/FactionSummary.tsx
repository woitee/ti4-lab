import type { FactionSummary as Summary, TechColor } from "~/data/factionSummaries";
import classes from "./FactionHelpInfo.module.css";

const techLabels: Record<TechColor, string> = {
  biotic: "Biotic (green)",
  cybernetic: "Cybernetic (yellow)",
  propulsion: "Propulsion (blue)",
  warfare: "Warfare (red)",
};

/** Text panel hanging under a faction card, for what the image lacks. */
export function FactionSummary({ summary }: { summary: Summary }) {
  const { breakthrough } = summary;
  if (!breakthrough) return null;

  return (
    <section className={classes.summary} aria-label="Faction card summary">
      <div className={classes.summaryHead}>
        <span className={classes.summaryLabel}>Breakthrough</span>
        <span className={classes.synergy}>
          <span className={classes.summaryLabel}>Synergy</span>
          {breakthrough.synergy.map((color, i) => (
            <span
              key={i}
              className={classes.techDot}
              style={{ background: `var(--tech-${color})` }}
              title={techLabels[color]}
              aria-label={techLabels[color]}
              role="img"
            />
          ))}
        </span>
      </div>
      <div className={classes.summaryName}>{breakthrough.name}</div>
      {breakthrough.text.map((paragraph, i) => (
        <p key={i} className={classes.summaryText}>
          {paragraph}
        </p>
      ))}
      {breakthrough.note && (
        <p className={classes.summaryNote}>Unverified: {breakthrough.note}</p>
      )}
    </section>
  );
}
