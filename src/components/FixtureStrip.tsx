import type { RankedPlayer } from "@/lib/xp/model";
import { abbr } from "@/lib/abbr";

export function FixtureStrip({ player }: { player: RankedPlayer }) {
  if (player.fixtures.length === 0) {
    return <span className="text-muted">Blank</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {player.fixtures.map((fx, i) => (
        <span
          key={`${fx.event}-${fx.opponentId}-${i}`}
          className={`rounded px-1 py-0.5 text-[10px] ${
            fx.fdr >= 4
              ? "bg-danger/15 text-danger"
              : fx.fdr <= 2
                ? "bg-accent/15 text-accent"
                : "bg-panel-2 text-muted"
          }`}
          title={`${abbr("gw")}${fx.event} ${fx.home ? abbr("home") : abbr("away")} ${abbr("fdr")} ${fx.fdr}`}
        >
          {fx.opponentShort}
          {fx.home ? "(H)" : "(A)"}
        </span>
      ))}
    </span>
  );
}
