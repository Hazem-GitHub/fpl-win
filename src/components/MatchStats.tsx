"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAppState } from "@/components/AppState";
import { ClubCrest } from "@/components/ClubCrest";
import { Icon } from "@/components/Icon";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { POS_TONE } from "@/components/PlayerTile";
import { abbr } from "@/lib/abbr";
import { playersHref } from "@/lib/app-href";
import { POS_SHORT } from "@/lib/fpl/rules";
import type { ElementTypeId } from "@/lib/fpl/types";
import { deadlineLabel, kickoffFromNow, kickoffLabel, xpGradeClass } from "@/lib/format";
import type { MatchNewsItem, MatchSheetPlayer, MatchView } from "@/lib/matches";
import { Award, Clock, Newspaper, Shield, Users, X } from "lucide-react";
import Link from "next/link";

function photoOf(player: {
  code: number;
  teamCode: number;
  position: number;
  name: string;
}) {
  return {
    code: player.code,
    teamCode: player.teamCode,
    position: player.position,
    webName: player.name,
  };
}

function PosBadge({ position }: { position: ElementTypeId }) {
  const short = POS_SHORT[position];
  const label = short === "GKP" ? "GK" : short;
  return (
    <span
      className={`rounded px-1 py-px text-[9px] font-bold uppercase leading-none ${POS_TONE[position]}`}
    >
      {label}
    </span>
  );
}

