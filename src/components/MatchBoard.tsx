"use client";

import { useAppState } from "@/components/AppState";
import { ClubCrest } from "@/components/ClubCrest";
import { IconLabel } from "@/components/Icon";
import { Jump } from "@/components/Jump";
import { LivePitch } from "@/components/LivePitch";
import { MatchStats } from "@/components/MatchStats";
import { fixturesHref, playersHref } from "@/lib/app-href";
import type { MatchBoardData, MatchEventGroup, MatchSide, MatchView } from "@/lib/matches";
import { abbr } from "@/lib/abbr";
import { kickoffLabel } from "@/lib/format";
import { ArrowRight, BarChart3, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

function fdrClass(fdr: number) {
  if (fdr >= 4) return "bg-danger/15 text-danger";
  if (fdr <= 2) return "bg-accent/15 text-accent";
  return "bg-panel-2 text-muted";
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
          <span
            className={`mt-0.5 inline-block rounded px-1 py-px text-[10px] ${fdrClass(side.fdr)}`}
            title={`${abbr("fdr")} ${side.fdr}`}
          >
            {abbr("fdr")} {side.fdr}
          </span>
        </div>
      </div>
    </div>
  );
}

function isPastGroup(group: MatchEventGroup): boolean {
  return (
    group.matches.length > 0 &&
    group.matches.every((m) => m.status === "finished")
  );
}

