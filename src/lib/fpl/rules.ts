import type { ElementTypeId, FplScoring } from "./types";

export const POS_SHORT: Record<ElementTypeId, "GKP" | "DEF" | "MID" | "FWD"> = {
  1: "GKP",
  2: "DEF",
  3: "MID",
  4: "FWD",
};

export const POS_LABEL: Record<ElementTypeId, string> = {
  1: "Goalkeepers",
  2: "Defenders",
  3: "Midfielders",
  4: "Forwards",
};

export const SQUAD_COUNT: Record<ElementTypeId, number> = {
  1: 2,
  2: 5,
  3: 5,
  4: 3,
};

export const XI_MIN: Record<ElementTypeId, number> = {
  1: 1,
  2: 3,
  3: 2,
  4: 1,
};

export const XI_MAX: Record<ElementTypeId, number> = {
  1: 1,
  2: 5,
  3: 5,
  4: 3,
};

export const SQUAD_SIZE = 15;
export const XI_SIZE = 11;
export const TEAM_LIMIT = 3;
export const STARTING_BUDGET = 1000;
export const HIT_COST = 4;
export const MAX_FREE_TRANSFERS = 5;
export const FIRST_CHIP_HALF_END = 19;
export const DEFCON_THRESHOLD: Record<ElementTypeId, number> = {
  1: 99,
  2: 10,
  3: 12,
  4: 12,
};

export const DEFAULT_SCORING: FplScoring = {
  long_play: 2,
  short_play: 1,
  goals_scored: { GKP: 10, DEF: 6, MID: 5, FWD: 4 },
  assists: 3,
  clean_sheets: { GKP: 4, DEF: 4, MID: 1, FWD: 0 },
  defensive_contribution: { GKP: 0, DEF: 2, MID: 2, FWD: 2 },
  goals_conceded: { GKP: -1, DEF: -1, MID: 0, FWD: 0 },
  saves: 1,
  penalties_saved: 5,
  penalties_missed: -2,
  yellow_cards: -1,
  red_cards: -3,
  own_goals: -2,
};

export function chipHalf(eventId: number): 1 | 2 {
  return eventId <= FIRST_CHIP_HALF_END ? 1 : 2;
}

export function lastChipEvent(eventId: number): number {
  return chipHalf(eventId) === 1 ? FIRST_CHIP_HALF_END : 38;
}

export function sellPrice(purchaseTenths: number, nowTenths: number): number {
  if (nowTenths <= purchaseTenths) return nowTenths;
  const profit = nowTenths - purchaseTenths;
  return purchaseTenths + Math.floor(profit / 2);
}
