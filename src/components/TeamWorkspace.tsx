"use client";

import { ChipPanel } from "@/components/ChipPanel";
import { FormationBoard } from "@/components/FormationBoard";
import { Icon, IconLabel } from "@/components/Icon";
import { MatchBoard } from "@/components/MatchBoard";
import { TeamIdForm } from "@/components/TeamIdForm";
import { TeamPulse } from "@/components/TeamPulse";
import { WeekDecision } from "@/components/WeekDecision";
import type { TeamPulse as Pulse } from "@/lib/advice";
import { abbr } from "@/lib/abbr";
import { formatPrice, formatXp, kickoffLabel } from "@/lib/format";
import type { MatchBoardData } from "@/lib/matches";
import type { ChipAdvice } from "@/lib/optimize/chips";
import type { LineupResult } from "@/lib/optimize/lineup";
import type { TransferMove, TransferPlan } from "@/lib/optimize/transfers";
import type { RankedPlayer } from "@/lib/xp/model";
import { formatTeamId, rememberTeamId } from "@/lib/team-id";
import {
  ArrowLeftRight,
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  Check,
  Copy,
  LayoutGrid,
  Radio,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppState } from "@/components/AppState";

const TABS = [
  { id: "play", label: "This week", icon: CalendarCheck },
  { id: "xi", label: abbr("xi"), icon: LayoutGrid },
  { id: "matches", label: "Matches", icon: CalendarClock },
  { id: "chips", label: "Chips", icon: Sparkles },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function TeamWorkspace({
  entryId,
  manager,
  teamName,
  pulse,
  freeTransfers,
  gameweekName,
  gameweekId,
  deadline,
  bestPlan,
  holdPlan,
  plans,
  formations,
  chips,
  matches,
  squad,
  madeMoves,
  captainId,
  viceId,
}: {
  entryId: number;
  manager: string;
  teamName: string;
  pulse: Pulse;
  freeTransfers: number;
  gameweekName: string;
  gameweekId: number;
  deadline: string | null;
  bestPlan: TransferPlan;
  holdPlan: TransferPlan;
  plans: TransferPlan[];
  formations: LineupResult[];
  chips: ChipAdvice[];
  matches: MatchBoardData;
  squad: RankedPlayer[];
  madeMoves: TransferMove[];
  captainId: number | null;
  viceId: number | null;
}) {
  const [tab, setTab] = useState<TabId>("play");
  const [switchTeam, setSwitchTeam] = useState(false);
  const [copied, setCopied] = useState(false);
  const app = useAppState();

  useEffect(() => {
    rememberTeamId(entryId);
    const planned = bestPlan.lineup.xi.concat(bestPlan.lineup.bench);
    app.hydrateTeam({
      id: entryId,
      name: teamName,
      clubIds: planned.map((p) => p.teamId),
      playerIds: planned.map((p) => p.id),
      formation: bestPlan.lineup.formation,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, teamName, bestPlan.lineup.formation]);

  useEffect(() => {
    function syncFromHash() {
      const fromHash = window.location.hash.replace("#", "") as TabId;
      if (TABS.some((item) => item.id === fromHash)) setTab(fromHash);
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  function go(next: TabId) {
    setTab(next);
    app.setTeamTab(next);
    window.history.replaceState(null, "", `#${next}`);
  }

  const chipPulse = chips.find((c) => c.recommend) ?? chips.find((c) => c.urgency !== "none");
  const liveCount = matches.live.length;
  const nextMatch = matches.groups
    .flatMap((g) => g.matches)
    .find((m) => m.status === "upcoming");

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-line bg-panel/90 p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
              {manager}
            </p>
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {teamName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(String(entryId));
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1600);
                  } catch {
                    setCopied(false);
                  }
                }}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-panel-2 px-2 py-0.5 text-[11px] text-muted hover:text-foreground"
                title="Copy Team ID"
              >
                <span className="uppercase tracking-wide">ID</span>
                <span className="tabular font-semibold text-foreground">
                  {formatTeamId(entryId)}
                </span>
                <Icon icon={copied ? Check : Copy} size="xs" />
                <span className="sr-only">{copied ? "Copied" : "Copy Team ID"}</span>
              </button>
              <p className="text-xs text-muted">
                {gameweekName}
                {deadline ? ` · deadline ${deadline}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSwitchTeam((open) => !open)}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-foreground"
          >
            <IconLabel icon={switchTeam ? X : ArrowLeftRight} size="xs">
              {switchTeam ? "Close" : "Switch team"}
            </IconLabel>
          </button>
        </div>

        {switchTeam ? (
          <div className="mt-3 space-y-2 border-t border-line pt-3">
            <TeamIdForm initialId={String(entryId)} compact />
            <Link
              href="/team?switch=1"
              className="inline-block text-xs text-muted hover:text-accent"
            >
              Enter a different ID
            </Link>
          </div>
        ) : null}

        <TeamPulse pulse={pulse} />

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          <button
            type="button"
            className="text-left hover:text-accent"
            onClick={() => go("matches")}
            suppressHydrationWarning
          >
            <IconLabel icon={Radio} size="xs">
              {liveCount > 0
                ? `${liveCount} live`
                : nextMatch
                  ? `Next ${nextMatch.home.short} vs ${nextMatch.away.short} · ${kickoffLabel(nextMatch.kickoff)}`
                  : "Fixtures"}
            </IconLabel>
          </button>
          <span aria-hidden>·</span>
          <button type="button" className="text-left hover:text-accent" onClick={() => go("xi")}>
            <IconLabel icon={LayoutGrid} size="xs">
              {bestPlan.lineup.formation} · {formatXp(bestPlan.lineup.xp)} {abbr("xiXp")}
            </IconLabel>
          </button>
          {chipPulse ? (
            <>
              <span aria-hidden>·</span>
              <button type="button" className="text-left hover:text-accent" onClick={() => go("chips")}>
                <IconLabel icon={Sparkles} size="xs">
                  {chipPulse.recommend ? `Play ${chipPulse.label}` : chipPulse.label}
                </IconLabel>
              </button>
            </>
          ) : null}
        </div>
      </section>

      <div
        role="tablist"
        aria-label="Team views"
        className="sticky top-14 z-20 -mx-3 grid grid-cols-4 gap-1 border-y border-line bg-background/90 px-3 py-2 backdrop-blur-md sm:top-16 sm:mx-0 sm:rounded-xl sm:border sm:px-2"
      >
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => go(item.id)}
              className={`rounded-lg px-2 py-2 text-xs font-medium sm:text-sm ${
                selected
                  ? "bg-accent text-on-accent shadow-sm"
                  : "text-muted hover:bg-panel-2 hover:text-foreground"
              }`}
            >
              <span className="flex flex-col items-center gap-0.5 sm:flex-row sm:justify-center sm:gap-1.5">
                <Icon icon={item.icon} size="sm" />
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {tab === "play" ? (
        <WeekDecision
          gameweekName={gameweekName}
          deadline={deadline}
          freeTransfers={freeTransfers}
          bestPlan={bestPlan}
          holdPlan={holdPlan}
          plans={plans}
          formations={formations.map((row) => ({
            formation: row.formation,
            xp: row.xp,
          }))}
          entryId={entryId}
          teamName={teamName}
          chips={chips}
          squad={squad}
          madeMoves={madeMoves}
          captainId={captainId}
          viceId={viceId}
          gameweekId={gameweekId}
        />
      ) : null}

      {tab === "xi" ? (
        <FormationBoard options={formations} gameweek={gameweekId} />
      ) : null}

      {tab === "matches" ? (
        <div className="space-y-3">
          <MatchBoard initial={matches} compact />
          <p className="text-center text-xs">
            <Link href="/fixtures" className="text-accent">
              <IconLabel icon={ArrowRight} size="xs">
                Full fixture list
              </IconLabel>
            </Link>
          </p>
        </div>
      ) : null}

      {tab === "chips" ? (
        <div>
          <h2 className="mb-2 text-sm font-semibold">Chip window</h2>
          <ChipPanel chips={chips} />
        </div>
      ) : null}
    </div>
  );
}
