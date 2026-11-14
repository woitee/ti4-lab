import { describe, expect, it } from "vitest";
import { rawSystems } from "./rawSystemData";
import { anomalyRules, planetRules } from "./tileRules";

const systems = Object.values(rawSystems);
const planets = systems.flatMap((s) => s.planets);

describe("tile rules popovers", () => {
  it("has rules for every anomaly type used by a tile", () => {
    const anomalies = new Set(systems.flatMap((s) => s.anomalies));
    expect(anomalies.size).toBeGreaterThan(0);
    for (const anomaly of anomalies) {
      expect(anomalyRules[anomaly]?.lines.length, anomaly).toBeGreaterThan(0);
    }
  });

  it("has rules for every legendary planet", () => {
    const legendary = planets.filter((p) => p.legendary);
    expect(legendary.length).toBeGreaterThan(0);
    for (const planet of legendary) {
      const entry = planetRules(planet);
      expect(entry, planet.name).toBeDefined();
      expect(entry!.lines.join("").length, planet.name).toBeGreaterThan(0);
      expect(entry!.meta, planet.name).toContain(planet.name);
    }
  });

  it("has rules for every space station", () => {
    const stations = planets.filter((p) => p.tradeStation);
    expect(stations.length).toBeGreaterThan(0);
    for (const planet of stations) {
      expect(planetRules(planet)?.lines.length, planet.name).toBeGreaterThan(0);
    }
  });

  it("has no rules popover for ordinary planets", () => {
    const ordinary = planets.find((p) => !p.legendary && !p.tradeStation)!;
    expect(planetRules(ordinary)).toBeUndefined();
  });
});
