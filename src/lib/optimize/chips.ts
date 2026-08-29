import { abbr } from "@/lib/abbr";
import type { FplChipName, FplChipPlay } from "@/lib/fpl/types";
import { chipHalf, FIRST_CHIP_HALF_END, lastChipEvent } from "@/lib/fpl/rules";
import type { RankedPlayer } from "@/lib/xp/model";
import type { LineupResult } from "./lineup";
import type { TransferPlan } from "./transfers";

export type ChipAdvice = {
  chip: FplChipName;
  label: string;
  available: boolean;
  usedThisHalf: boolean;
  recommend: boolean;
  urgency: "none" | "soon" | "now";
  reason: string;
};

const LABELS: Record<FplChipName, string> = {
  wildcard: "Wildcard",
  freehit: "Free Hit",
  bboost: "Bench Boost",
  "3xc": "Triple Captain",
};

function usedInHalf(plays: FplChipPlay[], chip: FplChipName, eventId: number): boolean {
  const half = chipHalf(eventId);
  return plays.some((play) => {
    if (play.name !== chip) return false;
    return chipHalf(play.event) === half;
  });
}

export function chipAdvice(opts: {
  eventId: number;
  plays: FplChipPlay[];
  lineup: LineupResult;
  squad: RankedPlayer[];
  bestPlan: TransferPlan;
  holdPlan: TransferPlan;
}): ChipAdvice[] {
  const { eventId, plays, lineup, squad, bestPlan, holdPlan } = opts;
  const last = lastChipEvent(eventId);
  const gwsLeft = last - eventId + 1;
  const halfEndSoon = gwsLeft <= 2;

  const available = (chip: FplChipName) => !usedInHalf(plays, chip, eventId);
  const lockedEarly = (chip: FplChipName) =>
    (chip === "wildcard" || chip === "freehit") && eventId < 2;

  const tcPlayer = lineup.captain;
  const tcRecommend =
    available("3xc") &&
    !lockedEarly("3xc") &&
    (tcPlayer.xpThis >= 8.2 || (halfEndSoon && tcPlayer.xpThis >= 6.5));

  const benchXp = lineup.bench.reduce((s, p) => s + p.xpThis, 0);
  const bbRecommend =
    available("bboost") &&
    (benchXp >= 12 || (halfEndSoon && benchXp >= 8));

  const badFdr = lineup.xi.filter((p) => (p.fdrThis ?? 3) >= 4).length;
  const blanks = squad.filter((p) => p.fixtures.filter((f) => f.event === eventId).length === 0)
    .length;
  const doubles = squad.filter((p) => p.fixtures.filter((f) => f.event === eventId).length >= 2)
    .length;
  const fhRecommend =
    available("freehit") &&
    !lockedEarly("freehit") &&
    (blanks >= 4 || doubles >= 6 || badFdr >= 4 || (halfEndSoon && badFdr >= 3));

  const hitCost = bestPlan.hitCost;
  const injured = squad.filter(
    (p) => p.pMinutes < 0.4 || p.status === "i" || p.status === "s" || p.status === "u",
  ).length;
  const wcRecommend =
    available("wildcard") &&
    !lockedEarly("wildcard") &&
    (hitCost >= 8 || injured >= 4 || (halfEndSoon && (hitCost >= 4 || injured >= 2)));

  const rows: Array<Omit<ChipAdvice, "label">> = [
    {
      chip: "3xc",
      available: available("3xc") && !lockedEarly("3xc"),
      usedThisHalf: usedInHalf(plays, "3xc", eventId),
      recommend: tcRecommend,
      urgency: tcRecommend && halfEndSoon ? "now" : tcRecommend ? "soon" : halfEndSoon && available("3xc") ? "now" : "none",
      reason: tcRecommend
        ? `${tcPlayer.webName} is on ${tcPlayer.xpThis.toFixed(1)} ${abbr("xp")} — triple it this week.`
        : available("3xc")
          ? `Best captain ${tcPlayer.webName} is ${tcPlayer.xpThis.toFixed(1)} ${abbr("xp")}. Wait for a bigger ceiling (or use by ${abbr("gw")} ${last}).`
          : `Already used in GW1–${FIRST_CHIP_HALF_END >= eventId ? FIRST_CHIP_HALF_END : 38}.`,
    },
    {
      chip: "bboost",
      available: available("bboost"),
      usedThisHalf: usedInHalf(plays, "bboost", eventId),
      recommend: bbRecommend,
      urgency: bbRecommend && halfEndSoon ? "now" : bbRecommend ? "soon" : halfEndSoon && available("bboost") ? "now" : "none",
      reason: bbRecommend
        ? `Bench projects ${benchXp.toFixed(1)} ${abbr("xp")} this ${abbr("gw")}.`
        : available("bboost")
          ? `Bench is ${benchXp.toFixed(1)} ${abbr("xp")}. Hold unless the four subs all start, or use by ${abbr("gw")} ${last}.`
          : "Already used this half.",
    },
    {
      chip: "freehit",
      available: available("freehit") && !lockedEarly("freehit"),
      usedThisHalf: usedInHalf(plays, "freehit", eventId),
      recommend: fhRecommend,
      urgency: fhRecommend && halfEndSoon ? "now" : fhRecommend ? "soon" : halfEndSoon && available("freehit") ? "now" : "none",
      reason: fhRecommend
        ? blanks >= 4
          ? `Several blanks this ${abbr("gw")} — Free Hit is the cleanest path.`
          : doubles >= 6
            ? "Double-gameweek coverage is high enough to throw the kitchen sink."
            : `${badFdr} of your ${abbr("xi")} have ${abbr("fdr")} 4+ — a one-week rebuild beats the hit.`
        : available("freehit")
          ? `Save for a blank/double or a wrecked ${abbr("xi")}. Expires ${abbr("gw")} ${last}.`
          : "Already used this half.",
    },
    {
      chip: "wildcard",
      available: available("wildcard") && !lockedEarly("wildcard"),
      usedThisHalf: usedInHalf(plays, "wildcard", eventId),
      recommend: wcRecommend,
      urgency: wcRecommend && halfEndSoon ? "now" : wcRecommend ? "soon" : halfEndSoon && available("wildcard") ? "now" : "none",
      reason: wcRecommend
        ? hitCost >= 8
          ? `The optimizer wants ${bestPlan.hits} hits (${bestPlan.hitCost} pts). Wildcard is cheaper.`
          : `${injured} of your 15 have minutes risk. Rebuild the spine.`
        : available("wildcard")
          ? `Squad is stable enough (hold ${holdPlan.rawXp.toFixed(1)} ${abbr("xp")}). Don't burn Wildcard without a structural problem. Expires ${abbr("gw")} ${last}.`
          : "Already used this half.",
    },
  ];

  return rows.map((row) => ({ ...row, label: LABELS[row.chip] }));
}
