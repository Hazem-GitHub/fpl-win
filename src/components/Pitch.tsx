"use client";

import { useId, useState } from "react";
import { formatXp, xpGradeClass } from "@/lib/format";
import { abbr } from "@/lib/abbr";
import type { RankedPlayer } from "@/lib/xp/model";
import { PlayerPhoto } from "./PlayerPhoto";
import { PlayerProfile } from "./PlayerProfile";

const ZONES = [
  {
    key: "attack",
    label: "Attack",
    hair: "via-rose-200/65",
    wash: "bg-rose-500/12",
    fade: "text-rose-50/18",
  },
  {
    key: "midfield",
    label: "Midfield",
    hair: "via-amber-100/60",
    wash: "bg-amber-400/10",
    fade: "text-amber-50/18",
  },
  {
    key: "defence",
    label: "Defence",
    hair: "via-sky-200/65",
    wash: "bg-sky-400/12",
    fade: "text-sky-50/18",
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

function fixtureMark(player: RankedPlayer) {
  const fx = player.fixtures[0];
  if (!fx) return { text: "Blank", className: "text-white/45", title: "No fixture" };
  const text = `${fx.opponentShort} ${fx.home ? "H" : "A"}`;
  const className =
    fx.fdr >= 4 ? "text-rose-300" : fx.fdr <= 2 ? "text-mint" : "text-white/80";
  return { text, className, title: `${abbr("fdr")} ${fx.fdr}` };
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
  const fx = fixtureMark(player);
  return (
    <button
      type="button"
      onClick={() => onOpen(player)}
      className={`group min-w-0 text-left ${
        bench
          ? "w-[min(24%,4.4rem)] shrink-0 @[28rem]:w-[min(18%,5rem)] @[40rem]:w-[min(18%,5.75rem)]"
          : "w-0 max-w-[4.75rem] flex-[1_1_0%] @[28rem]:max-w-[5.1rem] @[40rem]:max-w-[5.75rem]"
      }`}
      aria-label={`${player.webName}, ${formatXp(player.xpThis)} ${abbr("xp")}, ${fx.text}`}
    >
      <div className="relative mx-auto w-[78%] @[32rem]:w-[72%]">
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
        <p className={`tabular px-[0.22em] pt-[0.16em] text-[clamp(7px,2.45cqi,13px)] font-bold leading-none ${xpGradeClass(player.xpThis)}`}>
          {formatXp(player.xpThis)}
        </p>
        <p className="truncate px-[0.22em] pt-[0.08em] text-[clamp(7px,2.35cqi,13px)] font-semibold leading-tight text-white group-hover:text-mint">
          {player.webName}
        </p>
        <p
          className={`px-[0.22em] pb-[0.16em] pt-[0.02em] text-[clamp(6px,2.1cqi,11px)] font-bold uppercase leading-none ${fx.className}`}
          title={fx.title}
        >
          {fx.text}
        </p>
      </div>
    </button>
  );
}

function PitchMarkings() {
  const uid = useId().replace(/:/g, "");
  const glow = `${uid}-glow`;
  const net = `${uid}-net`;
  const clipTop = `${uid}-arc-t`;
  const clipBot = `${uid}-arc-b`;

  const fx = 36;
  const fy = 48;
  const fw = 608;
  const fh = 954;
  const cx = fx + fw / 2;
  const hy = fy + fh / 2;
  const s = fw / 68;
  const penW = 40.32 * s;
  const penD = 16.5 * s;
  const sixW = 18.32 * s;
  const sixD = 5.5 * s;
  const rC = 9.15 * s;
  const spot = 11 * s;
  const corner = 1.15 * s;
  const goalW = 7.32 * s;
  const goalD = 26;
  const penX = cx - penW / 2;
  const sixX = cx - sixW / 2;
  const goalX = cx - goalW / 2;

  function lines(stroke: string, width: number) {
    const p = {
      fill: "none" as const,
      stroke,
      strokeWidth: width,
      vectorEffect: "nonScalingStroke" as const,
      strokeLinejoin: "miter" as const,
    };
    return (
      <g>
        <rect x={fx} y={fy} width={fw} height={fh} {...p} />
        <line x1={fx} y1={hy} x2={fx + fw} y2={hy} {...p} />
        <circle cx={cx} cy={hy} r={rC} {...p} />
        <path
          d={`M ${fx + corner} ${fy} A ${corner} ${corner} 0 0 1 ${fx} ${fy + corner}`}
          {...p}
        />
        <path
          d={`M ${fx + fw - corner} ${fy} A ${corner} ${corner} 0 0 0 ${fx + fw} ${fy + corner}`}
          {...p}
        />
        <path
          d={`M ${fx + corner} ${fy + fh} A ${corner} ${corner} 0 0 0 ${fx} ${fy + fh - corner}`}
          {...p}
        />
        <path
          d={`M ${fx + fw - corner} ${fy + fh} A ${corner} ${corner} 0 0 1 ${fx + fw} ${fy + fh - corner}`}
          {...p}
        />
        <rect x={penX} y={fy} width={penW} height={penD} {...p} />
        <rect x={sixX} y={fy} width={sixW} height={sixD} {...p} />
        <circle cx={cx} cy={fy + spot} r={rC} clipPath={`url(#${clipTop})`} {...p} />
        <rect x={penX} y={fy + fh - penD} width={penW} height={penD} {...p} />
        <rect x={sixX} y={fy + fh - sixD} width={sixW} height={sixD} {...p} />
        <circle
          cx={cx}
          cy={fy + fh - spot}
          r={rC}
          clipPath={`url(#${clipBot})`}
          {...p}
        />
      </g>
    );
  }

  return (
    <svg
      viewBox="0 0 680 1050"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 z-1 h-full w-full"
      aria-hidden
      shapeRendering="geometricPrecision"
    >
      <defs>
        <filter id={glow} x="-12%" y="-6%" width="124%" height="112%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.8" />
        </filter>
        <pattern id={net} width="3.2" height="3.2" patternUnits="userSpaceOnUse">
          <path
            d="M 0 0 L 3.2 0 M 0 0 L 0 3.2"
            stroke="rgba(255,255,255,0.32)"
            strokeWidth="0.4"
          />
        </pattern>
        <clipPath id={clipTop}>
          <rect x={penX - rC} y={fy + penD} width={penW + rC * 2} height={rC * 2} />
        </clipPath>
        <clipPath id={clipBot}>
          <rect
            x={penX - rC}
            y={fy + fh - penD - rC * 2}
            width={penW + rC * 2}
            height={rC * 2}
          />
        </clipPath>
      </defs>

      <circle cx={cx} cy={hy} r={rC} fill="rgba(255,255,255,0.035)" stroke="none" />

      <g filter={`url(#${glow})`} opacity="0.42">
        {lines("rgba(255,255,255,0.95)", 3.4)}
      </g>
      {lines("rgba(255,255,255,0.82)", 1.35)}

      <circle cx={cx} cy={hy} r={6.2} fill="rgba(255,255,255,0.92)" stroke="none" />
      <circle cx={cx} cy={fy + spot} r={5.6} fill="rgba(255,255,255,0.92)" stroke="none" />
      <circle
        cx={cx}
        cy={fy + fh - spot}
        r={5.6}
        fill="rgba(255,255,255,0.92)"
        stroke="none"
      />

      <g>
        <rect
          x={goalX}
          y={fy - goalD}
          width={goalW}
          height={goalD}
          fill={`url(#${net})`}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="0.55"
        />
        <rect
          x={goalX}
          y={fy + fh}
          width={goalW}
          height={goalD}
          fill={`url(#${net})`}
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="0.55"
        />
        <path
          d={`M ${goalX} ${fy - goalD} L ${goalX} ${fy} M ${goalX + goalW} ${fy - goalD} L ${goalX + goalW} ${fy} M ${goalX} ${fy - goalD} L ${goalX + goalW} ${fy - goalD}`}
          fill="none"
          stroke="rgba(255,255,255,0.94)"
          strokeWidth="2.15"
          vectorEffect="nonScalingStroke"
          strokeLinejoin="round"
          strokeLinecap="square"
        />
        <path
          d={`M ${goalX} ${fy + fh} L ${goalX} ${fy + fh + goalD} M ${goalX + goalW} ${fy + fh} L ${goalX + goalW} ${fy + fh + goalD} M ${goalX} ${fy + fh + goalD} L ${goalX + goalW} ${fy + fh + goalD}`}
          fill="none"
          stroke="rgba(255,255,255,0.94)"
          strokeWidth="2.15"
          vectorEffect="nonScalingStroke"
          strokeLinejoin="round"
          strokeLinecap="square"
        />
      </g>
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
      <div className="flex w-full min-w-0 max-w-full items-start justify-center gap-[clamp(0.08rem,0.7cqi,0.7rem)] px-[clamp(0.1rem,0.9cqi,0.75rem)]">
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
          <p className="absolute left-[2cqi] top-[2cqi] z-3 max-w-[70%] truncate rounded-full border border-white/15 bg-black/45 px-[0.75em] py-0.5 text-[clamp(8px,2.2cqi,11px)] font-medium text-white/90 shadow-[0_4px_18px_rgba(0,0,0,0.28)] backdrop-blur-[2px]">
            {abbr("gw")} {gameweek}
            {formation ? ` · ${formation}` : ""}
          </p>
        ) : formation ? (
          <p className="absolute left-[2cqi] top-[2cqi] z-3 rounded-full border border-white/15 bg-black/45 px-[0.75em] py-0.5 text-[clamp(8px,2.2cqi,11px)] font-medium text-white/90 shadow-[0_4px_18px_rgba(0,0,0,0.28)] backdrop-blur-[2px]">
            {formation}
          </p>
        ) : null}

        <div className="relative z-2 flex min-h-0 flex-1 flex-col">
          <div className={`relative flex min-h-0 flex-1 ${ZONES[0].wash}`}>
            <div
              className={`pointer-events-none absolute inset-x-[10%] top-0 h-px bg-gradient-to-r from-transparent to-transparent ${ZONES[0].hair}`}
            />
            <ZoneLabel zone={ZONES[0]} />
            <div className="flex min-h-0 flex-1 items-center justify-center">
              {line(fwds)}
            </div>
          </div>
          <div className={`relative flex min-h-0 flex-1 ${ZONES[1].wash}`}>
            <div
              className={`pointer-events-none absolute inset-x-[10%] top-0 h-px bg-gradient-to-r from-transparent to-transparent ${ZONES[1].hair}`}
            />
            <ZoneLabel zone={ZONES[1]} />
            <div className="flex min-h-0 flex-1 items-center justify-center">
              {line(mids)}
            </div>
          </div>
          <div className={`relative flex min-h-0 flex-[2] flex-col ${ZONES[2].wash}`}>
            <div
              className={`pointer-events-none absolute inset-x-[10%] top-0 h-px bg-gradient-to-r from-transparent to-transparent ${ZONES[2].hair}`}
            />
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
