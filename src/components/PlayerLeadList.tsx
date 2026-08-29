"use client";

import { PlayerProfile } from "@/components/PlayerProfile";
import { PlayerTile, PosChip } from "@/components/PlayerTile";
import { useAppState } from "@/components/AppState";
import { abbr } from "@/lib/abbr";
import { formatPrice, formatXp } from "@/lib/format";
import type { RankedPlayer } from "@/lib/xp/model";
import { useState } from "react";

function fixtureText(player: RankedPlayer) {
  const fx = player.fixtures[0];
  if (!fx) return { text: "Blank", className: "bg-panel-2 text-muted" };
  const text = `${fx.opponentShort} ${fx.home ? abbr("home") : abbr("away")}`;
  const className =
    fx.fdr >= 4
      ? "bg-danger/15 text-danger"
      : fx.fdr <= 2
        ? "bg-accent/15 text-accent"
        : "bg-panel-2 text-muted";
  return { text, className };
}

export function PlayerLeadList({
  players,
  kind,
}: {
  players: RankedPlayer[];
  kind: "captain" | "value";
}) {
  const app = useAppState();
  const [open, setOpen] = useState<RankedPlayer | null>(null);

  function openPlayer(player: RankedPlayer) {
    setOpen(player);
    app.setFocusPlayer(player.id);
    app.setRankings({
      view: kind === "captain" ? "captain" : "value",
      playerId: player.id,
      pos: player.position,
    });
  }
  const lead = players[0];
  const rest = players.slice(1);

  return (
    <div className="space-y-2">
      {lead ? (
        <LeadCard
          player={lead}
          rank={1}
          kind={kind}
          onOpen={openPlayer}
          featured
        />
      ) : null}
      <ol className="space-y-1.5">
        {rest.map((player, i) => (
          <li key={player.id}>
            <LeadCard
              player={player}
              rank={i + 2}
              kind={kind}
              onOpen={openPlayer}
            />
          </li>
        ))}
      </ol>
      {open ? <PlayerProfile player={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function LeadCard({
  player,
  rank,
  kind,
  featured,
  onOpen,
}: {
  player: RankedPlayer;
  rank: number;
  kind: "captain" | "value";
  featured?: boolean;
  onOpen: (player: RankedPlayer) => void;
}) {
  const fx = fixtureText(player);
  const captain = kind === "captain";
  const stat = captain ? formatXp(player.xpThis) : formatXp(player.xpNext5);
  const statHint = captain ? abbr("xpGw") : `${abbr("xp")} / 5`;

  return (
    <button
      type="button"
      onClick={() => onOpen(player)}
      className={`flex w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition hover:border-accent/40 hover:bg-panel-2 ${
        featured
          ? "border-accent/45 bg-accent/10"
          : "border-line/80 bg-panel-2/40"
      }`}
    >
      <span
        className={`w-5 shrink-0 text-center text-xs font-bold tabular ${
          featured ? "text-accent" : "text-muted"
        }`}
      >
        {rank}
      </span>
      <PlayerTile
        player={player}
        size={featured ? "lg" : "md"}
        badge={captain && featured ? "C" : undefined}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <PosChip player={player} />
          <span className="truncate text-sm font-semibold">{player.webName}</span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
          <span>{player.teamShort}</span>
          <span
            className={`rounded px-1 py-px font-medium ${fx.className}`}
          >
            {fx.text}
          </span>
          {kind === "value" ? (
            <span className="tabular">{formatPrice(player.cost)}</span>
          ) : null}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className={`block tabular text-lg font-semibold leading-none ${featured ? "text-accent" : "text-foreground"}`}>
          {stat}
        </span>
        <span className="text-[10px] tracking-wide text-muted">
          {captain && featured ? "as captain ×2" : statHint}
        </span>
        {captain && featured ? (
          <span className="mt-0.5 block tabular text-xs font-semibold text-accent">
            {formatXp(player.xpThis * 2)}
          </span>
        ) : null}
      </span>
    </button>
  );
}
