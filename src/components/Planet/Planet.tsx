import { Planet as PlanetType, PlanetTrait } from "~/types";
import { PlanetName } from "./PlanetName";
import { PlanetStats } from "./PlanetStats";
import { TechIcon } from "../icons/TechIcon";
import { LegendaryIcon } from "../icons/LegendaryIcon";
import { useDraftUiSettings } from "~/draftUiSettings";
import { TradeStation } from "../features/TradeStation";
import { TradeStationIcon } from "../icons/TradeStationIcon";
import { RulesPopover, useRulesPopover } from "../RulesPopover";
import { planetRules } from "~/data/tileRules";

type Props = {
  planet: PlanetType;
  showName?: boolean;
  largeFonts?: boolean;
  hasLegendaryImage?: boolean;
  disablePopover?: boolean;
};

const getBgColor = (
  bgColors: Record<PlanetTrait, string>,
  traits: PlanetTrait[],
) => {
  if (traits.length === 1) {
    return bgColors[traits[0]];
  }

  const total = traits.length;
  let currentPos = 0;
  const stops = [];

  for (const trait of traits) {
    const percentage = 100 / total;
    stops.push(`${bgColors[trait]} ${currentPos}%`);
    stops.push(`${bgColors[trait]} ${currentPos + percentage}%`);
    currentPos += percentage;
  }

  return `linear-gradient(to right, ${stops.join(", ")})`;
};

export function Planet({
  planet,
  hasLegendaryImage = false,
  showName = true,
  largeFonts = false,
  disablePopover = false,
}: Props) {
  const { accessibleColors } = useDraftUiSettings();
  const bgColor: Record<PlanetTrait, string> = {
    CULTURAL: "var(--pal-blue-4)",
    HAZARDOUS: "var(--pal-red-5)",
    INDUSTRIAL: "var(--pal-green-5)",
  };

  const accessibleBgColor: Record<PlanetTrait, string> = {
    CULTURAL: "var(--pal-blue-4)",
    HAZARDOUS: "rgb(255 40 40)",
    INDUSTRIAL: "var(--pal-green-5)",
  };

  const bgColors = accessibleColors ? accessibleBgColor : bgColor;
  const { trait, tech: techSpecialty } = planet;

  const fontSize = largeFonts ? "35px" : "24px";
  const size = 50 + (planet.legendary ? 20 : 0);
  const planetColor = trait ? getBgColor(bgColors, trait) : "var(--pal-gray-6)";

  const showBg = !hasLegendaryImage && !planet.tradeStation;

  const rules = disablePopover ? undefined : planetRules(planet);
  const { open, onOpenChange, hoverProps } = useRulesPopover();
  const markerIcon = planet.tradeStation ? <TradeStationIcon /> : planet.legendary ? <LegendaryIcon /> : null;

  return (
    <div
      style={{
        background: showBg ? planetColor : undefined,
        borderRadius: size,
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        // Matches the old popover wrapper: no pointer interaction while dragging / in the finder.
        pointerEvents: disablePopover && markerIcon ? "none" : undefined,
      }}
    >
      {planet.tradeStation && (
        <div style={{ position: "absolute", bottom: 4, transform: "rotate(-20deg)" }}>
          <TradeStation />
        </div>
      )}
      <PlanetStats
        legendary={planet.legendary || planet.tradeStation}
        resources={planet.resources}
        influence={planet.influence}
        fontSize={fontSize}
      />

      {(showName || planet.legendary) && (
        <PlanetName
          size={size}
          legendary={planet.legendary}
          trait={planet.trait}
        >
          {planet.name}
        </PlanetName>
      )}
      {markerIcon && (
        // Legendary planets and space stations: the icon is the tap target for the rules popover.
        <div style={{ position: "absolute", bottom: -4, left: -14, zIndex: 1 }}>
          {rules ? (
            <RulesPopover
              entry={rules}
              open={open}
              onOpenChange={onOpenChange}
              marker={markerIcon}
              // Bigger hit area for touch without moving the icon.
              markerStyle={{ padding: 8, margin: -8 }}
              markerProps={hoverProps}
            />
          ) : (
            markerIcon
          )}
        </div>
      )}

      {techSpecialty?.map((tech, index) => (
        <div key={index} style={{ position: "absolute", top: -6, right: -2 + 20 * index }}>
          <TechIcon techSpecialty={tech} />
        </div>
      ))}
    </div>
  );
}
