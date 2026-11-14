import { ReactNode, type JSX } from "react";
import { cx } from "~/ui/utils";
import { hexSides, hexVertices } from "./hexUtils";
import { AnomalyBorder } from "./AnomalyBorder";
import { HexBorder } from "./HexBorder";
import { FactionId } from "~/types";
import { FactionIcon } from "../icons/FactionIcon";
import { HexFactionIndicator } from "./HexFactionIndicator";
import { HyperlaneLine } from "./HyperlaneLine";
import hitClasses from "./Hex.module.css";

interface Props {
  id: string;
  color?: string;
  colorClass?: string;
  radius: number;
  children?: ReactNode;
  image?: JSX.Element;
  anomaly?: boolean;
  showBorder?: boolean;
  borderRadius?: number;
  borderColorClass?: string;
  borderClass?: string;
  faction?: FactionId;
  hyperlanes?: number[][];
  style?: React.CSSProperties;
  /** Let pointer events fall through the whole hex (e.g. a hover overlay drawn on top of a tile). */
  passThrough?: boolean;
}

export function Hex({
  id,
  color,
  colorClass,
  radius,
  children,
  image,
  anomaly,
  showBorder = false,
  borderRadius,
  borderColorClass,
  borderClass,
  faction,
  hyperlanes,
  style = {},
  passThrough = false,
}: Props) {
  const points = hexVertices(radius);
  const pointsString = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <>
      {/* The square boxes overlap neighbouring tiles' corners, so only the hexagon and the
          content take pointer events; the rest falls through to the neighbour underneath. */}
      <div className={hitClasses.box} style={{ position: "absolute", ...style }}>
        <svg
          width={2 * radius}
          height={2 * radius}
          viewBox={`-${radius} -${radius} ${2 * radius} ${2 * radius}`}
        >
          <defs>
            {hyperlanes && (
              <filter id="glow" y="-100%" height="400%">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            )}
            {image && (
              <clipPath id={`hexClip-${id}`}>
                <polygon points={pointsString} />
              </clipPath>
            )}
          </defs>

          <polygon
            points={pointsString}
            fill={color}
            className={cx(colorClass, !passThrough && hitClasses.hit)}
          />
          {showBorder && (
            <HexBorder
              radius={radius}
              borderRadius={borderRadius}
              className={`${borderColorClass || ""} ${borderClass || ""}`}
            />
          )}
          {hyperlanes && (
            <>
              {/* Show blue glow */}
              <g filter="url(#glow)">
                {hyperlanes?.map(([start, end], idx) => {
                  const sides = hexSides(points);
                  return (
                    <HyperlaneLine
                      key={idx}
                      p1={sides[start]}
                      p2={sides[end]}
                      color="blue"
                    />
                  );
                })}
              </g>
              {/* Show white hyperlane */}
              <g>
                {hyperlanes?.map(([start, end], idx) => {
                  const sides = hexSides(points);
                  return (
                    <HyperlaneLine
                      key={idx}
                      p1={sides[start]}
                      p2={sides[end]}
                      color="#7ca8ff"
                    />
                  );
                })}
              </g>
              <g>
                {hyperlanes?.map(([start, end], idx) => {
                  const sides = hexSides(points);
                  return (
                    <HyperlaneLine
                      key={idx}
                      p1={sides[start]}
                      p2={sides[end]}
                      color="white"
                      width="0.5"
                    />
                  );
                })}
              </g>
            </>
          )}

          {image && <g clipPath={`url(#hexClip-${id})`}>{image}</g>}
          {anomaly && <AnomalyBorder radius={radius} points={points} />}
          {faction && <HexFactionIndicator hexPoints={points} />}
        </svg>
      </div>

      <div
        className={cx(hitClasses.box, !passThrough && hitClasses.content)}
        style={{
          width: radius * 2,
          height: radius * 2,
          alignItems: "center",
          justifyContent: "center",
          display: "flex",
          position: "relative",
        }}
      >
        {faction && (
          <FactionIcon
            faction={faction}
            style={{
              width: radius * 0.35,
              height: radius * 0.35,
              position: "absolute",
              top: radius * 1.5,
              left: radius * 0.45,
            }}
          />
        )}
        {children}
      </div>
    </>
  );
}
