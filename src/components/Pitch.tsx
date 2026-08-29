"use client";

import { useId, useState } from "react";
import { formatPrice, formatXp, formTrend } from "@/lib/format";
import { abbr, posLong } from "@/lib/abbr";
import type { RankedPlayer } from "@/lib/xp/model";
import { PlayerPhoto } from "./PlayerPhoto";
import { PlayerProfile } from "./PlayerProfile";

const ZONES = [
  {
    key: "attack",
    label: "Attack",
    bar: "bg-rose-400",
    wash: "bg-rose-500/20",
    fade: "text-rose-50/22",
  },
  {
    key: "midfield",
    label: "Midfield",
    bar: "bg-amber-300",
    wash: "bg-amber-400/16",
    fade: "text-amber-50/22",
  },
  {
    key: "defence",
    label: "Defence",
    bar: "bg-sky-400",
    wash: "bg-sky-400/22",
    fade: "text-sky-50/24",
  },
] as const;

function ZoneLabel({ zone }: { zone: (typeof ZONES)[number] }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-0 right-0 bottom-0 z-1 flex w-6 items-center justify-center"
    >
      <span
        className={`select-none text-[clamp(9px,2.4cqi,12px)] font-bold uppercase tracking-[0.42em] [writing-mode:vertical-rl] rotate-180 ${zone.fade}`}
      >
        {zone.label}
      </span>
    </span>
  );
}

const POS_CHIP: Record<number, string> = {
  1: "bg-violet-500 text-white",
  2: "bg-sky-500 text-white",
  3: "bg-amber-400 text-zinc-900",
  4: "bg-rose-500 text-white",
};

function FormArrow({ form, ppg }: { form: number; ppg: number }) {
  const trend = formTrend(form);
  const mark =
    trend === "hot"
      ? "▲▲"
      : trend === "up"
        ? "▲"
        : trend === "down"
          ? "▼"
          : trend === "cold"
            ? "▼▼"
            : "–";
  const color =
    trend === "hot" || trend === "up"
      ? "text-mint"
      : trend === "down" || trend === "cold"
        ? "text-danger"
        : "text-white/45";
  const label =
    ppg > 0
      ? `Last 4 gameweeks: ${form.toFixed(1)} pts/game (season ${ppg.toFixed(1)} ${abbr("ppg")})`
      : `Last 4 gameweeks: ${form.toFixed(1)} pts/game`;
  return (
    <span
      className={`ml-px text-[8px] font-bold leading-none ${color}`}
      title={label}
      aria-label={label}
    >
      {mark}
    </span>
  );
}

