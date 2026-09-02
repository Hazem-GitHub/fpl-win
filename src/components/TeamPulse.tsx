"use client";

import { Icon } from "@/components/Icon";
import { Abbr } from "@/components/Abbr";
import { abbr } from "@/lib/abbr";
import { formatPrice, formatRank } from "@/lib/format";
import { STARTING_BUDGET } from "@/lib/fpl/rules";
import type { TeamPulse as Pulse } from "@/lib/advice";
import {
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  Repeat2,
  Trophy,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

function signedPrice(tenths: number): string {
  if (tenths === 0) return "£0.0m";
  const sign = tenths > 0 ? "+" : "−";
  return `${sign}${formatPrice(Math.abs(tenths))}`;
}

function topShare(rank: number, managers: number): string {
  const pct = (rank / Math.max(managers, 1)) * 100;
  if (pct < 1) return `Top ${pct.toFixed(2)}%`;
  if (pct < 10) return `Top ${pct.toFixed(1)}%`;
  return `Top ${Math.round(pct)}%`;
}

function Card({
  icon,
  label,
  value,
  hint,
  hintTone,
  pips,
  className,
}: {
  icon: LucideIcon;
  label: ReactNode;
  value: string;
  hint: string;
  hintTone?: "accent" | "danger" | "warn" | "muted";
  pips?: { filled: number; total: number };
  className?: string;
}) {
  const hintClass =
    hintTone === "danger"
      ? "text-danger"
      : hintTone === "warn"
        ? "text-warn"
        : hintTone === "accent"
          ? "text-accent"
          : "text-muted";
  const pipFill =
    hintTone === "danger"
      ? "bg-danger"
      : hintTone === "warn"
        ? "bg-warn"
        : "bg-accent";
  return (
    <div className={`min-w-0 rounded-xl border border-line/80 bg-panel-2/70 px-3 py-2.5 ${className ?? ""}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-muted">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-background/70 text-accent">
          <Icon icon={icon} size="xs" />
        </span>
        {label}
      </div>
      <p className="mt-1 truncate tabular text-lg font-semibold leading-tight tracking-tight sm:text-xl">
        {value}
      </p>
      <p className={`mt-0.5 truncate text-[11px] leading-snug ${hintClass}`}>{hint}</p>
      {pips ? (
        <div className="mt-2 flex gap-0.5">
          {Array.from({ length: pips.total }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < pips.filled ? pipFill : "bg-line"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TeamPulse({ pulse }: { pulse: Pulse }) {
  const rankShare =
    pulse.rank != null && pulse.managers > 0
      ? topShare(pulse.rank, pulse.managers)
      : null;
  const rankMove =
    pulse.rank != null && pulse.previousRank != null
      ? pulse.rank - pulse.previousRank
      : null;
  const valueDelta =
    pulse.lastSquadValue != null ? pulse.squadValue - pulse.lastSquadValue : null;
  const vsStart = pulse.squadValue - STARTING_BUDGET;
  const bankTight = pulse.bank < 5;
  const bankAfterDelta = pulse.bankAfter - pulse.bank;

  const rankHint =
    rankShare && rankMove != null
      ? `${rankShare} · ${
          rankMove === 0
            ? "unchanged"
            : rankMove < 0
              ? `▲ ${Math.abs(rankMove).toLocaleString("en-GB")}`
              : `▼ ${rankMove.toLocaleString("en-GB")}`
        }`
      : rankShare
        ? rankShare
        : "Rank pending";

  const squadHint =
    valueDelta != null && valueDelta !== 0
      ? `${signedPrice(valueDelta)} this week`
      : `${signedPrice(vsStart)} vs start`;

  const bankHint = bankTight
    ? "Tight for an upgrade"
    : bankAfterDelta !== 0
      ? `${bankAfterDelta > 0 ? "Frees" : "Spends"} ${formatPrice(Math.abs(bankAfterDelta))}`
      : pulse.bank >= 20
        ? "Room to upgrade"
        : "Small upgrade";

  const ftHint =
    pulse.planHits > 0
      ? `Plan takes a −${pulse.planHitCost} hit`
      : pulse.planMoves === 0
        ? `Bank it → ${pulse.ftAfter} ${abbr("ft")} next week`
        : `Uses ${pulse.planMoves} · ${pulse.ftAfter} ${abbr("ft")} next week`;

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <Card
        icon={Trophy}
        label="Points"
        value={pulse.points.toLocaleString("en-GB")}
        hint={
          pulse.lastGwPoints != null && pulse.lastGwEvent != null
            ? `${abbr("gw")} ${pulse.lastGwEvent} ${pulse.lastGwPoints} pts`
            : "Season total"
        }
      />
      <Card
        icon={rankMove != null && rankMove > 0 ? ArrowDownRight : ArrowUpRight}
        label="Rank"
        value={formatRank(pulse.rank)}
        hint={rankHint}
        hintTone={
          rankMove == null ? "muted" : rankMove < 0 ? "accent" : rankMove > 0 ? "danger" : "muted"
        }
      />
      <Card
        icon={Coins}
        label="Squad"
        value={formatPrice(pulse.squadValue)}
        hint={squadHint}
        hintTone={
          valueDelta == null ? "muted" : valueDelta > 0 ? "accent" : valueDelta < 0 ? "danger" : "muted"
        }
      />
      <Card
        icon={Wallet}
        label="Bank"
        value={formatPrice(pulse.bank)}
        hint={bankHint}
        hintTone={bankTight ? "warn" : bankAfterDelta < 0 ? "danger" : "accent"}
      />
      <Card
        icon={Repeat2}
        label={<Abbr of="ft" />}
        value={`${pulse.freeTransfers}/${pulse.maxFt}`}
        hint={ftHint}
        hintTone={pulse.planHits > 0 ? "danger" : pulse.freeTransfers === 0 ? "warn" : "accent"}
        pips={{ filled: pulse.freeTransfers, total: pulse.maxFt }}
        className="col-span-2 sm:col-span-1"
      />
    </div>
  );
}
