import { cache } from "react";
import { fetchBootstrap, fetchFixtures } from "@/lib/fpl/client";
import type { FplChip, FplEvent, FplTeam } from "@/lib/fpl/types";
import {
  fixturesForTeam,
  projectPlayer,
  scoringFromBootstrap,
  type RankedPlayer,
} from "@/lib/xp/model";

export type EngineSnapshot = {
  fetchedAt: string;
  upcoming: FplEvent;
  current: FplEvent | null;
  events: FplEvent[];
  teams: FplTeam[];
  players: RankedPlayer[];
  chips: FplChip[];
  totalManagers: number;
  eventsPlayed: number;
};

export function resolveUpcoming(events: FplEvent[]): FplEvent {
  const next = events.find((e) => e.is_next);
  if (next) return next;
  const live = events.find((e) => e.is_current && !e.finished);
  if (live) return live;
  const current = events.find((e) => e.is_current);
  if (current) return current;
  return events[0];
}

export const getSnapshot = cache(async (): Promise<EngineSnapshot> => {
  const [bootstrap, fixtures] = await Promise.all([
    fetchBootstrap(),
    fetchFixtures(),
  ]);
  const upcoming = resolveUpcoming(bootstrap.events);
  const current = bootstrap.events.find((e) => e.is_current) ?? null;
  const eventsPlayed = bootstrap.events.filter((e) => e.finished).length;
  const scoring = scoringFromBootstrap(bootstrap.game_config?.scoring);
  const teamMap = new Map(bootstrap.teams.map((t) => [t.id, t]));

  const players: RankedPlayer[] = [];
  for (const el of bootstrap.elements) {
    if (el.removed) continue;
    const team = teamMap.get(el.team);
    if (!team) continue;
    const next5 = fixturesForTeam(fixtures, teamMap, el.team, upcoming.id, 5);
    const next3 = next5.filter((f) => f.event < upcoming.id + 3);
    players.push(
      projectPlayer(el, team, upcoming, eventsPlayed, next3, next5, scoring),
    );
  }

  players.sort((a, b) => b.xpThis - a.xpThis || b.xpNext5 - a.xpNext5);

  return {
    fetchedAt: new Date().toISOString(),
    upcoming,
    current,
    events: bootstrap.events,
    teams: bootstrap.teams,
    players,
    chips: bootstrap.chips,
    totalManagers: bootstrap.total_players,
    eventsPlayed,
  };
});
