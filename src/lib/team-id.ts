export const TEAM_ID_COOKIE = "fplwin_team_id";
export const TEAM_ID_STORAGE = "fpl-win-team-id";
/** Remember the last squad for about a gameweek. */
export const TEAM_ID_MAX_AGE = 60 * 60 * 24 * 7;

export function normalizeTeamId(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function isValidTeamId(raw: string): boolean {
  const clean = normalizeTeamId(raw);
  return /^\d{1,10}$/.test(clean) && Number(clean) > 0;
}

/** Group from the right so 8506355 reads as 8 506 355. */
export function formatTeamId(id: string | number): string {
  return normalizeTeamId(String(id)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
}

export function readStoredTeamId(): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(TEAM_ID_STORAGE);
  if (stored && isValidTeamId(stored)) return normalizeTeamId(stored);
  const row = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${TEAM_ID_COOKIE}=`));
  const value = row?.slice(TEAM_ID_COOKIE.length + 1);
  if (value && isValidTeamId(value)) return normalizeTeamId(value);
  return null;
}

export function rememberTeamId(id: string | number) {
  const clean = normalizeTeamId(String(id));
  if (!isValidTeamId(clean) || typeof window === "undefined") return;
  window.localStorage.setItem(TEAM_ID_STORAGE, clean);
  document.cookie = `${TEAM_ID_COOKIE}=${clean}; Path=/; Max-Age=${TEAM_ID_MAX_AGE}; SameSite=Lax`;
}

export function forgetTeamId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TEAM_ID_STORAGE);
  document.cookie = `${TEAM_ID_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
