"use client";

import { ChipPanel } from "@/components/ChipPanel";
import { Icon, IconLabel } from "@/components/Icon";
import { Pitch } from "@/components/Pitch";
import { TeamIdForm } from "@/components/TeamIdForm";
import { TeamPulse } from "@/components/TeamPulse";
import { WeekDecision } from "@/components/WeekDecision";
import { WeekPlanApply } from "@/components/WeekPlanApply";
import type { TeamPulse as Pulse } from "@/lib/advice";
import { abbr } from "@/lib/abbr";
import type { FplChipName, FplChipPlay } from "@/lib/fpl/types";
import { chipAdvice, type ChipAdvice } from "@/lib/optimize/chips";
import { withCaptain, type LineupResult } from "@/lib/optimize/lineup";
import type { TransferMove, TransferPlan } from "@/lib/optimize/transfers";
import type { RankedPlayer } from "@/lib/xp/model";
import { formatTeamId, rememberTeamId } from "@/lib/team-id";
import { planKey, weekPlanOptions } from "@/lib/week-plan";
import {
  ArrowLeftRight,
  CalendarCheck,
  Check,
  Copy,
  LayoutGrid,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAppState } from "@/components/AppState";

const TABS = [
  { id: "play", label: "This week", icon: CalendarCheck },
  { id: "xi", label: abbr("xi"), icon: LayoutGrid },
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
  picked,
  picksLive,
  chips,
  chipPlays,
  activeChip,
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
  picked: LineupResult;
  picksLive: boolean;
  chips: ChipAdvice[];
  chipPlays: FplChipPlay[];
  activeChip: FplChipName | null;
  squad: RankedPlayer[];
  madeMoves: TransferMove[];
  captainId: number | null;
  viceId: number | null;
}) {
  const [tab, setTab] = useState<TabId>("play");
  const [switchTeam, setSwitchTeam] = useState(false);
  const [copied, setCopied] = useState(false);
  const app = useAppState();
  const options = useMemo(
    () => weekPlanOptions(plans, bestPlan, holdPlan),
    [plans, bestPlan, holdPlan],
  );
  const recommendedKey = planKey(bestPlan);
  const [selectedKey, setSelectedKey] = useState(recommendedKey);
  const [appliedXiKey, setAppliedXiKey] = useState<string | null>(null);
  const [appliedArmbandKey, setAppliedArmbandKey] = useState<string | null>(null);
  const [appliedChip, setAppliedChip] = useState<FplChipName | null>(null);

  useEffect(() => {
    setSelectedKey(planKey(bestPlan));
    setAppliedXiKey(null);
    setAppliedArmbandKey(null);
    setAppliedChip(null);
  }, [entryId, recommendedKey]);

  const selectedPlan = options.find((row) => planKey(row) === selectedKey) ?? bestPlan;
  const xiPlan = options.find((row) => planKey(row) === appliedXiKey);
  const capPlan = options.find((row) => planKey(row) === appliedArmbandKey);
  const displayLineup = useMemo(() => {
    const base = xiPlan?.lineup ?? picked;
    const cap = capPlan?.lineup.captain.id ?? picked.captain.id;
    const vice = capPlan?.lineup.vice.id ?? picked.vice.id;
    return withCaptain(base, cap, vice);
  }, [xiPlan, capPlan, picked]);
  const displaySquad = xiPlan
    ? xiPlan.lineup.xi.concat(xiPlan.lineup.bench)
    : squad;
  const selectedChips = useMemo(
    () =>
      chipAdvice({
        eventId: gameweekId,
        plays: chipPlays,
        lineup: selectedPlan.lineup,
        squad: selectedPlan.lineup.xi.concat(selectedPlan.lineup.bench),
        bestPlan,
        holdPlan,
        activeChip,
      }),
    [gameweekId, chipPlays, selectedPlan, bestPlan, holdPlan, activeChip],
  );
  const displayChips = useMemo(
    () =>
      chipAdvice({
        eventId: gameweekId,
        plays: chipPlays,
        lineup: displayLineup,
        squad: displaySquad,
        bestPlan,
        holdPlan,
        activeChip,
      }),
    [gameweekId, chipPlays, displayLineup, displaySquad, bestPlan, holdPlan, activeChip],
  );

  useEffect(() => {
    rememberTeamId(entryId);
    app.hydrateTeam({
      id: entryId,
      name: teamName,
      clubIds: squad.map((p) => p.teamId),
      playerIds: squad.map((p) => p.id),
      formation: picked.formation,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, teamName, picked.formation]);

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

  const chipPulse =
    (appliedChip
      ? displayChips.find((c) => c.chip === appliedChip)
      : null) ??
    (appliedXiKey || appliedArmbandKey ? displayChips : chips).find((c) => c.recommend) ??
    chips.find((c) => c.urgency !== "none");

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
          <button type="button" className="text-left hover:text-accent" onClick={() => go("xi")}>
            <IconLabel icon={LayoutGrid} size="xs">
              {displayLineup.formation}
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
        className="sticky top-14 z-20 -mx-3 grid grid-cols-3 gap-1 border-y border-line bg-background/90 px-3 py-2 backdrop-blur-md sm:top-16 sm:mx-0 sm:rounded-xl sm:border sm:px-2"
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
          formations={[{ formation: displayLineup.formation, xp: displayLineup.xp }]}
          entryId={entryId}
          teamName={teamName}
          squad={squad}
          madeMoves={madeMoves}
          captainId={captainId}
          viceId={viceId}
          gameweekId={gameweekId}
          selectedKey={selectedKey}
          onSelectPlan={setSelectedKey}
        />
      ) : null}

      {tab === "xi" ? (
        <div className="space-y-2">
          <WeekPlanApply
            options={options}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            appliedXi={appliedXiKey === selectedKey}
            appliedArmband={appliedArmbandKey === selectedKey}
            appliedChip={appliedChip}
            onApplyXi={() =>
              setAppliedXiKey((key) => (key === selectedKey ? null : selectedKey))
            }
            onApplyArmband={() =>
              setAppliedArmbandKey((key) => (key === selectedKey ? null : selectedKey))
            }
            onApplyChip={(chip) =>
              setAppliedChip((current) => (current === chip ? null : chip))
            }
            selectedChips={selectedChips}
          />
          {picksLive || appliedXiKey ? null : (
            <p className="text-[11px] leading-5 text-muted">
              FPL has not published this {abbr("gw")} team yet. Apply a plan to preview this{" "}
              {abbr("gw")} {abbr("xi")}.
            </p>
          )}
          <Pitch
            xi={displayLineup.xi}
            bench={displayLineup.bench}
            captainId={displayLineup.captain.id}
            viceId={displayLineup.vice.id}
            gameweek={gameweekId}
            formation={displayLineup.formation}
          />
        </div>
      ) : null}

      {tab === "chips" ? (
        <div className="space-y-2">
          <WeekPlanApply
            options={options}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            appliedXi={appliedXiKey === selectedKey}
            appliedArmband={appliedArmbandKey === selectedKey}
            appliedChip={appliedChip}
            onApplyXi={() =>
              setAppliedXiKey((key) => (key === selectedKey ? null : selectedKey))
            }
            onApplyArmband={() =>
              setAppliedArmbandKey((key) => (key === selectedKey ? null : selectedKey))
            }
            onApplyChip={(chip) =>
              setAppliedChip((current) => (current === chip ? null : chip))
            }
            selectedChips={selectedChips}
          />
          <ChipPanel
            chips={appliedXiKey || appliedArmbandKey || appliedChip ? displayChips : chips}
            appliedChip={appliedChip}
          />
        </div>
      ) : null}
    </div>
  );
}
