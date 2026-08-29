import { abbr } from "@/lib/abbr";
import { DEFCON_THRESHOLD, POS_SHORT } from "@/lib/fpl/rules";
import type { ElementTypeId } from "@/lib/fpl/types";
import type { FplElementHistory, FplElementSummary, FplTeam } from "@/lib/fpl/types";

function num(value: string | number | null | undefined): number {
  if (value == null || value === "") return 0;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

export type RecentMatch = {
  fixtureId: number;
  round: number;
  opponentShort: string;
  opponentCode: number;
  home: boolean;
  minutes: number;
  points: number;
  goals: number;
  assists: number;
  xg: number;
  xa: number;
  cleanSheet: boolean;
  conceded: number;
  saves: number;
  defcon: number;
  defconHit: boolean;
  bonus: number;
  bps: number;
  yellow: number;
  red: number;
  started: boolean;
  score: string;
};

export type RecentTotals = {
  matches: number;
  points: number;
  minutes: number;
  starts: number;
  goals: number;
  assists: number;
  xg: number;
  xa: number;
  bonus: number;
  hauls: number;
  blanks: number;
  defconHits: number;
  cleanSheets: number;
  saves: number;
  conceded: number;
  avgPoints: number;
  ptsPer90: number;
};

export type LastSeason = {
  season: string;
  points: number;
  minutes: number;
  goals: number;
  assists: number;
  starts: number;
  cleanSheets: number;
};

export type PlayerRecent = {
  matches: RecentMatch[];
  totals: RecentTotals;
  insights: string[];
  lastSeason: LastSeason | null;
};

export function buildPlayerRecent(
  summary: FplElementSummary,
  teams: FplTeam[],
  position: ElementTypeId,
): PlayerRecent {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const threshold = DEFCON_THRESHOLD[position];
  const raw = [...(summary.history ?? [])]
    .sort((a, b) => b.round - a.round)
    .slice(0, 8);

  const matches: RecentMatch[] = raw.map((row) => toMatch(row, teamMap, threshold));
  const totals = sumMatches(matches);
  const past = [...(summary.history_past ?? [])].sort((a, b) =>
    b.season_name.localeCompare(a.season_name),
  )[0];
  const lastSeason: LastSeason | null = past
    ? {
        season: past.season_name,
        points: past.total_points,
        minutes: past.minutes,
        goals: past.goals_scored,
        assists: past.assists,
        starts: past.starts,
        cleanSheets: past.clean_sheets ?? 0,
      }
    : null;

  return {
    matches,
    totals,
    insights: insights(matches, totals, position, lastSeason),
    lastSeason,
  };
}

function toMatch(
  row: FplElementHistory,
  teams: Map<number, FplTeam>,
  threshold: number,
): RecentMatch {
  const opp = teams.get(row.opponent_team);
  const hs = row.team_h_score;
  const as = row.team_a_score;
  const score =
    hs == null || as == null
      ? "—"
      : row.was_home
        ? `${hs}–${as}`
        : `${as}–${hs}`;
  const defcon = row.defensive_contribution ?? 0;
  return {
    fixtureId: row.fixture,
    round: row.round,
    opponentShort: opp?.short_name ?? "?",
    opponentCode: opp?.code ?? 0,
    home: row.was_home,
    minutes: row.minutes,
    points: row.total_points,
    goals: row.goals_scored ?? 0,
    assists: row.assists ?? 0,
    xg: num(row.expected_goals),
    xa: num(row.expected_assists),
    cleanSheet: Boolean(row.clean_sheets),
    conceded: row.goals_conceded ?? 0,
    saves: row.saves ?? 0,
    defcon,
    defconHit: threshold < 99 && defcon >= threshold,
    bonus: row.bonus ?? 0,
    bps: row.bps ?? 0,
    yellow: row.yellow_cards ?? 0,
    red: row.red_cards ?? 0,
    started: Boolean(row.starts ?? (row.minutes >= 60)),
    score,
  };
}

function sumMatches(matches: RecentMatch[]): RecentTotals {
  const points = matches.reduce((s, m) => s + m.points, 0);
  const minutes = matches.reduce((s, m) => s + m.minutes, 0);
  return {
    matches: matches.length,
    points,
    minutes,
    starts: matches.filter((m) => m.started).length,
    goals: matches.reduce((s, m) => s + m.goals, 0),
    assists: matches.reduce((s, m) => s + m.assists, 0),
    xg: matches.reduce((s, m) => s + m.xg, 0),
    xa: matches.reduce((s, m) => s + m.xa, 0),
    bonus: matches.reduce((s, m) => s + m.bonus, 0),
    hauls: matches.filter((m) => m.points >= 8).length,
    blanks: matches.filter((m) => m.minutes > 0 && m.points <= 2).length,
    defconHits: matches.filter((m) => m.defconHit).length,
    cleanSheets: matches.filter((m) => m.cleanSheet).length,
    saves: matches.reduce((s, m) => s + m.saves, 0),
    conceded: matches.reduce((s, m) => s + m.conceded, 0),
    avgPoints: matches.length ? points / matches.length : 0,
    ptsPer90: minutes > 0 ? (points * 90) / minutes : 0,
  };
}

function insights(
  matches: RecentMatch[],
  totals: RecentTotals,
  position: ElementTypeId,
  lastSeason: LastSeason | null,
): string[] {
  const out: string[] = [];
  const n = totals.matches;
  const pos = POS_SHORT[position];

  if (n === 0) {
    out.push("No matches this season yet — lean on last season and minutes risk.");
    return out;
  }
  if (n < 5) {
    out.push(`Only ${n} match${n === 1 ? "" : "es"} this season. Last 8 will fill in as weeks play.`);
  }

  if (totals.starts === n && n >= 2) {
    out.push(`Started every game (${n}/${n}) — nailed until rotation or a flag.`);
  } else if (totals.minutes / Math.max(n, 1) < 45) {
    out.push(`Low minutes in this sample — treat ${abbr("xp")} as a cameo, not a starter.`);
  } else if (totals.starts < n) {
    out.push(`Cameo risk: started ${totals.starts}/${n}. Bench or rotation is in the data.`);
  }

  const gi = totals.goals + totals.assists;
  const xgi = totals.xg + totals.xa;
  if (n >= 2 && xgi >= 0.4) {
    const delta = gi - xgi;
    if (delta >= 0.8) {
      out.push(
        `${gi} ${abbr("ga")} vs ${xgi.toFixed(1)} ${abbr("xgi")} — running hot. Don't chase the overperformance forever.`,
      );
    } else if (delta <= -0.8) {
      out.push(
        `${gi} ${abbr("ga")} vs ${xgi.toFixed(1)} ${abbr("xgi")} — finishing cold. The underlying chance is better than the points.`,
      );
    } else {
      out.push(`Output matches the film: ${gi} ${abbr("ga")} on ${xgi.toFixed(1)} ${abbr("xgi")}.`);
    }
  }

  if (position === 2 || position === 3) {
    if (totals.defconHits >= Math.ceil(n / 2) && n >= 2) {
      out.push(`${abbr("defcon")} in ${totals.defconHits}/${n} — a real 2-pt floor, not just attacking luck.`);
    } else if (n >= 2 && pos === "DEF") {
      out.push(`${abbr("defcon")} only ${totals.defconHits}/${n}. Don't buy this defender for the extra 2 pts.`);
    }
  }

  if ((position === 1 || position === 2) && n >= 2) {
    const cs = matches.filter((m) => m.cleanSheet).length;
    out.push(`${cs}/${n} clean sheets in the sample.`);
  }

  if (totals.hauls > 0) {
    out.push(`${totals.hauls} haul${totals.hauls === 1 ? "" : "s"} (≥8 pts). Ceiling is real.`);
  }
  if (totals.blanks >= 2) {
    out.push(`${totals.blanks} blanks (≤2 pts). Volatility is the tax on this pick.`);
  }

  if (lastSeason && lastSeason.minutes >= 900) {
    out.push(
      `${lastSeason.season}: ${lastSeason.points} pts in ${lastSeason.starts} starts — use that as the prior while the sample is small.`,
    );
  }

  return out.slice(0, 5);
}
