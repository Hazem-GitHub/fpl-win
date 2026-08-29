export type TeamTab = "play" | "xi" | "matches" | "chips";
export type RankingsView = "gw" | "next5" | "captain" | "value" | "diff";

export function parseIdList(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const ids = raw.split(/[,\s]+/).map((bit) => Number.parseInt(bit, 10));
  return [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
}

export function formatIdList(ids: number[]): string {
  return [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))].join(",");
}

export function playersHref(opts?: {
  view?: RankingsView | null;
  pos?: number;
  club?: number | number[];
  q?: string;
  player?: number;
}): string {
  const params = new URLSearchParams();
  if (opts?.view) params.set("view", opts.view);
  if (opts?.pos) params.set("pos", String(opts.pos));
  const clubs = opts?.club == null ? [] : Array.isArray(opts.club) ? opts.club : [opts.club];
  const clubList = formatIdList(clubs);
  if (clubList) params.set("club", clubList);
  if (opts?.q?.trim()) params.set("q", opts.q.trim());
  if (opts?.player) params.set("player", String(opts.player));
  const query = params.toString();
  return query ? `/players?${query}` : "/players";
}

export function fixturesHref(clubId?: number | null): string {
  return clubId ? `/fixtures?club=${clubId}` : "/fixtures";
}

export function builderHref(opts?: { lock?: number[]; ban?: number[] }): string {
  const params = new URLSearchParams();
  const lock = formatIdList(opts?.lock ?? []);
  const ban = formatIdList(opts?.ban ?? []);
  if (lock) params.set("lock", lock);
  if (ban) params.set("ban", ban);
  const query = params.toString();
  return query ? `/builder?${query}` : "/builder";
}

export function teamHref(
  teamId?: string | number | null,
  tab?: TeamTab,
  formation?: string | null,
): string {
  const base = teamId ? `/team/${teamId}` : "/team";
  const params = new URLSearchParams();
  if (formation) params.set("formation", formation);
  const query = params.toString();
  const hash = tab ? `#${tab}` : "";
  return `${base}${query ? `?${query}` : ""}${hash}`;
}

export function parseRankingsView(raw: string | null): RankingsView | null {
  if (raw === "gw" || raw === "next5" || raw === "captain" || raw === "value" || raw === "diff") {
    return raw;
  }
  return null;
}