function Shirt({
  player,
  captain,
  vice,
  onOpen,
  bench,
}: {
  player: RankedPlayer;
  captain?: boolean;
  vice?: boolean;
  onOpen: (player: RankedPlayer) => void;
  bench?: boolean;
}) {
  const pos = player.positionShort === "GKP" ? "GK" : player.positionShort;
  return (
    <button
      type="button"
      onClick={() => onOpen(player)}
      className={`group min-w-0 text-left ${
        bench
          ? "w-[min(22%,3.5rem)] shrink-0 @[28rem]:w-[min(18%,5rem)] @[40rem]:w-[min(18%,5.75rem)]"
          : "w-0 max-w-[3.5rem] flex-[1_1_0%] @[28rem]:max-w-[4.65rem] @[40rem]:max-w-[5.75rem]"
      }`}
      aria-label={`${player.webName} profile, ${formatXp(player.xpThis)} ${abbr("xp")}, form ${player.form.toFixed(1)}`}
    >
      <div className="relative mx-auto w-[66%] @[32rem]:w-[70%]">
        <div className="relative transition duration-150 group-hover:scale-105 group-focus-visible:scale-105">
          <PlayerPhoto
            key={player.id}
            player={player}
            className="aspect-[11/14] h-auto w-full rounded-[0.3em] bg-black/30 object-cover shadow-[0_6px_10px_rgba(0,0,0,0.4)]"
          />
        </div>
        {captain ? (
          <span
            title={abbr("cap")}
            className="absolute -right-[18%] -top-[12%] flex aspect-square w-[44%] max-w-4 items-center justify-center rounded-full bg-warn text-[clamp(6px,2.2cqi,10px)] font-bold text-background @[32rem]:max-w-5"
          >
            C
          </span>
        ) : null}
        {vice ? (
          <span
            title={abbr("vice")}
            className="absolute -right-[18%] -top-[12%] flex aspect-square w-[44%] max-w-4 items-center justify-center rounded-full bg-white/90 text-[clamp(6px,2.2cqi,10px)] font-bold text-zinc-900 @[32rem]:max-w-5"
          >
            V
          </span>
        ) : null}
      </div>

      <div className="mt-[0.2em] overflow-hidden rounded-[0.28em] bg-black/70 text-center shadow-sm ring-1 ring-white/15">
        <div className="flex items-center justify-center gap-px px-[0.22em] pt-[0.16em] @[28rem]:justify-between">
          <span
            title={posLong(pos)}
            className={`hidden rounded px-[0.22em] py-px text-[clamp(5px,1.9cqi,10px)] font-bold uppercase leading-none @[28rem]:inline ${POS_CHIP[player.position]}`}
          >
            {pos}
          </span>
          <span className="flex min-w-0 items-center gap-px">
            <span className="tabular text-[clamp(7px,2.45cqi,13px)] font-bold leading-none text-mint">
              {formatXp(player.xpThis)}
            </span>
            <span
              className="hidden text-[clamp(6px,1.9cqi,8px)] font-semibold uppercase tracking-wide text-mint/75 @[28rem]:inline"
              title={abbr("xp")}
            >
              xP
            </span>
            <span className="hidden @[32rem]:inline">
              <FormArrow form={player.form ?? 0} ppg={player.pointsPerGame ?? 0} />
            </span>
          </span>
        </div>
        <p className="truncate px-[0.22em] pt-[0.08em] text-[clamp(7px,2.35cqi,13px)] font-semibold leading-tight text-white group-hover:text-mint">
          {player.webName}
        </p>
        <p className="px-[0.22em] pb-[0.16em] pt-[0.02em] tabular text-[clamp(7px,2.4cqi,14px)] font-bold leading-none text-white">
          {formatPrice(player.cost)}
        </p>
      </div>
    </button>
  );
}

function PitchMarkings() {
  const netId = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 100 160"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <pattern id={netId} width="1.6" height="1.6" patternUnits="userSpaceOnUse">
          <path
            d="M 0 0 L 1.6 0 M 0 0 L 0 1.6"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="0.18"
          />
        </pattern>
      </defs>
      <rect
        x="2.5"
        y="4"
        width="95"
        height="152"
        fill="none"
        stroke="rgba(255,255,255,0.42)"
        strokeWidth="0.7"
      />
      <path
        d="M 2.5 8 A 4 4 0 0 1 6.5 4"
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="0.35"
      />
      <path
        d="M 97.5 8 A 4 4 0 0 0 93.5 4"
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="0.35"
      />
      <path
        d="M 2.5 152 A 4 4 0 0 0 6.5 156"
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="0.35"
      />
      <path
        d="M 97.5 152 A 4 4 0 0 1 93.5 156"
        fill="none"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="0.35"
      />
      <line
        x1="2.5"
        y1="80"
        x2="97.5"
        y2="80"
        stroke="rgba(255,255,255,0.36)"
        strokeWidth="0.5"
      />
      <circle
        cx="50"
        cy="80"
        r="11"
        fill="none"
        stroke="rgba(255,255,255,0.36)"
        strokeWidth="0.5"
      />
      <circle cx="50" cy="80" r="0.9" fill="rgba(255,255,255,0.6)" />

      <rect
        x="24"
        y="4"
        width="52"
        height="24"
        fill="none"
        stroke="rgba(255,255,255,0.36)"
        strokeWidth="0.45"
      />
      <rect
        x="36"
        y="4"
        width="28"
        height="9"
        fill="none"
        stroke="rgba(255,255,255,0.42)"
        strokeWidth="0.45"
      />
      <path
        d="M 38 28 C 42 41 58 41 62 28"
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="0.4"
      />

      <rect
        x="24"
        y="132"
        width="52"
        height="24"
        fill="none"
        stroke="rgba(255,255,255,0.36)"
        strokeWidth="0.45"
      />
      <rect
        x="36"
        y="147"
        width="28"
        height="9"
        fill="none"
        stroke="rgba(255,255,255,0.42)"
        strokeWidth="0.45"
      />
      <path
        d="M 38 132 C 42 119 58 119 62 132"
        fill="none"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="0.4"
      />

      <rect x="41.5" y="0.4" width="17" height="3.6" fill={`url(#${netId})`} />
      <rect
        x="41.5"
        y="0.4"
        width="17"
        height="3.6"
        fill="none"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="1.05"
      />
      <rect x="41.5" y="156" width="17" height="3.6" fill={`url(#${netId})`} />
      <rect
        x="41.5"
        y="156"
        width="17"
        height="3.6"
        fill="none"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="1.05"
      />
    </svg>
  );
}

