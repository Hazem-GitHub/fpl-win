export const ABBR = {
  ft: { short: "FT", long: "free transfers" },
  xp: { short: "xP", long: "expected points" },
  xi: { short: "XI", long: "starting 11" },
  fdr: { short: "FDR", long: "fixture difficulty" },
  gw: { short: "GW", long: "gameweek" },
  ep: { short: "EP", long: "FPL expected points" },
  fplEp: { short: "FPL EP", long: "official expected points" },
  ppg: { short: "ppg", long: "points per game" },
  defcon: { short: "DEFCON", long: "defensive contribution" },
  val: { short: "Val", long: "xP per £m" },
  sel: { short: "Sel", long: "ownership" },
  mins: { short: "Mins", long: "start chance" },
  gk: { short: "GK", long: "goalkeeper" },
  def: { short: "DEF", long: "defender" },
  mid: { short: "MID", long: "midfielder" },
  fwd: { short: "FWD", long: "forward" },
  cap: { short: "C", long: "captain" },
  vice: { short: "V", long: "vice-captain" },
  xpGw: { short: "xP GW", long: "expected points this gameweek" },
  xp3: { short: "xP 3", long: "expected points next 3 gameweeks" },
  xp5: { short: "xP 5", long: "expected points next 5 gameweeks" },
  xiXp: { short: "XI xP", long: "starting 11 expected points" },
  netXp: { short: "net xP", long: "expected points after hits" },
  thisGw: { short: "This GW", long: "gameweek" },
  likelyXi: { short: "Likely XI", long: "starting 11" },
  xpPerM: { short: "xP/£m", long: "expected points per million" },
  cs: { short: "CS", long: "clean sheet" },
  gc: { short: "GC", long: "goals conceded" },
  yc: { short: "YC", long: "yellow card" },
  rc: { short: "RC", long: "red card" },
  ga: { short: "G+A", long: "goals and assists" },
  xgi: { short: "xGI", long: "expected goal involvement" },
  per90: { short: "/90", long: "points per 90 minutes" },
  home: { short: "H", long: "home" },
  away: { short: "A", long: "away" },
} as const;

export type AbbrKey = keyof typeof ABBR;

export function abbr(key: AbbrKey, extra?: string): string {
  const { short, long } = ABBR[key];
  const base = `${short} (${long})`;
  return extra ? `${base} ${extra}` : base;
}

export function posLong(short: string): string {
  if (short === "GKP" || short === "GK") return ABBR.gk.long;
  if (short === "DEF") return ABBR.def.long;
  if (short === "MID") return ABBR.mid.long;
  if (short === "FWD") return ABBR.fwd.long;
  return short;
}

export function posAbbr(short: string): string {
  if (short === "GKP" || short === "GK") return abbr("gk");
  if (short === "DEF") return abbr("def");
  if (short === "MID") return abbr("mid");
  if (short === "FWD") return abbr("fwd");
  return short;
}
