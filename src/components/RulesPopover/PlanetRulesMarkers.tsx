import type { Planet } from "~/types";
import { PlanetRulesMarker } from "./PlanetRulesMarker";

type Props = { planets: Planet[]; radius: number };

/**
 * Legendary / space station markers for a tile drawn as original art, where
 * the planets themselves aren't rendered. Placed just inside the lower-left
 * edge of the (flat-top) hex, mirroring the anomaly markers on the upper-left
 * edge, and like the planet icons in the normal view (bottom-left).
 */
export function PlanetRulesMarkers({ planets, radius }: Props) {
  const marked = planets.filter((p) => p.legendary || p.tradeStation);
  if (marked.length === 0) return null;
  const size = Math.max(16, Math.round(radius * 0.3));
  const pad = 3;
  // Centres along the lower-left edge, in tile-box coordinates (0..2r).
  const spots = [
    { x: 0.34, y: 1.34 },
    { x: 0.64, y: 1.7 },
  ];
  return (
    <>
      {marked.slice(0, spots.length).map((planet, i) => (
        <div
          key={planet.name}
          style={{
            position: "absolute",
            left: radius * spots[i].x - size / 2 - pad,
            top: radius * spots[i].y - size / 2 - pad,
            zIndex: 1,
            lineHeight: 0,
          }}
        >
          <PlanetRulesMarker planet={planet} size={size} pad={pad} />
        </div>
      ))}
    </>
  );
}
