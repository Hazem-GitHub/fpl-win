import { cache } from "react";
import { fetchBootstrap, fetchFixturesLive } from "@/lib/fpl/client";
import { DEFAULT_SCORING, DEFCON_THRESHOLD, POS_SHORT } from "@/lib/fpl/rules";
import type {
  ElementTypeId,
  FplElement,
  FplEvent,
  FplFixture,
  FplFixtureStat,
  FplTeam,
} from "@/lib/fpl/types";
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

export type MatchStatPlayer = {
  id: number;
  name: string;
  value: number;
};

export type MatchStatBlock = {
  id: string;
  label: string;
  home: MatchStatPlayer[];
  away: MatchStatPlayer[];
};

export type MatchSheetPlayer = {
  id: number;
  name: string;
  code: number;
  teamCode: number;
  position: ElementTypeId;
  goals: number;
  assists: number;
  ownGoals: number;
  yellows: number;
  reds: number;
  saves: number;
  bonus: number;
  bps: number;
  pensSaved: number;
  pensMissed: number;
  defcon: number;
  defconHit: boolean;
  cleanSheet: boolean;
  conceded: number;
  /** FPL pts from this sheet: attacking, bonus, cards, saves, DC, CS, conceded. Not minutes. */
  sheetPts: number;
};

export type MatchSheet = {
  home: MatchSheetPlayer[];
  away: MatchSheetPlayer[];
};

export type MatchNewsItem = {
  id: number;
  name: string;
  code: number;
  teamCode: number;
  position: ElementTypeId;
  status: string;
  news: string;
  chance: number | null;
  newsAdded: string | null;
};

export type MatchNews = {
  home: MatchNewsItem[];
  away: MatchNewsItem[];
};

export type MatchPitchPlayer = {
  id: number;
  name: string;
  code: number;
  teamCode: number;
  position: ElementTypeId;
  number: number | null;
};

