import { cache } from "react";
import { fetchBootstrap, fetchFixturesLive } from "@/lib/fpl/client";
import type { FplEvent, FplFixture, FplTeam } from "@/lib/fpl/types";
import { resolveUpcoming } from "@/lib/snapshot";

export type MatchStatus = "live" | "upcoming" | "finished";

export type MatchSide = {
  id: number;
  name: string;
  short: string;
  code: number;
  score: number | null;
  fdr: number;
  rating: number;
};

export type MatchView = {
  id: number;
  event: number;
  eventName: string;
  kickoff: string | null;
  status: MatchStatus;
  minutes: number;
  home: MatchSide;
  away: MatchSide;
  winner: "home" | "away" | "draw" | null;
  winRating: number | null;
};

export type MatchEventGroup = {
  eventId: number;
  name: string;
  deadline: string | null;
  matches: MatchView[];
};

export type MatchBoardData = {
  fetchedAt: string;
  live: MatchView[];
  groups: MatchEventGroup[];
  upcomingEventId: number;
  currentEventId: number | null;
};

function unknownTeam(id: number): FplTeam {
  return {
    id,
    name: `Team ${id}`,
    short_name: "???",
    code: 0,
    strength: null,
    strength_attack_home: 0,
    strength_attack_away: 0,
    strength_defence_home: 0,
    strength_defence_away: 0,
  };
}

export function matchStatus(fx: FplFixture, now = Date.now()): MatchStatus {
  if (fx.finished || fx.finished_provisional) return "finished";
  if (fx.started) return "live";
  if (fx.kickoff_time) {
    const kick = Date.parse(fx.kickoff_time);
    if (Number.isFinite(kick) && kick <= now && !fx.finished) return "live";
  }
  return "upcoming";
}

function clubRating(team: FplTeam): number {
  const parts = [
    team.strength_attack_home,
    team.strength_attack_away,
    team.strength_defence_home,
    team.strength_defence_away,
  ].filter((n) => n > 0);
  if (parts.length === 0) {
    if (team.strength && team.strength > 0) {
      return Math.min(10, team.strength <= 5 ? team.strength * 2 : team.strength);
    }
    return 6;
  }
  const avg = parts.reduce((sum, n) => sum + n, 0) / parts.length;
  const scaled = 5.2 + ((avg - 1100) / 320) * 4;
  return Math.round(Math.min(9.8, Math.max(4.4, scaled)) * 10) / 10;
}

function winRating(winnerFdr: number, goalDiff: number, away: boolean): number {
  const base =
    5.7 +
    Math.min(4, goalDiff) * 0.7 +
    (winnerFdr - 3) * 0.65 +
    (away ? 0.35 : 0);
  return Math.round(Math.min(9.9, Math.max(5.4, base)) * 10) / 10;
}

function sideOf(
  team: FplTeam,
  score: number | null,
  fdr: number,
): MatchSide {
  return {
    id: team.id,
    name: team.name,
    short: team.short_name,
    code: team.code,
    score,
    fdr,
    rating: clubRating(team),
  };
}

export function toMatchView(
  fx: FplFixture,
  teams: Map<number, FplTeam>,
  events: Map<number, FplEvent>,
  now = Date.now(),
): MatchView | null {
  if (fx.event == null) return null;
  const homeTeam = teams.get(fx.team_h) ?? unknownTeam(fx.team_h);
  const awayTeam = teams.get(fx.team_a) ?? unknownTeam(fx.team_a);
  const event = events.get(fx.event);
  const home = sideOf(homeTeam, fx.team_h_score, fx.team_h_difficulty);
  const away = sideOf(awayTeam, fx.team_a_score, fx.team_a_difficulty);
  const status = matchStatus(fx, now);
  let winner: MatchView["winner"] = null;
  let winRatingValue: number | null = null;
  if (
    (status === "finished" || status === "live") &&
    home.score != null &&
    away.score != null
  ) {
    if (home.score > away.score) {
      winner = "home";
      winRatingValue = winRating(home.fdr, home.score - away.score, false);
    } else if (away.score > home.score) {
      winner = "away";
      winRatingValue = winRating(away.fdr, away.score - home.score, true);
    } else {
      winner = "draw";
    }
  }
  return {
    id: fx.id,
    event: fx.event,
    eventName: event?.name ?? `Gameweek ${fx.event}`,
    kickoff: fx.kickoff_time,
    status,
    minutes: fx.minutes ?? 0,
    home,
    away,
    winner,
    winRating: winRatingValue,
  };
}

function sortMatches(a: MatchView, b: MatchView): number {
  const order = { live: 0, upcoming: 1, finished: 2 };
  const byStatus = order[a.status] - order[b.status];
  if (byStatus !== 0) return byStatus;
  return (a.kickoff ?? "").localeCompare(b.kickoff ?? "") || a.id - b.id;
}

export function buildMatchBoard(
  fixtures: FplFixture[],
  teams: FplTeam[],
  events: FplEvent[],
  now = Date.now(),
): MatchBoardData {
  const upcoming = resolveUpcoming(events);
  const current = events.find((e) => e.is_current) ?? null;
  const startId =
    current && !current.finished ? current.id : upcoming.id;
  const eventIds = events
    .filter((e) => e.id >= startId - 1 && e.id <= startId + 2)
    .map((e) => e.id);

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const eventMap = new Map(events.map((e) => [e.id, e]));
  const views = fixtures
    .map((fx) => toMatchView(fx, teamMap, eventMap, now))
    .filter((m): m is MatchView => m != null);

  const live = views.filter((m) => m.status === "live").sort(sortMatches);
  const groups: MatchEventGroup[] = eventIds.map((eventId) => {
    const event = eventMap.get(eventId);
    return {
      eventId,
      name: event?.name ?? `Gameweek ${eventId}`,
      deadline: event?.deadline_time ?? null,
      matches: views.filter((m) => m.event === eventId).sort(sortMatches),
    };
  }).filter((g) => g.matches.length > 0);

  return {
    fetchedAt: new Date(now).toISOString(),
    live,
    groups,
    upcomingEventId: upcoming.id,
    currentEventId: current?.id ?? null,
  };
}

export async function loadMatchBoard(opts?: {
  fresh?: boolean;
}): Promise<MatchBoardData> {
  const [bootstrap, fixtures] = await Promise.all([
    fetchBootstrap(),
    fetchFixturesLive(opts?.fresh ? 0 : 3_000),
  ]);
  return buildMatchBoard(fixtures, bootstrap.teams, bootstrap.events);
}

export const getMatchBoard = cache(async (): Promise<MatchBoardData> => {
  return loadMatchBoard();
});
