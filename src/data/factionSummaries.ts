import { FactionId } from "~/types";

export type TechColor = "biotic" | "cybernetic" | "propulsion" | "warfare";

export type Breakthrough = {
  name: string;
  /** The two tech colors the breakthrough's synergy links. */
  synergy: TechColor[];
  /** Card text, one entry per paragraph. */
  text: string[];
  /** Set when part of the entry could not be verified against the source. */
  note?: string;
};

/**
 * Text shown under a faction's info card, for information the card image
 * lacks. Add more fields here as needed.
 */
export type FactionSummary = {
  breakthrough?: Breakthrough;
};

/**
 * Discordant Stars faction cards predate Thunder's Edge, so they have no
 * breakthrough. Text from the factions' pages on the TI4 fandom wiki
 * (twilight-imperium.fandom.com), November 2026.
 */
export const factionSummaries: Partial<Record<FactionId, FactionSummary>> = {
  ilyxum: {
    breakthrough: {
      name: "Cryptic Insights",
      synergy: ["biotic", "cybernetic"],
      text: [
        "When you explore a planet, you may discard that card to draw 1 action card instead.",
      ],
    },
  },
  celdauri: {
    breakthrough: {
      name: "Trade Protectorate",
      synergy: ["warfare", "cybernetic"],
      text: [
        "When you gain this card, flip this card and place it on your faction sheet. Then, place the Celagrom token in a system that contains your ships, if able.",
        "The Celagrom token is a second flagship with the attributes, abilities, and ability text on the Celagrom flagship card.",
      ],
    },
  },
  dihmohn: {
    breakthrough: {
      name: "Exodus Engineering",
      synergy: ["propulsion", "cybernetic"],
      text: [
        "Once per space combat, after 1 of your opponent's non-fighter ships is destroyed, you may either exhaust this card to place 1 frontier token in the active system, or produce 1 or 2 non-fighter ships in that system to ready this card.",
        "You can produce ships in systems that contain both your ships and another player's ships.",
      ],
    },
  },
  florzen: {
    breakthrough: {
      name: "Reverie Implants",
      synergy: ["biotic", "propulsion"],
      text: [
        "After a system that contains 2 or more planets you control is activated, you may exhaust this card. If you do, you and the active player each secretly spend 0, 1, or 2 trade goods.",
        "Then, reveal the spent trade goods; if you spent the same number of trade goods, explore 1 planet you control; otherwise, end that player's turn.",
      ],
    },
  },
  freesystems: {
    breakthrough: {
      name: "Galactic Movement",
      synergy: ["biotic", "cybernetic"],
      text: [
        "After you spend a strategy token, you may place 1 infantry from your reinforcements into coexistence on any cultural, hazardous, or industrial planet that contains the active player's ground forces.",
        "Your infantry tokens on planets you control can be accompanied by your control tokens instead of plastic pieces.",
      ],
    },
  },
  ghemina: {
    breakthrough: {
      name: "Raiding Parties",
      synergy: ["biotic", "warfare"],
      text: [
        "During each round of combat, you may choose 1 of your participating units; roll that unit's combat roll twice and resolve the result of your choice.",
        "When you announce a retreat, you may exhaust this card to immediately resolve that retreat.",
      ],
    },
  },
  mortheus: {
    breakthrough: {
      name: "Mirage Craft",
      synergy: ["cybernetic", "warfare"],
      text: [
        "At the start and end of a space combat in which you are the defender, you may swap 1 of your ships in the active system with 1 of your ships in another system that contains 1 of your command tokens; the swapped ships cannot transport units.",
      ],
      note: "Wiki spells the name \"Mirage Craf\"; assumed typo for \"Mirage Craft\".",
    },
  },
  kollecc: {
    breakthrough: {
      name: "The Collector's Museum",
      synergy: ["biotic", "propulsion"],
      text: [
        "When you explore a planet, you may exhaust this card to resolve a card from that exploration deck's discard pile instead; if you would discard that card, instead shuffle it into the corresponding exploration deck.",
      ],
    },
  },
  kortali: {
    breakthrough: {
      name: "Psychospore",
      synergy: ["propulsion", "warfare"],
      text: [
        "If you have the Dreadnought II technology, flip this card and place it on top of Dreadnought II.",
      ],
      note: "Flip side (upgraded Dreadnought II) is not described on the wiki.",
    },
  },
  lizho: {
    breakthrough: {
      name: "Professional Intrigue",
      synergy: ["biotic", "warfare"],
      text: [
        "After you perform a tactical action in a non-home system, you may move 1 of your infantry on the game board into coexistence on a planet in that system.",
        "When a player ends your units' coexistence on a planet, they must discard 1 action card, if able.",
      ],
    },
  },
  khrask: {
    breakthrough: {
      name: "Mended Grove",
      synergy: ["biotic", "cybernetic"],
      text: [
        "Gain the Grove card.",
        "When you resolve METEOR SLINGS, if you cancel all hits produced, you may place your units into coexistence; you cannot commit those coexisting ground forces during this action.",
      ],
      note: "The Grove card text is not described on the wiki.",
    },
  },
  mirveda: {
    breakthrough: {
      name: "Stabilization Arrays",
      synergy: ["propulsion", "cybernetic"],
      text: [
        "If you have the Fighter II unit upgrade technology, flip this card and place it on top of Fighter II.",
      ],
      note: "Flip side (upgraded Fighter II) is not described on the wiki.",
    },
  },
  myko: {
    breakthrough: {
      name: "Dreamwalkers",
      synergy: ["biotic", "cybernetic"],
      text: [
        "Capture other player's infantry that are destroyed during combat on planets you control.",
        "After each round of ground combat on a planet you control, roll a die. On a result of 7 or greater, place up to 1 of your captured infantry onto that planet, as if it were your own.",
      ],
    },
  },
  nivyn: {
    breakthrough: {
      name: "Anomaly Stabilization",
      synergy: ["propulsion", "warfare"],
      text: [
        "The system that contains the Wound token is also an entropic scar. You may ignore the effects of entropic scars.",
        "You may treat entropic scars as ingress tokens.",
      ],
    },
  },
  olradin: {
    breakthrough: {
      name: "Insurrectionist Networking",
      synergy: ["biotic", "warfare"],
      text: [
        "Once per action, after you resolve a policy ability, you may spend 1 trade good to move 1 of your infantry on the game board into coexistence on a planet in an adjacent system.",
        "ACTION: Purge this card to resolve invasion on all planets that contain your coexisting infantry.",
      ],
    },
  },
  rohdina: {
    breakthrough: {
      name: "The Prodigy's Triumph",
      synergy: ["propulsion", "cybernetic"],
      text: [
        "If you have the Terrafactory II technology, flip this card and place it on top of Terrafactory II.",
      ],
      note: "Flip side (upgraded Terrafactory II) is not described on the wiki.",
    },
  },
  cymiae: {
    breakthrough: {
      name: "Cybernetic Armoring",
      synergy: ["cybernetic", "warfare"],
      text: [
        "After you win a combat, you may purge 1 of your promissory notes from your hand to move 1 other player's command token in the active system to an adjacent system, or gain 2 trade goods.",
        "ACTION: Exhaust this card to discard the top 3 cards of the action card deck.",
      ],
    },
  },
  axis: {
    breakthrough: {
      name: "Arms Brokerage",
      synergy: ["propulsion", "warfare"],
      text: [
        "At the start of a player's turn, you may exhaust this card to allow that player to treat 1 of your unit upgrade technologies as their own until the end of that turn.",
        "After you replenish commodities, gain a number of trade goods equal to the number of unit upgrade technologies you own.",
      ],
    },
  },
  tnelis: {
    breakthrough: {
      name: "Hidden Hardpoints",
      synergy: ["propulsion", "warfare"],
      text: [
        "At the end of a round of ground combat, you may discard 1 secret objective to have all your participating units enter coexistence; that combat ends in a draw.",
        "When another player ends your units' coexistence on a planet, you may draw 1 secret objective.",
      ],
    },
  },
  vaden: {
    breakthrough: {
      name: "High Security Vault",
      synergy: ["biotic", "warfare"],
      text: [
        "Other players cannot take any of your trade goods, commodities, or relic fragments unless you allow it.",
        "When another player returns 1 of your promissory notes, place 1 of their control tokens on your faction sheet.",
      ],
    },
  },
  vaylerian: {
    breakthrough: {
      name: "Gravitic Disruption",
      synergy: ["propulsion", "warfare"],
      text: [
        "After you move 1 or more ships into the active system, you may discard an action card to move 1 of those ships into an adjacent system that does not contain another player's ships.",
      ],
    },
  },
  veldyr: {
    breakthrough: {
      name: "Aurora Research Base",
      synergy: ["propulsion", "cybernetic"],
      text: [
        "Your home system is also a nebula. Hits produced by the ability rolls of your units in nebulae cannot be canceled.",
        "When you pass, explore the frontier deck in your home system.",
      ],
    },
  },
  rhodun: {
    breakthrough: {
      name: "Rhodun's Reliquary",
      synergy: ["cybernetic", "warfare"],
      text: [
        "After you gain control of a legendary or fracture planet, you may research 1 technology or remove 1 of your command tokens in that system and return it to your reinforcements.",
      ],
    },
  },
  zelian: {
    breakthrough: {
      name: "Awakened Planetoids",
      synergy: ["biotic", "warfare"],
      text: [
        "Your planets in the active system participate in space combat if that system contains 1 or more of your ships, and ground combat on themselves if they contain 1 or more of your ground forces.",
        "Your planets cannot be assigned hits and have a combat value equal to 10 minus their resource value, minimum 1.",
      ],
    },
  },
  bentor: {
    breakthrough: {
      name: "Historian Conclave",
      synergy: ["biotic", "propulsion"],
      text: [
        "ACTION: Exhaust this card to allow all other players to explore 1 planet they control. Then, place up to 1 infantry from your reinforcements into coexistence on 1 of those planets.",
        "When you explore a planet, you may exhaust this card to instead explore the frontier deck in that system.",
      ],
    },
  },
  kjalengard: {
    breakthrough: {
      name: "Bannerhalls",
      synergy: ["biotic", "warfare"],
      text: [
        "For each Glory token on the game board, you control 1 Bannerhall card.",
        "Once per action, when a player wins a combat in a system that contains a Glory token, ready each Bannerhall card.",
      ],
    },
  },
  cheiran: {
    breakthrough: {
      name: "Matriphagy",
      synergy: ["propulsion", "warfare"],
      text: [
        "At the end of your turn, you may exhaust this card to choose 1 of your non-fighter ships on the game board; replace that ship with 1 or more units from your reinforcements that have a total combined cost less than that ship's cost value.",
      ],
    },
  },
  edyn: {
    breakthrough: {
      name: "Celestial Ambassadors",
      synergy: ["biotic", "propulsion"],
      text: [
        "ACTION: Exhaust this card and show another player 1 of your unscored secret objectives; that player must show you 1 of their unscored secret objectives, at random, or allow you to place 1 ground force from your reinforcements into coexistence on a planet they control.",
      ],
    },
  },
  ghoti: {
    breakthrough: {
      name: "Cult of the All-Mother",
      synergy: ["biotic", "propulsion"],
      text: [
        "When you pass, you may exhaust this card to move 1 ingress token into an empty system, or move 1 of your ships to an adjacent system that contains your ships.",
        "Your units may retreat to any empty system that does not contain another player's ships.",
      ],
    },
  },
  gledge: {
    breakthrough: {
      name: "Dhonraz Installations",
      synergy: ["propulsion", "cybernetic"],
      text: [
        "Planets you control that contain core tokens are also treated as stations except for the purposes of control; units can be committed to, produced on, and placed on these planets.",
        "Stations you control have SPACE CANNON 5.",
      ],
    },
  },
  kyro: {
    breakthrough: {
      name: "Strain Dispersal",
      synergy: ["cybernetic", "warfare"],
      text: [
        "When researching a technology, you may discard an action card to ignore 1 of that technology's prerequisites.",
        "Once per action, when you win a combat, for each technology your opponent owns, if you do not own that technology, gain 1 commodity or convert 1 of your commodities to a trade good.",
      ],
    },
  },
  lanefir: {
    breakthrough: {
      name: "Erasure Corps.",
      synergy: ["biotic", "warfare"],
      text: [
        "After another player purges 1 or more non-action card components, gain 1 command token or ready this card.",
        "During the action phase, you may exhaust this card to explore 1 planet you control.",
      ],
    },
  },
  kolume: {
    breakthrough: {
      name: "Synchronicity VI",
      synergy: ["propulsion", "cybernetic"],
      text: [
        "ACTION: Exhaust this card to either gain 1 command token, or research a technology of the same color as one of your exhausted technologies.",
        "When you exhaust a technology, gain 1 commodity.",
      ],
    },
  },
  nokar: {
    breakthrough: {
      name: "Mercenary Captains",
      synergy: ["cybernetic", "warfare"],
      text: [
        "ACTION: Exhaust this card to place 1 neutral cruiser and 2 neutral destroyers into a non-fracture system that contains no non-neutral ships.",
        "After another player wins a space combat in a system that contains your ships, gain 2 commodities or 1 command token.",
      ],
    },
  },
};