function byKickoff(a: MatchView, b: MatchView): number {
  const aTime = a.kickoff ? Date.parse(a.kickoff) : Number.POSITIVE_INFINITY;
  const bTime = b.kickoff ? Date.parse(b.kickoff) : Number.POSITIVE_INFINITY;
  const aMs = Number.isFinite(aTime) ? aTime : Number.POSITIVE_INFINITY;
  const bMs = Number.isFinite(bTime) ? bTime : Number.POSITIVE_INFINITY;
  return aMs - bMs || a.id - b.id;
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

function MatchCard({
  match,
  highlight,
  yours,
  onOpen,
}: {
  match: MatchView;
  highlight?: boolean;
  yours?: boolean;
  onOpen?: (match: MatchView) => void;
}) {
  const live = match.status === "live";
  const done = match.status === "finished";
  const upcoming = match.status === "upcoming";
  const homeWin = match.winner === "home";
  const awayWin = match.winner === "away";
  const openable = (done || upcoming) && onOpen;

  const body = (
    <>
      {live ? (
        <LivePitch match={match} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-widest">
            {done ? (
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
              {done ? (
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
              {openable ? (
                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-accent">
                  {done ? "Stats" : "News"}
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
        </>
      )}
    </>
  );

  const shell = `rounded-lg border px-3 py-2.5 ${
    highlight
      ? "border-accent/70 bg-accent/10 ring-1 ring-accent/40"
      : yours
        ? "border-accent/30 bg-panel"
        : live
          ? "border-accent/50 bg-accent/5"
          : homeWin || awayWin
            ? "border-accent/25 bg-panel"
            : "border-line bg-panel"
  }`;

  if (openable) {
    return (
      <button
        type="button"
        onClick={() => onOpen(match)}
        className={`${shell} w-full text-left transition hover:border-accent/50`}
        aria-label={
          done
            ? `${match.home.short} ${match.home.score ?? 0} ${match.away.short} ${match.away.score ?? 0}, match stats`
            : `${match.home.short} vs ${match.away.short}, ${kickoffLabel(match.kickoff)}, match news`
        }
      >
        {body}
      </button>
    );
  }

  return <article className={shell}>{body}</article>;
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
  const [openMatch, setOpenMatch] = useState<MatchView | null>(null);
  const [, setPollWake] = useState(0);
  const shouldPoll = needsPoll(board);

  useEffect(() => {
    setBoard(initial);
  }, [initial]);

  useEffect(() => {
    try {
      window.localStorage.removeItem("fpl-win-live-demo");
      window.localStorage.removeItem("fpl-win-live-demo-80");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (shouldPoll) return;
    const id = window.setInterval(() => setPollWake(Date.now()), 20_000);
    return () => window.clearInterval(id);
  }, [shouldPoll]);

  useEffect(() => {
    if (!shouldPoll) return;
    let stop = false;
    let es: EventSource | null = null;
    let pollId = 0;
    let waitId = 0;
    let opened = false;

    const apply = (next: MatchBoardData) => {
      if (!stop) setBoard(next);
    };

    const pollOnce = async () => {
      try {
        const res = await fetch("/api/matches", { cache: "no-store" });
        if (!res.ok) return;
        apply((await res.json()) as MatchBoardData);
      } catch {
        /* keep the last good board */
      }
    };

    const startPoll = () => {
      if (pollId || stop) return;
      void pollOnce();
      pollId = window.setInterval(() => {
        void pollOnce();
      }, 4_000);
    };

    try {
      es = new EventSource("/api/matches/stream");
      es.onmessage = (ev) => {
        opened = true;
        if (waitId) window.clearTimeout(waitId);
        try {
          apply(JSON.parse(ev.data) as MatchBoardData);
        } catch {
          /* ignore a truncated frame */
        }
      };
      waitId = window.setTimeout(() => {
        if (!opened) {
          es?.close();
          es = null;
          startPoll();
        }
      }, 8_000);
    } catch {
      startPoll();
    }

    return () => {
      stop = true;
      es?.close();
      if (pollId) window.clearInterval(pollId);
      if (waitId) window.clearTimeout(waitId);
    };
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

  const compactGroup = compact
    ? board.groups.find((g) => g.matches.some((m) => m.status === "live")) ??
      board.groups.find(
        (g) =>
          g.eventId === (board.currentEventId ?? board.upcomingEventId) &&
          g.matches.some((m) => m.status !== "finished"),
      ) ??
      board.groups.find((g) => g.eventId === board.upcomingEventId) ??
      board.groups[0]
    : null;
  const groups = compact ? (compactGroup ? [compactGroup] : []) : board.groups;

  function cardFlags(match: MatchView) {
    return {
      highlight: Boolean(
        focusClubId &&
          (match.home.id === focusClubId || match.away.id === focusClubId),
      ),
      yours: squadClubs.has(match.home.id) || squadClubs.has(match.away.id),
    };
  }

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

      {groups.map((group) => {
        const playing = group.matches
          .filter((m) => m.status === "live")
          .sort(byKickoff);
        const upcoming = group.matches
          .filter((m) => m.status === "upcoming")
          .sort(byKickoff);
        const finished = group.matches
          .filter((m) => m.status === "finished")
          .sort(byKickoff);
        if (compact && upcoming.length === 0 && playing.length === 0) {
          return null;
        }
        const shownUpcoming = compact ? upcoming.slice(0, playing.length ? 4 : 6) : upcoming;
        const liveNow = playing.length > 0;
        const past = !compact && isPastGroup(group);
        const matchLists = (
          <>
            {playing.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {playing.map((match) => (
                  <div key={match.id} className="sm:col-span-2">
                    <MatchCard
                      match={match}
                      {...cardFlags(match)}
                    />
                  </div>
                ))}
              </div>
            ) : null}
            {shownUpcoming.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {shownUpcoming.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    {...cardFlags(match)}
                    onOpen={setOpenMatch}
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
                    {...cardFlags(match)}
                    onOpen={setOpenMatch}
                  />
                ))}
              </div>
            ) : null}
          </>
        );
        if (past) {
          return (
            <details
              key={group.eventId}
              className="rounded-xl border border-line bg-panel px-3 py-2"
            >
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                <span>{group.name}</span>
                <span className="text-xs font-medium text-muted">
                  {finished.length} done
                </span>
              </summary>
              <div className="mt-3 space-y-2">{matchLists}</div>
            </details>
          );
        }
        return (
          <section key={group.eventId} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                {liveNow ? (
                  <span className="live-dot h-2 w-2 rounded-full bg-accent" />
                ) : null}
                {compact
                  ? liveNow
                    ? `Live · ${group.name}`
                    : `Next fixtures · ${group.name}`
                  : group.name}
              </h2>
              {compact ? (
                <Link href="/fixtures" className="text-xs text-accent">
                  <IconLabel icon={ArrowRight} size="xs">
                    Full list
                  </IconLabel>
                </Link>
              ) : (
                <span className="text-xs text-muted">
                  {liveNow ? `${playing.length} live` : ""}
                  {liveNow && upcoming.length ? " · " : ""}
                  {upcoming.length ? `${upcoming.length} to play` : ""}
                  {finished.length
                    ? `${liveNow || upcoming.length ? " · " : ""}${finished.length} done`
                    : ""}
                </span>
              )}
            </div>
            {matchLists}
          </section>
        );
      })}
      {openMatch ? (
        <MatchStats
          match={
            board.groups
              .flatMap((g) => g.matches)
              .find((m) => m.id === openMatch.id) ?? openMatch
          }
          onClose={() => setOpenMatch(null)}
        />
      ) : null}
    </div>
  );
}
