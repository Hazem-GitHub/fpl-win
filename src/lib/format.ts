export function formatPrice(tenths: number): string {
  return `£${(tenths / 10).toFixed(1)}m`;
}

export function formatXp(value: number, digits = 1): string {
  return value.toFixed(digits);
}

/** This-gameweek player xP on the rounded 1-decimal shown value. */
export type XpGrade = "violet" | "blue" | "high" | "mid" | "low";

export function xpGrade(value: number): XpGrade {
  const shown = Math.round(value * 10) / 10;
  if (shown > 10) return "violet";
  if (shown >= 8) return "blue";
  if (shown > 5) return "high";
  if (shown >= 2) return "mid";
  return "low";
}

export function xpGradeClass(value: number): string {
  const grade = xpGrade(value);
  if (grade === "violet") return "text-violet-400";
  if (grade === "blue") return "text-sky-400";
  if (grade === "high") return "text-mint";
  if (grade === "mid") return "text-orange-400";
  return "text-danger";
}

export function xpGradeMutedClass(value: number): string {
  const grade = xpGrade(value);
  if (grade === "violet") return "text-violet-400/75";
  if (grade === "blue") return "text-sky-400/75";
  if (grade === "high") return "text-mint/75";
  if (grade === "mid") return "text-orange-400/75";
  return "text-danger/75";
}

export function xpGradeSurfaceClass(value: number): string {
  const grade = xpGrade(value);
  if (grade === "violet") return "border-violet-400/40 bg-violet-400/10";
  if (grade === "blue") return "border-sky-400/40 bg-sky-400/10";
  if (grade === "high") return "border-accent/40 bg-accent/10";
  if (grade === "mid") return "border-orange-400/40 bg-orange-400/10";
  return "border-danger/40 bg-danger/10";
}

export type FormTrend = "hot" | "up" | "flat" | "down" | "cold";

/** FPL form is pts/game over the last ~4 gameweeks. */
export function formTrend(form: number): FormTrend {
  if (form >= 6.5) return "hot";
  if (form >= 4.5) return "up";
  if (form >= 3.2) return "flat";
  if (form >= 1.8) return "down";
  return "cold";
}

export function formatPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function formatRank(rank: number | null): string {
  if (rank == null) return "—";
  return rank.toLocaleString("en-GB");
}

/** Wall clock for every displayed deadline and kickoff. */
const DISPLAY_TZ = "Africa/Cairo";

const CLOCK: Intl.DateTimeFormatOptions = {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: DISPLAY_TZ,
};

function cairoClock(iso: string): string {
  return `${new Intl.DateTimeFormat("en-GB", CLOCK).format(new Date(iso))} Cairo`;
}

export function deadlineLabel(iso: string | null): string {
  if (!iso) return "No deadline";
  return cairoClock(iso);
}

export function kickoffLabel(iso: string | null): string {
  if (!iso) return "TBC";
  return cairoClock(iso);
}

/** Relative time to kickoff. Pass `now` from the client so it can tick. */
export function kickoffFromNow(iso: string | null, now = Date.now()): string {
  if (!iso) return "Time TBC";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "Time TBC";
  const ms = t - now;
  if (ms <= 0) return "Kickoff";
  const mins = Math.max(1, Math.round(ms / 60_000));
  if (mins < 60) return `in ${mins} min`;
  const hours = Math.floor(mins / 60);
  const remM = mins % 60;
  if (hours < 24) {
    return remM === 0 ? `in ${hours}h` : `in ${hours}h ${remM}m`;
  }
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  if (remH === 0) return days === 1 ? "in 1 day" : `in ${days} days`;
  return `in ${days}d ${remH}h`;
}

export function playerPhoto(code: number): string {
  return `https://resources.premierleague.com/premierleague/photos/players/110x140/p${code}.png`;
}

export function shirtPhoto(teamCode: number, goalkeeper: boolean): string {
  const file = goalkeeper
    ? `shirt_${teamCode}_1-66.webp`
    : `shirt_${teamCode}-66.webp`;
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/${file}`;
}

export function clubBadgeUrls(teamCode: number): string[] {
  return [
    `https://fantasy.premierleague.com/dist/img/badges/badge_${teamCode}_80.png`,
    `https://resources.premierleague.com/premierleague/badges/50/t${teamCode}.png`,
    `https://resources.premierleague.com/premierleague/badges/t${teamCode}.png`,
  ];
}
