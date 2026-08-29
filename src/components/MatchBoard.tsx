"use client";

import { useAppState } from "@/components/AppState";
import { ClubCrest } from "@/components/ClubCrest";
import { IconLabel } from "@/components/Icon";
import { Jump } from "@/components/Jump";
import { fixturesHref, playersHref } from "@/lib/app-href";
import type { MatchBoardData, MatchSide, MatchView } from "@/lib/matches";
import { abbr } from "@/lib/abbr";
import { kickoffLabel } from "@/lib/format";
import { liveMatchClock } from "@/lib/live-clock";
import { ArrowRight, BarChart3, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

function fdrClass(fdr: number) {
  if (fdr >= 4) return "bg-danger/15 text-danger";
  if (fdr <= 2) return "bg-accent/15 text-accent";
  return "bg-panel-2 text-muted";
}

function useNow(intervalMs: number, enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs]);
  return now;
}

function LiveMinute({
  match,
  now,
}: {
  match: MatchView;
  now: number;
}) {
  const clock = liveMatchClock(match, now);
  return (
    <span
      className="flex items-center gap-1.5 font-semibold text-accent"
      title="Match clock from kickoff — FPL's own minute can lag"
      suppressHydrationWarning
    >
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-accent" />
      {clock.label}
    </span>
  );
}

function ratingTone(rating: number) {
  if (rating >= 8.2) return "text-accent";
  if (rating >= 6.8) return "text-warn";
  return "text-muted";
}

function needsPoll(board: MatchBoardData): boolean {
  if (board.live.length > 0) return true;
  const now = Date.now();
  const windowMs = 90 * 60 * 1000;
  return board.groups.some((g) =>
    g.matches.some((m) => {
      if (!m.kickoff) return false;
      const kick = Date.parse(m.kickoff);
      return Number.isFinite(kick) && Math.abs(kick - now) < windowMs;
    }),
  );
}

