export function formatPrice(tenths: number): string {
  return `£${(tenths / 10).toFixed(1)}m`;
}

export function formatXp(value: number, digits = 1): string {
  return value.toFixed(digits);
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
