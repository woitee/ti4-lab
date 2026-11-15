import type { Anomaly, Planet, PlanetTrait } from "~/types";

/**
 * Short, paraphrased rules reminders shown in popovers on tiles.
 * Legendary ability text lives on the planet itself (`legendaryTitle` /
 * `legendaryDescription` in rawSystemData); this file holds the rest.
 */

export type RulesEntry = {
  title: string;
  /** Small line under the title, e.g. "Primor · 2/1 · Cultural". */
  meta?: string;
  lines: string[];
};

export const anomalyRules: Record<Anomaly, RulesEntry> = {
  ASTEROID_FIELD: {
    title: "Asteroid field",
    meta: "Anomaly",
    lines: ["Ships cannot move into or through an asteroid field."],
  },
  NEBULA: {
    title: "Nebula",
    meta: "Anomaly",
    lines: [
      "Ships can move into a nebula only if it is the active system.",
      "Ships that begin a move in a nebula have a move value of 1.",
      "The defender gets +1 on combat rolls during space combat in a nebula.",
    ],
  },
  SUPERNOVA: {
    title: "Supernova",
    meta: "Anomaly",
    lines: ["Ships cannot move into or through a supernova."],
  },
  GRAVITY_RIFT: {
    title: "Gravity rift",
    meta: "Anomaly",
    lines: [
      "A ship moving out of or through a gravity rift gets +1 move value (once per ship).",
      "Roll 1 die for each such ship as it leaves the rift: on 1–3 it is removed from the board.",
    ],
  },
  ENTROPIC_SCAR: {
    title: "Entropic scar",
    meta: "Anomaly · Thunder's Edge",
    lines: [
      "Unit abilities (Sustain Damage, Production, Planetary Shield, Space Cannon, Bombardment, Deploy, Anti-Fighter Barrage) can't be used by or against units here. Text abilities still work.",
      "Wormholes that would be placed here are discarded instead.",
      "Start of status phase: a player with ships here may spend a strategy-pool token to gain one of their faction technologies.",
    ],
  },
};

export const spaceStationRules: string[] = [
  "Gain control when you are the only player with ships in its system; you keep it after your ships leave.",
  "Its card is spent like a planet, but it can't hold ground forces or structures and doesn't count as a planet for voting, objectives or home systems.",
  "+1 commodity value for each station you control.",
  "You may transact with any player who controls a station, even if not neighbors.",
  "Exhaust it at any time to convert your commodities to trade goods.",
];

/** Extra rules lines shown after a legendary planet's ability text. */
export const legendaryNotes: Record<string, string[]> = {
  Mallice: [
    "Wormhole Nexus: starts on its inactive side (gamma wormhole only). The first time a player moves or places a unit into it, or gains control of Mallice, it flips to its active side (alpha, beta and gamma wormholes).",
  ],
};

const traitLabels: Record<PlanetTrait, string> = {
  CULTURAL: "Cultural",
  HAZARDOUS: "Hazardous",
  INDUSTRIAL: "Industrial",
};

function planetMeta(planet: Planet, kind: string) {
  const parts = [
    planet.name,
    `${planet.resources} res / ${planet.influence} inf`,
    ...(planet.trait ?? []).map((t) => traitLabels[t]),
    kind,
  ];
  return parts.join(" · ");
}

/** Rules popover content for a planet, if it has any (legendary planets and space stations). */
export function planetRules(planet: Planet): RulesEntry | undefined {
  if (planet.tradeStation) {
    return {
      title: planet.name,
      meta: `Space station · ${planet.resources} res / ${planet.influence} inf`,
      lines: spaceStationRules,
    };
  }
  if (!planet.legendary) return undefined;

  const meta = planetMeta(planet, "Legendary");
  const notes = legendaryNotes[planet.name] ?? [];
  if (!planet.legendaryDescription && notes.length === 0) return undefined;
  return {
    title: planet.legendaryTitle ?? planet.name,
    meta,
    lines: [
      ...(planet.legendaryDescription ? [planet.legendaryDescription] : []),
      ...notes,
    ],
  };
}
