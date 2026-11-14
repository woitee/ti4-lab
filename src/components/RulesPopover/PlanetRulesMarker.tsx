import type { Planet } from "~/types";
import { planetRules } from "~/data/tileRules";
import { LegendaryIcon } from "../icons/LegendaryIcon";
import { TradeStationIcon } from "../icons/TradeStationIcon";
import { RulesPopover, useRulesPopover } from "./RulesPopover";

type Props = { planet: Planet; size?: number };

/** Standalone legendary / station icon that opens the planet's rules (e.g. slice feature row). */
export function PlanetRulesMarker({ planet, size = 20 }: Props) {
  const { open, onOpenChange, hoverProps } = useRulesPopover();
  const entry = planetRules(planet);
  const icon = planet.tradeStation ? <TradeStationIcon size={size} /> : <LegendaryIcon size={size} />;
  if (!entry) return icon;
  return <RulesPopover entry={entry} open={open} onOpenChange={onOpenChange} marker={icon} markerProps={hoverProps} />;
}
