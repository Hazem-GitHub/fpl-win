import { BuilderClient } from "@/components/BuilderClient";
import { PlayerTile } from "@/components/PlayerTile";
import { abbr } from "@/lib/abbr";
import { buildSquad } from "@/lib/optimize/squad";
import { getSnapshot } from "@/lib/snapshot";

export default async function BuilderPage() {
  const snapshot = await getSnapshot();
  const initial = await buildSquad({
    players: snapshot.players,
    budget: 1000,
    preferMip: false,
  });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex">
          {initial.lineup.xi.slice(0, 6).map((player, i) => (
            <div
              key={player.id}
              className="relative"
              style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 6 - i }}
            >
              <PlayerTile player={player} size="sm" />
            </div>
          ))}
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Squad builder</h1>
          <p className="mt-1 text-sm text-muted">
            15 players, £100.0m, max three per club. Lock or ban, then pick the {abbr("xi")}.
          </p>
        </div>
      </div>
      <BuilderClient
        players={snapshot.players}
        initial={initial}
        gameweek={snapshot.upcoming.id}
      />
    </div>
  );
}