function Chip({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded px-1 py-px text-[9px] font-bold uppercase leading-none ${className}`}
    >
      {children}
    </span>
  );
}

function eventChips(player: MatchSheetPlayer) {
  const chips: ReactNode[] = [];
  if (player.goals > 0) {
    chips.push(
      <Chip key="g" className="bg-mint/20 text-mint" title="Goals">
        G{player.goals > 1 ? player.goals : ""}
      </Chip>,
    );
  }
  if (player.assists > 0) {
    chips.push(
      <Chip key="a" className="bg-sky-500/20 text-sky-400" title="Assists">
        A{player.assists > 1 ? player.assists : ""}
      </Chip>,
    );
  }
  if (player.bonus > 0) {
    chips.push(
      <Chip
        key="b"
        className="bg-warn/25 text-warn"
        title={`Bonus ${player.bonus}`}
      >
        B{player.bonus}
      </Chip>,
    );
  }
  if (player.cleanSheet) {
    chips.push(
      <Chip key="cs" className="bg-accent/20 text-accent" title="Clean sheet">
        CS
      </Chip>,
    );
  }
  if (player.defconHit) {
    chips.push(
      <Chip
        key="dc"
        className="bg-panel-2 text-muted"
        title={`Defensive contribution ${player.defcon}`}
      >
        DC
      </Chip>,
    );
  }
  if (player.saves > 0) {
    chips.push(
      <Chip key="sv" className="bg-violet-500/20 text-violet-400" title="Saves">
        {player.saves} SV
      </Chip>,
    );
  }
  if (player.pensSaved > 0) {
    chips.push(
      <Chip key="ps" className="bg-mint/20 text-mint" title="Penalty saved">
        PS
      </Chip>,
    );
  }
  if (player.pensMissed > 0) {
    chips.push(
      <Chip key="pm" className="bg-danger/20 text-danger" title="Penalty missed">
        PM
      </Chip>,
    );
  }
  if (player.ownGoals > 0) {
    chips.push(
      <Chip key="og" className="bg-danger/20 text-danger" title="Own goal">
        OG
      </Chip>,
    );
  }
  if (player.yellows > 0) {
    chips.push(
      <Chip key="y" className="bg-warn/30 text-warn" title="Yellow card">
        Y
      </Chip>,
    );
  }
  if (player.reds > 0) {
    chips.push(
      <Chip key="r" className="bg-danger/20 text-danger" title="Red card">
        R
      </Chip>,
    );
  }
  return chips;
}

function PlayerLink({
  player,
  className,
  children,
}: {
  player: { id: number; name: string };
  className?: string;
  children: ReactNode;
}) {
  const app = useAppState();
  return (
    <Link
      href={playersHref({ player: player.id, q: player.name })}
      onClick={() =>
        app.setRankings({
          playerId: player.id,
          q: player.name,
          view: null,
        })
      }
      className={className}
    >
      {children}
    </Link>
  );
}

function ScorerStrip({
  players,
  align,
}: {
  players: MatchSheetPlayer[];
  align: "left" | "right";
}) {
  const scorers = players.filter((p) => p.goals > 0);
  if (scorers.length === 0) {
    return (
      <p
        className={`text-[10px] text-muted ${align === "right" ? "text-right" : ""}`}
      >
        —
      </p>
    );
  }
  return (
    <ul
      className={`flex flex-wrap gap-1.5 ${align === "right" ? "justify-end" : ""}`}
    >
      {scorers.map((player) => (
        <li key={player.id}>
          <PlayerLink
            player={player}
            className="flex items-center gap-1 rounded-md bg-panel-2/80 pr-1.5 ring-1 ring-line hover:ring-accent/50"
          >
            <PlayerPhoto
              player={photoOf(player)}
              className="h-7 w-6 rounded-sm bg-panel object-cover"
            />
            <span className="text-[10px] font-medium">{player.name}</span>
            {player.goals > 1 ? (
              <span className="tabular text-[10px] font-bold text-mint">
                ×{player.goals}
              </span>
            ) : null}
          </PlayerLink>
        </li>
      ))}
    </ul>
  );
}

function HaulRow({
  player,
  yours,
}: {
  player: MatchSheetPlayer;
  yours: boolean;
}) {
  const chips = eventChips(player);
  return (
    <PlayerLink
      player={player}
      className={`flex items-center gap-2.5 rounded-lg border px-2 py-1.5 hover:border-accent/40 ${
        yours
          ? "border-accent/50 bg-accent/10"
          : "border-line bg-panel"
      }`}
    >
      <PlayerPhoto
        player={photoOf(player)}
        className="h-10 w-8 shrink-0 rounded-md bg-panel-2 object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13px] font-semibold">{player.name}</p>
          {yours ? (
            <span className="rounded bg-accent px-1 py-px text-[8px] font-black uppercase tracking-wide text-on-accent">
              You
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          <PosBadge position={player.position} />
          {player.bps > 0 ? (
            <span className="tabular text-[10px] text-muted">{player.bps} BPS</span>
          ) : null}
          {chips}
        </div>
      </div>
      <p
        className={`tabular shrink-0 text-lg font-semibold leading-none ${xpGradeClass(player.sheetPts)}`}
        title="FPL points from this sheet (not minutes)"
      >
        {player.sheetPts}
      </p>
    </PlayerLink>
  );
}

function BpsRace({
  home,
  away,
  homeShort,
  awayShort,
}: {
  home: MatchSheetPlayer[];
  away: MatchSheetPlayer[];
  homeShort: string;
  awayShort: string;
}) {
  const rows = [...home, ...away]
    .filter((p) => p.bps > 0)
    .sort((a, b) => b.bps - a.bps || b.bonus - a.bonus)
    .slice(0, 8);
  if (rows.length === 0) return null;
  const max = rows[0]?.bps ?? 1;
  const homeIds = new Set(home.map((p) => p.id));

  return (
    <section className="mt-4">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted">
        <Icon icon={Award} size="sm" />
        Bonus race
      </p>
      <ul className="space-y-1.5">
        {rows.map((player) => {
          const isHome = homeIds.has(player.id);
          const width = Math.max(8, (player.bps / max) * 100);
          return (
            <li key={player.id}>
              <PlayerLink player={player} className="block hover:opacity-90">
                <div className="mb-0.5 flex items-center justify-between gap-2 text-[11px]">
                  <span className="min-w-0 truncate font-medium">
                    {player.name}
                    <span className="text-muted">
                      {" "}
                      · {isHome ? homeShort : awayShort}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 tabular">
                    {player.bonus > 0 ? (
                      <Chip className="bg-warn/25 text-warn" title="Bonus">
                        +{player.bonus}
                      </Chip>
                    ) : null}
                    <span className="text-muted">{player.bps}</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
                  <div
                    className={`h-full rounded-full ${
                      player.bonus === 3
                        ? "bg-warn"
                        : player.bonus === 2
                          ? "bg-warn/70"
                          : player.bonus === 1
                            ? "bg-warn/45"
                            : isHome
                              ? "bg-accent/70"
                              : "bg-rose-400/70"
                    }`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </PlayerLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TeamDoor({
  label,
  cleanSheet,
  conceded,
}: {
  label: string;
  cleanSheet: boolean;
  conceded: number;
}) {
  if (cleanSheet) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
        <Icon icon={Shield} size="xs" />
        CS · {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-panel-2 px-2 py-0.5 text-[10px] font-medium text-muted">
      {conceded} conceded · {label}
    </span>
  );
}

function fdrChip(fdr: number) {
  if (fdr >= 4) return "bg-danger/15 text-danger";
  if (fdr <= 2) return "bg-accent/15 text-accent";
  return "bg-panel-2 text-muted";
}

function statusChip(status: string): { label: string; className: string } {
  if (status === "i") return { label: "Injured", className: "bg-danger/15 text-danger" };
  if (status === "s") return { label: "Suspended", className: "bg-danger/15 text-danger" };
  if (status === "d") return { label: "Doubt", className: "bg-warn/20 text-warn" };
  if (status === "u" || status === "n") {
    return { label: "Out", className: "bg-panel-2 text-muted" };
  }
  return { label: "News", className: "bg-panel-2 text-muted" };
}

function newsTally(items: MatchNewsItem[]): string {
  const out = items.filter(
    (p) => p.status === "i" || p.status === "s" || p.status === "u" || p.status === "n",
  ).length;
  const doubt = items.filter((p) => p.status === "d").length;
  const parts: string[] = [];
  if (out) parts.push(`${out} out`);
  if (doubt) parts.push(`${doubt} doubt`);
  return parts.length > 0 ? parts.join(" · ") : "No flags";
}

function KickoffHero({ iso }: { iso: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="mt-4 rounded-xl border border-accent/30 bg-accent/8 px-3 py-4 text-center">
      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted">
        <Icon icon={Clock} size="sm" />
        Kickoff
      </p>
      <p className="mt-1.5 text-xl font-semibold leading-tight" suppressHydrationWarning>
        {kickoffLabel(iso)}
      </p>
      <p className="mt-1 text-sm font-medium text-accent" suppressHydrationWarning>
        {kickoffFromNow(iso, now)}
      </p>
    </div>
  );
}

function NewsRow({
  player,
  yours,
}: {
  player: MatchNewsItem;
  yours: boolean;
}) {
  const chip = statusChip(player.status);
  return (
    <PlayerLink
      player={player}
      className={`flex gap-2.5 rounded-lg border px-2 py-2 hover:border-accent/40 ${
        yours ? "border-accent/50 bg-accent/10" : "border-line bg-panel"
      }`}
    >
      <PlayerPhoto
        player={photoOf(player)}
        className="h-10 w-8 shrink-0 rounded-md bg-panel-2 object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-[13px] font-semibold">{player.name}</p>
          {yours ? (
            <span className="rounded bg-accent px-1 py-px text-[8px] font-black uppercase tracking-wide text-on-accent">
              You
            </span>
          ) : null}
          <PosBadge position={player.position} />
          <Chip className={chip.className} title={chip.label}>
            {chip.label}
          </Chip>
          {player.chance != null ? (
            <span className="tabular text-[10px] text-muted">{player.chance}%</span>
          ) : null}
        </div>
        {player.news ? (
          <p className="mt-1 text-[12px] leading-snug text-muted">{player.news}</p>
        ) : null}
      </div>
    </PlayerLink>
  );
}

function UpcomingBody({ match }: { match: MatchView }) {
  const app = useAppState();
  const squad = useMemo(
    () => new Set(app.squadPlayerIds),
    [app.squadPlayerIds],
  );
  const homeNews = match.news?.home ?? [];
  const awayNews = match.news?.away ?? [];
  const yours = [...homeNews, ...awayNews].filter((p) => squad.has(p.id));

  return (
    <>
      <div className="mt-4 rounded-xl border border-line bg-panel-2/50 px-3 py-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ClubCrest
              code={match.home.code}
              name={match.home.short}
              className="h-10 w-10 object-contain"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{match.home.short}</p>
              <p className="truncate text-[11px] text-muted">{match.home.name}</p>
            </div>
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            vs
          </p>
          <div className="flex min-w-0 items-center justify-end gap-2">
            <div className="min-w-0 text-right">
              <p className="truncate text-sm font-semibold">{match.away.short}</p>
              <p className="truncate text-[11px] text-muted">{match.away.name}</p>
            </div>
            <ClubCrest
              code={match.away.code}
              name={match.away.short}
              className="h-10 w-10 object-contain"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[10px]">
          <span
            className={`rounded px-1.5 py-px font-semibold ${fdrChip(match.home.fdr)}`}
            title={`${abbr("fdr")} ${match.home.fdr} home`}
          >
            {match.home.short} {abbr("fdr")} {match.home.fdr} H
          </span>
          <span
            className={`tabular rounded px-1.5 py-px font-semibold bg-foreground/8`}
            title="Club strength from FPL attack/defence ratings"
          >
            {match.home.rating.toFixed(1)} · {match.away.rating.toFixed(1)}
          </span>
          <span
            className={`rounded px-1.5 py-px font-semibold ${fdrChip(match.away.fdr)}`}
            title={`${abbr("fdr")} ${match.away.fdr} away`}
          >
            {match.away.short} {abbr("fdr")} {match.away.fdr} A
          </span>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted">
          {match.home.short} {newsTally(homeNews)}
          {" · "}
          {match.away.short} {newsTally(awayNews)}
        </p>
      </div>

      <KickoffHero iso={match.kickoff} />

      {match.deadline && Date.parse(match.deadline) > Date.now() ? (
        <p className="mt-3 rounded-lg border border-line bg-panel-2/40 px-3 py-2 text-xs text-muted">
          FPL deadline for this {abbr("gw")}: {deadlineLabel(match.deadline)}.
        </p>
      ) : null}

      {yours.length > 0 ? (
        <section className="mt-4">
          <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted">
            <Icon icon={Users} size="sm" />
            In your squad
          </p>
          <ul className="space-y-1.5">
            {yours.map((player) => (
              <li key={player.id}>
                <NewsRow player={player} yours />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-4">
        <p className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-widest text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Icon icon={Newspaper} size="sm" />
            {match.home.name}
          </span>
          <span>{newsTally(homeNews)}</span>
        </p>
        {homeNews.length === 0 ? (
          <p className="rounded-lg border border-line px-3 py-2 text-sm text-muted">
            No FPL news flagged for {match.home.short}.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {homeNews.map((player) => (
              <li key={player.id}>
                <NewsRow player={player} yours={squad.has(player.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4">
        <p className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-widest text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Icon icon={Newspaper} size="sm" />
            {match.away.name}
          </span>
          <span>{newsTally(awayNews)}</span>
        </p>
        {awayNews.length === 0 ? (
          <p className="rounded-lg border border-line px-3 py-2 text-sm text-muted">
            No FPL news flagged for {match.away.short}.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {awayNews.map((player) => (
              <li key={player.id}>
                <NewsRow player={player} yours={squad.has(player.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-4 text-[10px] leading-relaxed text-muted">
        Team news is the official FPL availability feed — injuries, doubts,
        suspensions, and press notes. It is not a match preview from a
        journalist.
      </p>
    </>
  );
}

export function MatchStats({
  match,
  onClose,
}: {
  match: MatchView;
  onClose: () => void;
}) {
  const app = useAppState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const upcoming = match.status === "upcoming";
  const homeWin = match.winner === "home";
  const awayWin = match.winner === "away";
  const homeScore = match.home.score ?? 0;
  const awayScore = match.away.score ?? 0;
  const homeCs = awayScore === 0;
  const awayCs = homeScore === 0;
  const squad = useMemo(
    () => new Set(app.squadPlayerIds),
    [app.squadPlayerIds],
  );
  const home = match.sheet?.home ?? [];
  const away = match.sheet?.away ?? [];
  const yours = useMemo(() => {
    return [...home, ...away]
      .filter((p) => squad.has(p.id))
      .sort((a, b) => b.sheetPts - a.sheetPts || b.bps - a.bps);
  }, [home, away, squad]);
  const yourTotal = yours.reduce((sum, p) => sum + p.sheetPts, 0);
  const homeBps = home.reduce((sum, p) => sum + p.bps, 0);
  const awayBps = away.reduce((sum, p) => sum + p.bps, 0);
  const bpsAll = homeBps + awayBps;
  const homeBpsPct = bpsAll > 0 ? (homeBps / bpsAll) * 100 : 50;
  const empty = home.length === 0 && away.length === 0;

  const panel = (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/50 sm:items-stretch sm:justify-end">
      <button
        type="button"
        className="absolute inset-0"
        aria-label={upcoming ? "Close match preview" : "Close match stats"}
        onClick={onClose}
      />
      <aside
        className="relative z-10 flex h-[min(92dvh,100%)] w-full min-w-0 max-w-[100vw] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-2xl border-t border-line bg-panel p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:h-full sm:max-w-lg sm:rounded-none sm:border-t-0 sm:border-l sm:p-5 sm:pb-5"
        role="dialog"
        aria-labelledby="match-stats-title"
      >
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-widest text-muted">
              {upcoming
                ? "Upcoming"
                : match.winner === "draw"
                  ? "Draw"
                  : "Full time"}
              {" · "}
              {match.eventName.replace("Gameweek", abbr("gw"))}
            </p>
            <h2
              id="match-stats-title"
              className="mt-2 text-lg font-semibold leading-tight"
            >
              {upcoming ? "Match preview" : "Match sheet"}
            </h2>
            <p className="mt-0.5 text-xs text-muted" suppressHydrationWarning>
              {kickoffLabel(match.kickoff)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-muted hover:text-foreground"
            aria-label="Close"
          >
            <Icon icon={X} size="md" />
          </button>
        </header>

        {upcoming ? (
          <UpcomingBody match={match} />
        ) : (
          <>
        <div className="mt-4 rounded-xl border border-line bg-panel-2/50 px-3 py-3">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <ClubCrest
                code={match.home.code}
                name={match.home.short}
                className="h-10 w-10 object-contain"
              />
              <p
                className={`truncate text-sm font-semibold ${homeWin ? "text-accent" : ""}`}
              >
                {match.home.short}
              </p>
            </div>
            <p className="tabular text-3xl font-semibold leading-none">
              <span className={homeWin ? "text-accent" : ""}>{homeScore}</span>
              <span className="mx-1 text-muted">–</span>
              <span className={awayWin ? "text-accent" : ""}>{awayScore}</span>
            </p>
            <div className="flex min-w-0 items-center justify-end gap-2">
              <p
                className={`truncate text-sm font-semibold ${awayWin ? "text-accent" : ""}`}
              >
                {match.away.short}
              </p>
              <ClubCrest
                code={match.away.code}
                name={match.away.short}
                className="h-10 w-10 object-contain"
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <TeamDoor
              label={match.home.short}
              cleanSheet={homeCs}
              conceded={awayScore}
            />
            <TeamDoor
              label={match.away.short}
              cleanSheet={awayCs}
              conceded={homeScore}
            />
          </div>
          {bpsAll > 0 ? (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[10px] font-medium uppercase tracking-wide text-muted">
                <span>
                  {match.home.short} {Math.round(homeBpsPct)}% BPS
                </span>
                <span>
                  {Math.round(100 - homeBpsPct)}% {match.away.short}
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-rose-400/30">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${homeBpsPct}%` }}
                />
              </div>
            </div>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <ScorerStrip players={home} align="left" />
            <ScorerStrip players={away} align="right" />
          </div>
        </div>

        {empty ? (
          <p className="mt-4 text-sm text-muted">
            FPL has not published the match sheet yet.
          </p>
        ) : (
          <>
            {yours.length > 0 ? (
              <section className="mt-4">
                <p className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-widest text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon icon={Users} size="sm" />
                    In your squad
                  </span>
                  <span className={`tabular ${xpGradeClass(yourTotal)}`}>
                    {yourTotal} pts
                  </span>
                </p>
                <ul className="space-y-1.5">
                  {yours.map((player) => (
                    <li key={player.id}>
                      <HaulRow player={player} yours />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <BpsRace
              home={home}
              away={away}
              homeShort={match.home.short}
              awayShort={match.away.short}
            />

            <section className="mt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted">
                {match.home.name}
              </p>
              <ul className="space-y-1.5">
                {home.map((player) => (
                  <li key={player.id}>
                    <HaulRow
                      player={player}
                      yours={squad.has(player.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted">
                {match.away.name}
              </p>
              <ul className="space-y-1.5">
                {away.map((player) => (
                  <li key={player.id}>
                    <HaulRow
                      player={player}
                      yours={squad.has(player.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>

            <p className="mt-4 text-[10px] leading-relaxed text-muted">
              Points are FPL events from this sheet — goals, assists, bonus,
              cards, saves, defensive contribution, and (when BPS looks like a
              start) clean sheet or goals conceded. Minutes are not in the feed,
              so appearance points are not included.
            </p>
          </>
        )}
          </>
        )}
      </aside>
    </div>
  );

  if (!mounted) return null;
  return createPortal(panel, document.body);
}
