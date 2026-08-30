import type {
  FplBootstrap,
  FplElementSummary,
  FplEntry,
  FplEntryHistory,
  FplFixture,
  FplPicks,
  FplTransfer,
} from "./types";

const FPL_BASE = "https://fantasy.premierleague.com/api";
const TTL_MS: Record<string, number> = {
  default: 60 * 60 * 1000,
  entry: 15 * 1000,
};

type CacheEntry<T> = { at: number; value: T };
const memory = new Map<string, CacheEntry<unknown>>();

function ttlFor(path: string): number {
  if (path.startsWith("/entry/")) return TTL_MS.entry;
  return TTL_MS.default;
}

async function fplGet<T>(
  path: string,
  opts?: { ttlMs?: number; cacheKey?: string },
): Promise<T> {
  const now = Date.now();
  const key = opts?.cacheKey ?? path;
  const ttl = opts?.ttlMs ?? ttlFor(path);
  const cached = memory.get(key);
  if (cached && now - cached.at < ttl) {
    return cached.value as T;
  }

  const res = await fetch(`${FPL_BASE}${path}`, {
    headers: {
      "User-Agent": "fpl-win/1.0 (decision engine; personal use)",
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`FPL ${path} failed: ${res.status}`);
  }
  const value = (await res.json()) as T;
  memory.set(key, { at: now, value });
  return value;
}

export async function fetchBootstrap(): Promise<FplBootstrap> {
  return fplGet<FplBootstrap>("/bootstrap-static/");
}

export async function fetchFixtures(): Promise<FplFixture[]> {
  return fplGet<FplFixture[]>("/fixtures/");
}

/** Fresh scores for the match board — short cache, separate from the xP snapshot. */
export async function fetchFixturesLive(ttlMs = 3_000): Promise<FplFixture[]> {
  return fplGet<FplFixture[]>("/fixtures/", {
    ttlMs,
    cacheKey: "/fixtures/#live",
  });
}

export async function fetchElementSummary(
  playerId: number,
): Promise<FplElementSummary> {
  return fplGet<FplElementSummary>(`/element-summary/${playerId}/`);
}

export async function fetchEntry(entryId: number): Promise<FplEntry> {
  return fplGet<FplEntry>(`/entry/${entryId}/`);
}

export async function fetchEntryHistory(
  entryId: number,
): Promise<FplEntryHistory> {
  return fplGet<FplEntryHistory>(`/entry/${entryId}/history/`);
}

export async function fetchPicks(
  entryId: number,
  eventId: number,
): Promise<FplPicks> {
  return fplGet<FplPicks>(`/entry/${entryId}/event/${eventId}/picks/`);
}

export async function fetchPicksSafe(
  entryId: number,
  eventId: number,
): Promise<FplPicks> {
  const loaded = await fetchPicksWithFallback(entryId, eventId);
  return loaded.picks;
}

export async function fetchPicksWithFallback(
  entryId: number,
  eventId: number,
): Promise<{ picks: FplPicks; eventId: number }> {
  try {
    return { picks: await fetchPicks(entryId, eventId), eventId };
  } catch {
    if (eventId <= 1) throw new Error("Could not load this FPL team");
    return {
      picks: await fetchPicks(entryId, eventId - 1),
      eventId: eventId - 1,
    };
  }
}

export async function fetchEntryTransfers(
  entryId: number,
): Promise<FplTransfer[]> {
  return fplGet<FplTransfer[]>(`/entry/${entryId}/transfers/`, {
    ttlMs: 15_000,
  });
}