export function Pitch({
  xi,
  bench,
  captainId,
  viceId,
  gameweek,
  formation,
  compact,
}: {
  xi: RankedPlayer[];
  bench: RankedPlayer[];
  captainId?: number;
  viceId?: number;
  gameweek?: number;
  formation?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState<RankedPlayer | null>(null);
  const fwds = xi.filter((p) => p.position === 4);
  const mids = xi.filter((p) => p.position === 3);
  const defs = xi.filter((p) => p.position === 2);
  const gk = xi.filter((p) => p.position === 1);

  function line(players: RankedPlayer[]) {
    return (
      <div className="flex w-full min-w-0 max-w-full items-start justify-center gap-[clamp(0.12rem,1cqi,0.7rem)] px-[clamp(0.2rem,1.3cqi,0.75rem)]">
        {players.map((p) => (
          <Shirt
            key={p.id}
            player={p}
            captain={p.id === captainId}
            vice={p.id === viceId}
            onOpen={setOpen}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`@container overflow-hidden rounded-xl border border-line ${
        compact ? "pitch-compact" : ""
      }`}
    >
      <div className="pitch pitch-field relative flex w-full min-w-0 flex-col">
        <PitchMarkings />

        {gameweek ? (
          <p className="absolute left-[2cqi] top-[2cqi] z-3 max-w-[70%] truncate rounded-full bg-black/55 px-[0.7em] py-0.5 text-[clamp(8px,2.2cqi,11px)] font-medium text-white/85">
            {abbr("gw")} {gameweek}
            {formation ? ` · ${formation}` : ""}
          </p>
        ) : formation ? (
          <p className="absolute left-[2cqi] top-[2cqi] z-3 rounded-full bg-black/55 px-[0.7em] py-0.5 text-[clamp(8px,2.2cqi,11px)] font-medium text-white/85">
            {formation}
          </p>
        ) : null}

        <div className="relative z-2 flex min-h-0 flex-1 flex-col">
          <div className={`relative flex min-h-0 flex-1 ${ZONES[0].wash}`}>
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] ${ZONES[0].bar}`} />
            <ZoneLabel zone={ZONES[0]} />
            <div className="flex min-h-0 flex-1 items-center justify-center">
              {line(fwds)}
            </div>
          </div>
          <div className={`relative flex min-h-0 flex-1 ${ZONES[1].wash}`}>
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] ${ZONES[1].bar}`} />
            <ZoneLabel zone={ZONES[1]} />
            <div className="flex min-h-0 flex-1 items-center justify-center">
              {line(mids)}
            </div>
          </div>
          <div className={`relative flex min-h-0 flex-[2] flex-col ${ZONES[2].wash}`}>
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] ${ZONES[2].bar}`} />
            <ZoneLabel zone={ZONES[2]} />
            <div className="flex min-h-0 flex-1 items-center justify-center">
              {line(defs)}
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center pb-[0.35em]">
              {line(gk)}
            </div>
          </div>
        </div>
      </div>

      {bench.length > 0 ? (
        <div className="flex flex-wrap items-end justify-center gap-[1.8cqi] border-t border-line bg-panel px-[2.5cqi] py-[2.4cqi] @[32rem]:gap-[2.2cqi] @[32rem]:px-[3cqi] @[32rem]:py-[3cqi]">
          <span className="mb-[2.2em] rounded-full bg-panel-2 px-[0.7em] py-0.5 text-[clamp(8px,2.1cqi,11px)] font-medium text-muted">
            Bench
          </span>
          {bench.map((p) => (
            <Shirt key={p.id} player={p} onOpen={setOpen} bench />
          ))}
        </div>
      ) : null}

      {open ? (
        <PlayerProfile player={open} onClose={() => setOpen(null)} />
      ) : null}
    </div>
  );
}
