import type { ElementTypeId, FplElement, FplEvent, FplFixture, FplScoring, FplTeam } from "@/lib/fpl/types";
import {
  DEFAULT_SCORING,
  DEFCON_THRESHOLD,
  POS_SHORT,
} from "@/lib/fpl/rules";

export type FixtureSlice = {
  event: number;
  opponentId: number;
  opponent: string;
  opponentShort: string;
  opponentCode: number;
  home: boolean;
  fdr: number;
};

export type XpBreakdown = {
  minutes: number;
  appearance: number;
  goals: number;
  assists: number;
  cleanSheet: number;
  defcon: number;
  bonus: number;
  conceded: number;
  saves: number;
  cards: number;
  model: number;
  official: number;
  blended: number;
};

export type RankedPlayer = {
  id: number;
  webName: string;
  firstName: string;
  secondName: string;
  teamId: number;
  team: string;
  teamShort: string;
  position: ElementTypeId;
  positionShort: "GKP" | "DEF" | "MID" | "FWD";
  cost: number;
  selectedBy: number;
  form: number;
  pointsPerGame: number;
  status: string;
  news: string;
  chanceNext: number | null;
  minutes: number;
  starts: number;
  xpThis: number;
  xpNext3: number;
  xpNext5: number;
  pMinutes: number;
  fdrThis: number | null;
  fixtures: FixtureSlice[];
  defconRate: number;
  breakdown: XpBreakdown;
  epThis: number;
  epNext: number;
  modelThis: number;
  code: number;
  teamCode: number;
  squadNumber: number | null;
  value: number;
};

