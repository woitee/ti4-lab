import type { FactionSummary as Summary, TechColor } from "~/data/factionSummaries";
import { TechIcon } from "~/components/icons/TechIcon";
import classes from "./FactionHelpInfo.module.css";

const techLabels: Record<TechColor, string> = {
  biotic: "Biotic",
  cybernetic: "Cybernetic",
  propulsion: "Propulsion",
  warfare: "Warfare",
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
          <span
            role="img"
            aria-label={breakthrough.synergy.map((c) => techLabels[c]).join(" + ")}
            title={breakthrough.synergy.map((c) => techLabels[c]).join(" + ")}
          >
            {breakthrough.synergy.map((color, i) => (
              <TechIcon
                key={i}
                techSpecialty={color.toUpperCase() as Uppercase<TechColor>}
                size={16}
                label=""
              />
            ))}
          </span>
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