function SideBlock({
  side,
  align,
  winner,
  muted,
}: {
  side: MatchSide;
  align: "left" | "right";
  winner: boolean;
  muted: boolean;
}) {
  return (
    <div
      className={`min-w-0 ${align === "right" ? "text-right" : ""} ${
        muted ? "opacity-45" : ""
      }`}
    >
      <div
        className={`flex items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        <span
          className={`relative shrink-0 rounded-full p-0.5 ${
            winner ? "bg-accent/20 ring-2 ring-accent" : "ring-1 ring-foreground/12"
          }`}
        >
          <ClubCrest
            code={side.code}
            name={side.short}
            className="h-8 w-8 object-contain sm:h-9 sm:w-9"
          />
          {winner ? (
            <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-black text-on-accent">
              W
            </span>
          ) : null}
        </span>
        <div className="min-w-0">
          <p
            className={`truncate text-sm font-semibold ${
              winner ? "text-accent" : ""
            }`}
          >
            {side.short}
          </p>
          <p className="truncate text-[11px] text-muted">{side.name}</p>
        </div>
      </div>
      <div
        className={`mt-1.5 flex flex-wrap items-center gap-1 ${
          align === "right" ? "justify-end" : ""
        }`}
      >
        <span
          className={`tabular rounded px-1 py-px text-[10px] font-semibold ${ratingTone(side.rating)} bg-foreground/8`}
          title="Club strength from FPL attack/defence ratings"
        >
          {side.rating.toFixed(1)}
        </span>
        <span
          className={`rounded px-1 py-px text-[10px] ${fdrClass(side.fdr)}`}
          title={`${abbr("fdr")} ${side.fdr}`}
        >
          {abbr("fdr")} {side.fdr}
        </span>
      </div>
    </div>
  );
}

function MatchCard({
  match,
  highlight,
  yours,
  now = Date.now(),
}: {
  match: MatchView;
  highlight?: boolean;
  yours?: boolean;
  now?: number;
}) {
  const live = match.status === "live";
  const done = match.status === "finished";
  const homeWin = match.winner === "home";
  const awayWin = match.winner === "away";

  return (
    <article
      className={`rounded-lg border px-3 py-2.5 ${
        highlight
          ? "border-accent/70 bg-accent/10 ring-1 ring-accent/40"
          : yours
            ? "border-accent/30 bg-panel"
            : live
              ? "border-accent/50 bg-accent/5"
              : homeWin || awayWin
                ? "border-accent/25 bg-panel"
                : "border-line bg-panel"
      }`}
    >
      <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-widest">
        {live ? (
          <LiveMinute match={match} now={now} />
        ) : done ? (
          <span className={homeWin || awayWin ? "font-semibold text-accent" : "text-muted"}>
            {match.winner === "draw" ? "Draw" : "Full time"}
          </span>
        ) : (
          <span className="text-muted">
            <time dateTime={match.kickoff ?? undefined} suppressHydrationWarning>
              {kickoffLabel(match.kickoff)}
            </time>
          </span>
        )}
        <span className="text-muted">
          {match.eventName.replace("Gameweek", abbr("gw"))}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <SideBlock
          side={match.home}
          align="left"
          winner={homeWin}
          muted={awayWin}
        />
        <div className="px-1 text-center">
          {live || done ? (
            <p className="tabular text-xl font-semibold leading-none">
              <span className={homeWin ? "text-accent" : ""}>
                {match.home.score ?? 0}
              </span>
              <span className="mx-1 text-muted">–</span>
              <span className={awayWin ? "text-accent" : ""}>
                {match.away.score ?? 0}
              </span>
            </p>
          ) : (
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">
              vs
            </p>
          )}
          {match.winner && match.winner !== "draw" && match.winRating != null ? (
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
              {live ? "Ahead" : "Win"} {match.winRating.toFixed(1)}
            </p>
          ) : match.winner === "draw" ? (
            <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">
              Level
            </p>
          ) : null}
        </div>
        <SideBlock
          side={match.away}
          align="right"
          winner={awayWin}
          muted={homeWin}
        />
      </div>
    </article>
  );
}

export function MatchBoard({
  initial,
  compact,
}: {
  initial: MatchBoardData;
  compact?: boolean;
}) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-panel" />}>
      <MatchBoardInner initial={initial} compact={compact} />
    </Suspense>
  );
}

function MatchBoardInner({
  initial,
  compact,
}: {
  initial: MatchBoardData;
  compact?: boolean;
}) {
  const searchParams = useSearchParams();
  const app = useAppState();
  const urlClub = Number.parseInt(searchParams.get("club") ?? "", 10);
  const focusClubId =
    Number.isFinite(urlClub) && urlClub > 0 ? urlClub : app.focusClubId;
  const [board, setBoard] = useState(initial);
  const liveNow = useNow(5_000, board.live.length > 0);
  const shouldPoll = needsPoll(board);

  useEffect(() => {
    setBoard(initial);
  }, [initial]);

  useEffect(() => {
    if (!shouldPoll) return;
    const tick = async () => {
      try {
        const res = await fetch("/api/matches", { cache: "no-store" });
        if (!res.ok) return;
        const next = (await res.json()) as MatchBoardData;
        setBoard(next);
      } catch {
        /* keep the last good board */
      }
    };
    void tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [shouldPoll]);

  const squadClubs = useMemo(() => new Set(app.squadClubIds), [app.squadClubIds]);
  const focusSide = useMemo(() => {
    if (!focusClubId) return null;
    for (const group of board.groups) {
      for (const match of group.matches) {
        if (match.home.id === focusClubId) return match.home;
        if (match.away.id === focusClubId) return match.away;
      }
    }
    for (const match of board.live) {
      if (match.home.id === focusClubId) return match.home;
      if (match.away.id === focusClubId) return match.away;
    }
    return null;
  }, [board, focusClubId]);

  function rankMatch(match: MatchView): number {
    if (focusClubId && (match.home.id === focusClubId || match.away.id === focusClubId)) {
      return 0;
    }
    if (squadClubs.has(match.home.id) || squadClubs.has(match.away.id)) return 1;
    return 2;
  }

  const compactGroup = compact
    ? board.groups.find(
        (g) =>
          g.eventId === (board.currentEventId ?? board.upcomingEventId) &&
          g.matches.some((m) => m.status !== "finished"),
      ) ??
      board.groups.find((g) => g.eventId === board.upcomingEventId) ??
      board.groups[0]
    : null;
  const groups = compact ? (compactGroup ? [compactGroup] : []) : board.groups;
  const live = board.live;

  return (
    <div className="space-y-4">
      {focusClubId && focusSide ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/8 px-3 py-2 text-xs">
          <ClubCrest
            code={focusSide.code}
            name={focusSide.short}
            className="h-6 w-6 object-contain"
          />
          <p className="font-medium">
            {focusSide.name} fixtures
            {app.squadClubIds.includes(focusClubId) ? " · in your squad" : ""}
          </p>
          <Jump
            href={playersHref({ club: focusClubId })}
            icon={BarChart3}
            onClick={() => app.setRankings({ clubIds: [focusClubId], view: null })}
          >
            {focusSide.short} in rankings
          </Jump>
          <Link
            href={fixturesHref()}
            onClick={() => app.setFocusClub(null)}
            className="ml-auto inline-flex items-center gap-1 text-muted hover:text-foreground"
          >
            <IconLabel icon={X} size="xs">
              Clear club
            </IconLabel>
          </Link>
        </div>
      ) : null}
      {live.length > 0 ? (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <span className="live-dot h-2 w-2 rounded-full bg-accent" />
              Live matches
            </h2>
            <span className="text-[10px] uppercase tracking-widest text-muted">
              Updates every 15s
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[...live].sort((a, b) => rankMatch(a) - rankMatch(b)).map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                now={liveNow}
                highlight={Boolean(
                  focusClubId &&
                    (match.home.id === focusClubId || match.away.id === focusClubId),
                )}
                yours={
                  squadClubs.has(match.home.id) || squadClubs.has(match.away.id)
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {groups.map((group) => {
        const upcoming = group.matches
          .filter((m) => m.status === "upcoming")
          .sort((a, b) => rankMatch(a) - rankMatch(b));
        const finished = group.matches
          .filter((m) => m.status === "finished")
          .sort((a, b) => rankMatch(a) - rankMatch(b));
        const playing = group.matches.filter((m) => m.status === "live");
        if (compact && upcoming.length === 0 && playing.length === 0) {
          return null;
        }
        const shownUpcoming = compact ? upcoming.slice(0, 6) : upcoming;
        return (
          <section key={group.eventId} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">
                {compact ? `Next fixtures · ${group.name}` : group.name}
              </h2>
              {compact ? (
                <Link href="/fixtures" className="text-xs text-accent">
                  <IconLabel icon={ArrowRight} size="xs">
                    Full list
                  </IconLabel>
                </Link>
              ) : (
                <span className="text-xs text-muted">
                  {upcoming.length} to play
                  {finished.length ? ` · ${finished.length} done` : ""}
                </span>
              )}
            </div>
            {shownUpcoming.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {shownUpcoming.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    highlight={Boolean(
                      focusClubId &&
                        (match.home.id === focusClubId ||
                          match.away.id === focusClubId),
                    )}
                    yours={
                      squadClubs.has(match.home.id) ||
                      squadClubs.has(match.away.id)
                    }
                  />
                ))}
              </div>
            ) : null}
            {!compact && finished.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {finished.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    highlight={Boolean(
                      focusClubId &&
                        (match.home.id === focusClubId ||
                          match.away.id === focusClubId),
                    )}
                    yours={
                      squadClubs.has(match.home.id) ||
                      squadClubs.has(match.away.id)
                    }
                  />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