export type MatchView = {
  id: number;
  event: number;
  eventName: string;
  kickoff: string | null;
  deadline: string | null;
  status: MatchStatus;
  minutes: number;
  home: MatchSide;
  away: MatchSide;
  winner: "home" | "away" | "draw" | null;
  winRating: number | null;
  stats: MatchStatBlock[];
  sheet: MatchSheet;
  news: MatchNews;
  xi: { home: MatchPitchPlayer[]; away: MatchPitchPlayer[] };
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

const STAT_LABELS: Record<string, string> = {
  goals_scored: "Goals",
  assists: "Assists",
  own_goals: "Own goals",
  penalties_saved: "Pens saved",
  penalties_missed: "Pens missed",
  yellow_cards: "Yellows",
  red_cards: "Reds",
  saves: "Saves",
  bonus: "Bonus",
  bps: "Top BPS",
  defensive_contribution: "Defensive contrib",
};

const STAT_ORDER = Object.keys(STAT_LABELS);

function mapPlayers(
  rows: FplFixtureStat["h"] | undefined,
  names: Map<number, string>,
  trim?: number,
): MatchStatPlayer[] {
  const mapped = (rows ?? [])
    .map((row) => ({
      id: row.element,
      name: names.get(row.element) ?? `Player ${row.element}`,
      value: row.value,
    }))
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  return trim ? mapped.slice(0, trim) : mapped;
}

export function fixtureStats(
  stats: FplFixtureStat[] | undefined,
  names: Map<number, string>,
): MatchStatBlock[] {
  if (!stats?.length) return [];
  const byId = new Map(stats.map((row) => [row.identifier, row]));
  const blocks: MatchStatBlock[] = [];
  for (const id of STAT_ORDER) {
    const row = byId.get(id);
    if (!row) continue;
    const trim = id === "bps" || id === "defensive_contribution" ? 3 : undefined;
    const home = mapPlayers(row.h, names, trim);
    const away = mapPlayers(row.a, names, trim);
    if (home.length === 0 && away.length === 0) continue;
    blocks.push({
      id,
      label: STAT_LABELS[id] ?? id,
      home,
      away,
    });
  }
  return blocks;
}

const SHEET_FIELDS = {
  goals_scored: "goals",
  assists: "assists",
  own_goals: "ownGoals",
  penalties_saved: "pensSaved",
  penalties_missed: "pensMissed",
  yellow_cards: "yellows",
  red_cards: "reds",
  saves: "saves",
  bonus: "bonus",
  bps: "bps",
  defensive_contribution: "defcon",
} as const;

type SheetAccum = {
  id: number;
  name: string;
  code: number;
  teamCode: number;
  position: ElementTypeId;
  goals: number;
  assists: number;
  ownGoals: number;
  yellows: number;
  reds: number;
  saves: number;
  bonus: number;
  bps: number;
  pensSaved: number;
  pensMissed: number;
  defcon: number;
};

function unknownElement(id: number): SheetAccum {
  return {
    id,
    name: `Player ${id}`,
    code: 0,
    teamCode: 0,
    position: 4,
    goals: 0,
    assists: 0,
    ownGoals: 0,
    yellows: 0,
    reds: 0,
    saves: 0,
    bonus: 0,
    bps: 0,
    pensSaved: 0,
    pensMissed: 0,
    defcon: 0,
  };
}

function accumFrom(el: FplElement): SheetAccum {
  return {
    id: el.id,
    name: el.web_name,
    code: el.code,
    teamCode: el.team_code,
    position: el.element_type,
    goals: 0,
    assists: 0,
    ownGoals: 0,
    yellows: 0,
    reds: 0,
    saves: 0,
    bonus: 0,
    bps: 0,
    pensSaved: 0,
    pensMissed: 0,
    defcon: 0,
  };
}

function scoreSheetPlayer(raw: SheetAccum, conceded: number): MatchSheetPlayer {
  const pos = POS_SHORT[raw.position];
  const scoring = DEFAULT_SCORING;
  const cleanSheet = conceded === 0;
  const defconHit = raw.defcon >= DEFCON_THRESHOLD[raw.position];
  // FPL CS / goals conceded need 60+ minutes, which this feed does not include.
  // BPS is a rough stand-in so late subs are not handed a clean sheet.
  const likelySixty = raw.position === 1 ? raw.saves > 0 || raw.bps > 0 : raw.bps >= 10;
  const csPts =
    cleanSheet && likelySixty ? (scoring.clean_sheets[pos] ?? 0) : 0;
  const gc = scoring.goals_conceded[pos] ?? 0;
  const concededPts =
    likelySixty && gc !== 0 ? gc * Math.floor(conceded / 2) : 0;
  const sheetPts =
    raw.goals * (scoring.goals_scored[pos] ?? 0) +
    raw.assists * scoring.assists +
    raw.bonus +
    raw.yellows * scoring.yellow_cards +
    raw.reds * scoring.red_cards +
    raw.ownGoals * scoring.own_goals +
    raw.pensSaved * scoring.penalties_saved +
    raw.pensMissed * scoring.penalties_missed +
    Math.floor(raw.saves / 3) * scoring.saves +
    (defconHit ? (scoring.defensive_contribution[pos] ?? 0) : 0) +
    csPts +
    concededPts;
  return { ...raw, defconHit, cleanSheet: csPts > 0, conceded, sheetPts };
}

function mergeSheetSide(
  stats: FplFixtureStat[],
  side: "h" | "a",
  elements: Map<number, FplElement>,
  conceded: number,
): MatchSheetPlayer[] {
  const byId = new Map<number, SheetAccum>();
  for (const row of stats) {
    const field = SHEET_FIELDS[row.identifier as keyof typeof SHEET_FIELDS];
    if (!field) continue;
    for (const cell of row[side] ?? []) {
      let player = byId.get(cell.element);
      if (!player) {
        const el = elements.get(cell.element);
        player = el ? accumFrom(el) : unknownElement(cell.element);
        byId.set(cell.element, player);
      }
      player[field] = cell.value;
    }
  }
  return [...byId.values()]
    .map((player) => scoreSheetPlayer(player, conceded))
    .sort(
      (a, b) =>
        b.sheetPts - a.sheetPts ||
        b.bps - a.bps ||
        a.name.localeCompare(b.name),
    );
}

export function fixtureSheet(
  stats: FplFixtureStat[] | undefined,
  elements: Map<number, FplElement>,
  homeScore: number,
  awayScore: number,
): MatchSheet {
  if (!stats?.length) return { home: [], away: [] };
  return {
    home: mergeSheetSide(stats, "h", elements, awayScore),
    away: mergeSheetSide(stats, "a", elements, homeScore),
  };
}

export const EMPTY_SHEET: MatchSheet = { home: [], away: [] };
export const EMPTY_NEWS: MatchNews = { home: [], away: [] };

const NEWS_RANK: Record<string, number> = {
  i: 0,
  s: 1,
  u: 2,
  n: 3,
  d: 4,
  a: 5,
};

function newsItem(
  el: FplElement,
  eventId: number,
  currentEventId: number | null,
): MatchNewsItem {
  const useThis = currentEventId != null && eventId === currentEventId;
  const chance = useThis
    ? el.chance_of_playing_this_round
    : (el.chance_of_playing_next_round ?? el.chance_of_playing_this_round);
  return {
    id: el.id,
    name: el.web_name,
    code: el.code,
    teamCode: el.team_code,
    position: el.element_type,
    status: el.status,
    news: el.news.trim(),
    chance: chance == null ? null : chance,
    newsAdded: el.news_added ?? null,
  };
}

export function fixtureNews(
  elements: Map<number, FplElement>,
  teamId: number,
  eventId: number,
  currentEventId: number | null,
): MatchNewsItem[] {
  const rows: MatchNewsItem[] = [];
  for (const el of elements.values()) {
    if (el.team !== teamId) continue;
    const item = newsItem(el, eventId, currentEventId);
    if (!item.news && item.status === "a") continue;
    rows.push(item);
  }
  return rows.sort((a, b) => {
    const rank =
      (NEWS_RANK[a.status] ?? 9) - (NEWS_RANK[b.status] ?? 9);
    if (rank !== 0) return rank;
    const chance = (a.chance ?? 100) - (b.chance ?? 100);
    if (chance !== 0) return chance;
    return (b.newsAdded ?? "").localeCompare(a.newsAdded ?? "") ||
      a.name.localeCompare(b.name);
  });
}

function pitchOf(
  id: number,
  name: string,
  code: number,
  teamCode: number,
  position: ElementTypeId,
  number: number | null,
): MatchPitchPlayer {
  return { id, name, code, teamCode, position, number };
}

function fromElement(el: FplElement): MatchPitchPlayer {
  return pitchOf(
    el.id,
    el.web_name,
    el.code,
    el.team_code,
    el.element_type,
    el.squad_number,
  );
}

function starterScore(el: FplElement): number {
  if (el.removed) return -1e9;
  const chance =
    el.chance_of_playing_this_round ??
    el.chance_of_playing_next_round ??
    (el.status === "a" ? 100 : el.status === "d" ? 50 : 0);
  if (chance <= 0) return -1e6 + el.minutes;
  return (
    chance * 10 +
    el.starts * 6 +
    el.minutes / 20 +
    Number.parseFloat(el.ep_this || "0") * 8 +
    el.total_points / 15
  );
}

function takePos(
  pool: FplElement[],
  pos: ElementTypeId,
  n: number,
  used: Set<number>,
): FplElement[] {
  return pool
    .filter((el) => el.element_type === pos && !used.has(el.id))
    .sort(
      (a, b) =>
        starterScore(b) - starterScore(a) || a.web_name.localeCompare(b.web_name),
    )
    .slice(0, n);
}

function padXi(
  slots: MatchPitchPlayer[],
  teamCode: number,
): MatchPitchPlayer[] {
  const out = slots.slice(0, 11);
  while (out.length < 11) {
    out.push(pitchOf(0, "XI", 0, teamCode, 3, out.length + 1));
  }
  return out;
}

/** Likely 4-3-3 from FPL minutes/starts — not an official lineup. */
export function fixtureXi(
  elements: Map<number, FplElement>,
  teamId: number,
  teamCode: number,
  sheet: MatchSheetPlayer[],
): MatchPitchPlayer[] {
  const byPos = (pos: ElementTypeId) =>
    sheet
      .filter((p) => p.position === pos && p.code > 0)
      .sort((a, b) => b.bps - a.bps || b.sheetPts - a.sheetPts)
      .map((p) =>
        pitchOf(p.id, p.name, p.code, p.teamCode, p.position, null),
      );

  if (sheet.filter((p) => p.code > 0).length >= 8) {
    const gk = byPos(1);
    const def = byPos(2);
    const mid = byPos(3);
    const fwd = byPos(4);
    const rest = [...gk.slice(1), ...def.slice(4), ...mid.slice(3), ...fwd.slice(3)];
    const slots = [
      gk[0],
      def[0],
      def[1],
      def[2],
      def[3],
      mid[0],
      mid[1],
      mid[2],
      mid[3] ?? fwd[1] ?? rest[0],
      fwd[0] ?? mid[3] ?? rest[1],
      mid[4] ?? fwd[2] ?? rest[2],
    ].filter((p): p is MatchPitchPlayer => p != null);
    if (slots.length >= 11) return slots.slice(0, 11);
    return padXi(slots, teamCode);
  }

  const pool = [...elements.values()].filter((el) => el.team === teamId);
  const used = new Set<number>();
  const take = (pos: ElementTypeId, n: number) => {
    const rows = takePos(pool, pos, n, used);
    for (const el of rows) used.add(el.id);
    return rows;
  };
  const gk = take(1, 1);
  const def = take(2, 4);
  const mid = take(3, 5);
  const fwd = take(4, 3);
  const extras = pool
    .filter((el) => !used.has(el.id))
    .sort((a, b) => starterScore(b) - starterScore(a));
  const slots = [
    gk[0],
    def[0],
    def[1],
    def[2],
    def[3],
    mid[0],
    mid[1],
    mid[2],
    mid[3] ?? fwd[1],
    fwd[0] ?? mid[3],
    mid[4] ?? fwd[2],
  ].filter((el): el is FplElement => el != null);
  if (slots.length < 11) {
    for (const el of extras) {
      if (slots.length >= 11) break;
      if (slots.some((s) => s.id === el.id)) continue;
      slots.push(el);
    }
  }
  return padXi(slots.map(fromElement), teamCode);
}

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
  elements: Map<number, FplElement>,
  now = Date.now(),
  currentEventId: number | null = null,
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
  const names = new Map(
    [...elements.entries()].map(([id, el]) => [id, el.web_name]),
  );
  const played = status !== "upcoming";
  const sheet = played
    ? fixtureSheet(fx.stats, elements, home.score ?? 0, away.score ?? 0)
    : EMPTY_SHEET;
  return {
    id: fx.id,
    event: fx.event,
    eventName: event?.name ?? `Gameweek ${fx.event}`,
    kickoff: fx.kickoff_time,
    deadline: event?.deadline_time ?? null,
    status,
    minutes: fx.minutes ?? 0,
    home,
    away,
    winner,
    winRating: winRatingValue,
    stats: played ? fixtureStats(fx.stats, names) : [],
    sheet,
    news:
      status === "upcoming"
        ? {
            home: fixtureNews(elements, home.id, fx.event, currentEventId),
            away: fixtureNews(elements, away.id, fx.event, currentEventId),
          }
        : EMPTY_NEWS,
    xi: {
      home: fixtureXi(elements, home.id, home.code, sheet.home),
      away: fixtureXi(elements, away.id, away.code, sheet.away),
    },
  };
}

