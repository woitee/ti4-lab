import { techSpecialtiesForSystems } from "~/utils/map";
import { TechIcon } from "../icons/TechIcon";
import { Wormhole } from "../features/Wormhole";
import { Slice } from "~/types";
import { systemsInSlice } from "~/utils/slice";
import { PlanetRulesMarker } from "~/components/RulesPopover";

type Props = {
  slice: Slice;
};

export function SliceFeatures({ slice }: Props) {
  const systems = systemsInSlice(slice);
  const specialties = techSpecialtiesForSystems(systems);
  const legendaryPlanets = systems.flatMap((s) => s.planets.filter((p) => p.legendary));
  const tradeStations = systems.flatMap((s) => s.planets.filter((p) => p.tradeStation));
  const wormholes = systems
    .filter((s) => s.wormholes.length > 0)
    .map((s) => s.wormholes)
    .flat(1);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
      {specialties.map((tech, idx) => (
        <TechIcon key={idx} techSpecialty={tech} />
      ))}
      {legendaryPlanets.map((p) => (
        <PlanetRulesMarker key={p.name} planet={p} />
      ))}
      {tradeStations.map((p) => (
        <PlanetRulesMarker key={p.name} planet={p} />
      ))}
      {wormholes.map((w, idx) => (
        <Wormhole key={idx} wormhole={w} size={28} fontSize={14} />
      ))}
    </div>
  );
}
