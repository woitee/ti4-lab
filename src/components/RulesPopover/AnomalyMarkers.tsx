import { IconBolt, IconCloud, IconMeteor, IconSpiral, IconSun } from "@tabler/icons-react";
import type { ComponentType } from "react";
import type { Anomaly } from "~/types";
import { anomalyRules } from "~/data/tileRules";
import { RulesPopover, useRulesPopover } from "./RulesPopover";

const anomalyIcons: Record<Anomaly, ComponentType<{ size?: number; stroke?: number }>> = {
  ASTEROID_FIELD: IconMeteor,
  NEBULA: IconCloud,
  SUPERNOVA: IconSun,
  GRAVITY_RIFT: IconSpiral,
  ENTROPIC_SCAR: IconBolt,
};

/** Small round badge in the anomaly-border red, with a glyph for the anomaly type. */
function AnomalyBadge({ anomaly, size }: { anomaly: Anomaly; size: number }) {
  const Icon = anomalyIcons[anomaly];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(20, 20, 24, 0.85)",
        border: `${Math.max(1, Math.round(size / 10))}px solid red`,
        color: "white",
        boxSizing: "border-box",
      }}
    >
      <Icon size={Math.round(size * 0.62)} stroke={2} />
    </span>
  );
}

function AnomalyMarker({ anomaly, size, pad }: { anomaly: Anomaly; size: number; pad: number }) {
  const { open, onOpenChange, hoverProps } = useRulesPopover();
  return (
    <RulesPopover
      entry={anomalyRules[anomaly]}
      open={open}
      onOpenChange={onOpenChange}
      marker={<AnomalyBadge anomaly={anomaly} size={size} />}
      // Slightly larger hit area than the badge for touch.
      markerStyle={{ padding: pad }}
      markerProps={hoverProps}
    />
  );
}

type Props = { anomalies: Anomaly[]; radius: number };

/**
 * Anomaly markers for a system tile, placed just inside the upper-left edge of
 * the (flat-top) hex; a second anomaly sits further up that edge. Hover or tap
 * one for that anomaly's rules.
 */
export function AnomalyMarkers({ anomalies, radius }: Props) {
  if (anomalies.length === 0) return null;
  const size = Math.max(16, Math.round(radius * 0.3));
  const pad = 3;
  // Centres along the upper-left edge, in tile-box coordinates (0..2r), inset towards the centre.
  const spots = [
    { x: 0.34, y: 0.66 },
    { x: 0.64, y: 0.3 },
  ];
  return (
    <>
      {anomalies.slice(0, spots.length).map((a, i) => (
        <div
          key={a}
          style={{
            position: "absolute",
            left: radius * spots[i].x - size / 2 - pad,
            top: radius * spots[i].y - size / 2 - pad,
            zIndex: 1,
            lineHeight: 0,
          }}
        >
          <AnomalyMarker anomaly={a} size={size} pad={pad} />
        </div>
      ))}
    </>
  );
}