function kickoffMs(match: MatchView): number {
  if (!match.kickoff) return Number.POSITIVE_INFINITY;
  const t = Date.parse(match.kickoff);
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

/** Kickoff ascending. Matches with no time go last. */
function sortMatches(a: MatchView, b: MatchView): number {
  return kickoffMs(a) - kickoffMs(b) || a.id - b.id;
}

export function buildMatchBoard(
  fixtures: FplFixture[],
  teams: FplTeam[],
  events: FplEvent[],
  elements: FplElement[] = [],
  now = Date.now(),
): MatchBoardData {
  const upcoming = resolveUpcoming(events);
  const current = events.find((e) => e.is_current) ?? null;
  const startId =
    current && !current.finished ? current.id : upcoming.id;
  const lastUpcoming = fixtures.reduce((max, fx) => {
    if (fx.event == null) return max;
    if (matchStatus(fx, now) !== "upcoming") return max;
    return Math.max(max, fx.event);
  }, startId);
  const eventIds = events
    .filter((e) => e.id <= lastUpcoming)
    .map((e) => e.id);

  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const eventMap = new Map(events.map((e) => [e.id, e]));
  const elementMap = new Map(elements.map((el) => [el.id, el]));
  const currentEventId = current?.id ?? null;
  const views = fixtures
    .filter((fx) => fx.event != null && fx.event <= lastUpcoming)
    .map((fx) =>
      toMatchView(fx, teamMap, eventMap, elementMap, now, currentEventId),
    )
    .filter((m): m is MatchView => m != null);

  const live = views.filter((m) => m.status === "live").sort(sortMatches);
  const groups: MatchEventGroup[] = eventIds
    .map((eventId) => {
      const event = eventMap.get(eventId);
      return {
        eventId,
        name: event?.name ?? `Gameweek ${eventId}`,
        deadline: event?.deadline_time ?? null,
        matches: views.filter((m) => m.event === eventId).sort(sortMatches),
      };
    })
    .filter((g) => g.matches.length > 0)
    .sort((a, b) => {
      function bucket(id: number) {
        if (id === startId) return 0;
        if (id < startId) return 1;
        return 2;
      }
      const ba = bucket(a.eventId);
      const bb = bucket(b.eventId);
      if (ba !== bb) return ba - bb;
      if (ba === 1) return b.eventId - a.eventId;
      return a.eventId - b.eventId;
    });

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
  return buildMatchBoard(
    fixtures,
    bootstrap.teams,
    bootstrap.events,
    bootstrap.elements,
  );
}

export const getMatchBoard = cache(async (): Promise<MatchBoardData> => {
  return loadMatchBoard();
});