function num(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function posKey(position: ElementTypeId): "GKP" | "DEF" | "MID" | "FWD" {
  return POS_SHORT[position];
}

function attackMult(fdr: number, home: boolean): number {
  const base = ([0, 1.22, 1.12, 1, 0.88, 0.76][fdr] ?? 1) as number;
  return base * (home ? 1.06 : 0.96);
}

function cleanSheetProb(fdr: number, home: boolean): number {
  const base = ([0, 0.42, 0.34, 0.24, 0.16, 0.09][fdr] ?? 0.24) as number;
  return clamp(base + (home ? 0.04 : -0.03), 0.04, 0.55);
}

function expectedGoalsConceded(fdr: number, home: boolean): number {
  const base = ([0, 0.7, 0.95, 1.25, 1.6, 2.1][fdr] ?? 1.25) as number;
  return base * (home ? 0.92 : 1.08);
}

export function minutesProbability(
  player: FplElement,
  eventsPlayed: number,
  forNextGw: boolean,
): number {
  const chance = forNextGw
    ? player.chance_of_playing_next_round
    : player.chance_of_playing_this_round ?? player.chance_of_playing_next_round;
  const status = player.status;

  if (status === "u" || status === "n" || player.removed || !player.can_select) {
    return chance != null ? chance / 100 : 0.02;
  }
  if (status === "s" || status === "i") {
    return chance != null ? clamp(chance / 100, 0, 0.4) : 0.05;
  }
  if (status === "d") {
    return chance != null ? chance / 100 : 0.5;
  }
  if (chance != null) {
    const startShare =
      eventsPlayed > 0 ? clamp(player.starts / eventsPlayed, 0.25, 1) : 0.7;
    return clamp((chance / 100) * Math.max(0.65, startShare), 0, 0.98);
  }
  if (player.starts > 0) {
    return 0.9;
  }
  if (player.minutes > 0) {
    const denom = Math.max(1, eventsPlayed) * 90;
    return clamp(0.25 + player.minutes / denom, 0.2, 0.75);
  }
  if (player.now_cost >= 70) return 0.45;
  if (player.now_cost >= 50) return 0.28;
  return 0.12;
}

function priorRates(position: ElementTypeId): { xg: number; xa: number; defcon90: number } {
  switch (position) {
    case 1:
      return { xg: 0, xa: 0.01, defcon90: 0 };
    case 2:
      return { xg: 0.06, xa: 0.08, defcon90: 8 };
    case 3:
      return { xg: 0.16, xa: 0.14, defcon90: 9 };
    case 4:
      return { xg: 0.38, xa: 0.12, defcon90: 4 };
  }
}

function blendedRate(actual: number, prior: number, minutes: number): number {
  const weight = minutes / (minutes + 270);
  return weight * actual + (1 - weight) * prior;
}

export function fixturesForTeam(
  fixtures: FplFixture[],
  teams: Map<number, FplTeam>,
  teamId: number,
  fromEvent: number,
  horizon: number,
): FixtureSlice[] {
  const until = fromEvent + horizon - 1;
  const slices: FixtureSlice[] = [];
  for (const fx of fixtures) {
    if (fx.event == null || fx.event < fromEvent || fx.event > until) continue;
    if (fx.team_h !== teamId && fx.team_a !== teamId) continue;
    const home = fx.team_h === teamId;
    const opponentId = home ? fx.team_a : fx.team_h;
    const opponent = teams.get(opponentId);
    slices.push({
      event: fx.event,
      opponentId,
      opponent: opponent?.name ?? "TBD",
      opponentShort: opponent?.short_name ?? "TBD",
      opponentCode: opponent?.code ?? 0,
      home,
      fdr: home ? fx.team_h_difficulty : fx.team_a_difficulty,
    });
  }
  slices.sort((a, b) => a.event - b.event || Number(b.home) - Number(a.home));
  return slices;
}

function scoreFixture(
  player: FplElement,
  fixture: FixtureSlice,
  pStart: number,
  scoring: FplScoring,
): Omit<XpBreakdown, "official" | "blended"> {
  const pos = posKey(player.element_type);
  const pAny = clamp(pStart + 0.12, 0, 1);
  const cameo = Math.max(0, pAny - pStart);
  const appearance = pStart * scoring.long_play + cameo * scoring.short_play;

  const prior = priorRates(player.element_type);
  const xg90 = blendedRate(player.expected_goals_per_90, prior.xg, player.minutes);
  const xa90 = blendedRate(player.expected_assists_per_90, prior.xa, player.minutes);
  const attack = attackMult(fixture.fdr, fixture.home);

  const goals = pStart * xg90 * attack * (scoring.goals_scored[pos] ?? 4);
  const assists = pStart * xa90 * attack * scoring.assists;

  const csPts = scoring.clean_sheets[pos] ?? 0;
  const cleanSheet = csPts > 0 ? pStart * cleanSheetProb(fixture.fdr, fixture.home) * csPts : 0;

  const threshold = DEFCON_THRESHOLD[player.element_type];
  const defcon90 = blendedRate(
    player.defensive_contribution_per_90,
    prior.defcon90,
    player.minutes,
  );
  const defconPts = scoring.defensive_contribution[pos] ?? 0;
  const pDefcon =
    defconPts > 0 ? clamp(defcon90 / (threshold * 1.25), 0, 0.82) : 0;
  const defcon = pStart * pDefcon * defconPts;

  const bonus = pStart * clamp(0.12 + (xg90 + xa90) * 0.55, 0.08, 0.9);

  const gcPts = scoring.goals_conceded[pos] ?? 0;
  const conceded =
    gcPts !== 0
      ? pStart * (expectedGoalsConceded(fixture.fdr, fixture.home) / 2) * gcPts
      : 0;

  const saves =
    player.element_type === 1
      ? pStart * (clamp(player.saves_per_90 || 3.2, 1.5, 5.5) / 3) * scoring.saves
      : 0;

  const games = Math.max(1, player.starts || (player.minutes > 0 ? 1 : 1));
  const cards =
    pStart *
    ((player.yellow_cards / games) * scoring.yellow_cards +
      (player.red_cards / games) * scoring.red_cards);

  const model =
    appearance + goals + assists + cleanSheet + defcon + bonus + conceded + saves + cards;

  return {
    minutes: pStart,
    appearance,
    goals,
    assists,
    cleanSheet,
    defcon,
    bonus,
    conceded,
    saves,
    cards,
    model,
  };
}

function emptyBreakdown(): XpBreakdown {
  return {
    minutes: 0,
    appearance: 0,
    goals: 0,
    assists: 0,
    cleanSheet: 0,
    defcon: 0,
    bonus: 0,
    conceded: 0,
    saves: 0,
    cards: 0,
    model: 0,
    official: 0,
    blended: 0,
  };
}

export function projectPlayer(
  player: FplElement,
  team: FplTeam,
  upcoming: FplEvent,
  eventsPlayed: number,
  next3: FixtureSlice[],
  next5: FixtureSlice[],
  scoring: FplScoring,
): RankedPlayer {
  const forNext = Boolean(upcoming.is_next) || upcoming.finished === false;
  const pMinutes = minutesProbability(player, Math.max(1, eventsPlayed), forNext);
  const official = upcoming.is_next ? num(player.ep_next) : num(player.ep_this);
  const first = next5.filter((f) => f.event === upcoming.id);
  const firstModel =
    first.length === 0
      ? 0
      : first.reduce((sum, fx) => sum + scoreFixture(player, fx, pMinutes, scoring).model, 0);

  const blendFirst = first.length === 0 ? 0 : 0.5 * firstModel + 0.5 * official;
  const scale = firstModel > 0.15 ? blendFirst / firstModel : 1;

  const sumHorizon = (slices: FixtureSlice[]) => {
    let total = 0;
    const grouped = new Map<number, FixtureSlice[]>();
    for (const s of slices) {
      const list = grouped.get(s.event) ?? [];
      list.push(s);
      grouped.set(s.event, list);
    }
    for (const [eventId, gws] of grouped) {
      const raw = gws.reduce(
        (sum, fx) => sum + scoreFixture(player, fx, pMinutes, scoring).model,
        0,
      );
      total += eventId === upcoming.id ? blendFirst : raw * scale;
    }
    return total;
  };

  const breakdownParts =
    first.length > 0
      ? first.reduce(
          (acc, fx) => {
            const part = scoreFixture(player, fx, pMinutes, scoring);
            acc.appearance += part.appearance;
            acc.goals += part.goals;
            acc.assists += part.assists;
            acc.cleanSheet += part.cleanSheet;
            acc.defcon += part.defcon;
            acc.bonus += part.bonus;
            acc.conceded += part.conceded;
            acc.saves += part.saves;
            acc.cards += part.cards;
            acc.model += part.model;
            return acc;
          },
          emptyBreakdown(),
        )
      : emptyBreakdown();

  const xpThis = blendFirst;
  const xpNext3 = sumHorizon(next3);
  const xpNext5 = sumHorizon(next5);
  const costM = player.now_cost / 10;
  const threshold = DEFCON_THRESHOLD[player.element_type];
  const defconRate =
    threshold >= 99
      ? 0
      : clamp(player.defensive_contribution_per_90 / threshold, 0, 1);

  return {
    id: player.id,
    webName: player.web_name,
    firstName: player.first_name,
    secondName: player.second_name,
    teamId: player.team,
    team: team.name,
    teamShort: team.short_name,
    position: player.element_type,
    positionShort: POS_SHORT[player.element_type],
    cost: player.now_cost,
    selectedBy: num(player.selected_by_percent),
    form: num(player.form),
    pointsPerGame: num(player.points_per_game),
    status: player.status,
    news: player.news,
    chanceNext: player.chance_of_playing_next_round,
    minutes: player.minutes,
    starts: player.starts,
    xpThis,
    xpNext3,
    xpNext5,
    pMinutes,
    fdrThis: first[0]?.fdr ?? null,
    fixtures: next5,
    defconRate,
    breakdown: {
      ...breakdownParts,
      minutes: pMinutes,
      official,
      blended: xpThis,
    },
    epThis: num(player.ep_this),
    epNext: num(player.ep_next),
    modelThis: firstModel,
    code: player.code,
    teamCode: player.team_code,
    squadNumber: player.squad_number ?? null,
    value: costM > 0 ? xpNext5 / costM : 0,
  };
}

export function scoringFromBootstrap(scoring?: FplScoring): FplScoring {
  return scoring ?? DEFAULT_SCORING;
}
