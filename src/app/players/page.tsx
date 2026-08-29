import { PlayerTable } from "@/components/PlayerTable";
import { PlayerTile } from "@/components/PlayerTile";
import { abbr } from "@/lib/abbr";
import { getSnapshot } from "@/lib/snapshot";

export default async function PlayersPage() {
  const snapshot = await getSnapshot();
  const faces = [...snapshot.players]
    .filter((p) => p.pMinutes >= 0.6)
    .sort((a, b) => b.xpThis - a.xpThis)
    .slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex">
            {faces.map((player, i) => (
              <div
                key={player.id}
                className="relative"
                style={{ marginLeft: i === 0 ? 0 : -8, zIndex: faces.length - i }}
              >
                <PlayerTile player={player} size="sm" />
              </div>
            ))}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Player rankings</h1>
          <p className="mt-1 text-sm text-muted">
            {abbr("xp")} for {snapshot.upcoming.name} is a 50/50 blend of our model and
            FPL&apos;s {abbr("ep")}. Click a row for the profile and last eight matches.
          </p>
        </div>
      </div>
      <PlayerTable players={snapshot.players} teams={snapshot.teams} />
    </div>
  );
}
