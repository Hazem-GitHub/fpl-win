"use client";

import { useAppState } from "@/components/AppState";
import { Jump } from "@/components/Jump";
import { Icon } from "./Icon";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import { PlayerProfile } from "@/components/PlayerProfile";
import {
  playersHref,
} from "@/lib/app-href";
import { Abbr } from "@/components/Abbr";
import { ABBR, abbr } from "@/lib/abbr";
import { formatPrice, formatXp, xpGradeClass } from "@/lib/format";
import type { TransferMove, TransferPlan } from "@/lib/optimize/transfers";
import type { RankedPlayer } from "@/lib/xp/model";
import { horizonXp, pickAlts, planKey, planMovesLabel } from "@/lib/week-plan";
import {
  BarChart3,
  Check,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";

function fixtureChip(player: RankedPlayer) {
  const fx = player.fixtures[0];
  if (!fx) return { text: "Blank", className: "bg-panel-2 text-muted" };
  const text = `${fx.opponentShort} ${fx.home ? "(H)" : "(A)"}`;
  const className =
    fx.fdr >= 4
      ? "bg-danger/15 text-danger"
      : fx.fdr <= 2
        ? "bg-accent/15 text-accent"
        : "bg-panel-2 text-muted";
  return { text, className, title: `${abbr("fdr")} ${fx.fdr}` };
}

function signedPrice(tenths: number): string {
  const mag = formatPrice(Math.abs(tenths));
  if (tenths > 0) return `+${mag}`;
  if (tenths < 0) return `−${mag}`;
  return mag;
}

function signedXp(value: number): string {
  if (value > 0) return `+${formatXp(value)}`;
  return formatXp(value);
}

function swapKey(move: TransferMove): string {
  return `${move.out.id}:${move.inn.id}`;
}

const WEEK_PLAN_KEY = "fpl-win-week-plan";

function mergeMoves(...lists: TransferMove[][]): TransferMove[] {
  const seen = new Set<string>();
  const rows: TransferMove[] = [];
  for (const list of lists) {
    for (const move of list) {
      const key = swapKey(move);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(move);
    }
  }
  return rows;
}

function readWeekPlan(entryId: number, gameweekId: number): TransferMove[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WEEK_PLAN_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      entryId?: number;
      gw?: number;
      moves?: TransferMove[];
    };
    if (parsed.entryId !== entryId || parsed.gw !== gameweekId) return [];
    return Array.isArray(parsed.moves) ? parsed.moves : [];
  } catch {
    return [];
  }
}

function writeWeekPlan(
  entryId: number,
  gameweekId: number,
  moves: TransferMove[],
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      WEEK_PLAN_KEY,
      JSON.stringify({ entryId, gw: gameweekId, moves }),
    );
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function DoneBadge({ children = "Done on FPL" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
      <Icon icon={Check} size="xs" className="text-accent" />
      {children}
    </span>
  );
}

function planPitch(
  plan: TransferPlan,
  best: TransferPlan,
  freeTransfers: number,
): { tag: string; why: string } {
  const delta = plan.netXp - best.netXp;
  const vs = `${signedXp(delta)} vs recommended`;
  const hDelta = horizonXp(plan) - horizonXp(best);
  const isBest = planKey(plan) === planKey(best);

  if (isBest) {
    if (plan.moves.length === 0) {
      return {
        tag: "Recommended",
        why: "Holding is the strongest play this week.",
      };
    }
    if (plan.hits > 0) {
      return {
        tag: "Recommended",
        why: `Best week on the board even after −${plan.hitCost}.`,
      };
    }
    return {
      tag: "Recommended",
      why: `Highest ${abbr("netXp")} after free transfers.`,
    };
  }

  if (plan.moves.length === 0) {
    return {
      tag: "Hold",
      why: `Bank ${freeTransfers} ${abbr("ft")} for next week. ${vs}. Use this if you are waiting on team news.`,
    };
  }

  if (plan.hits === 0 && best.hits > 0) {
    return {
      tag: "No hit",
      why: `Stay inside free transfers and skip the −${best.hitCost}. ${vs}.`,
    };
  }

  if (Math.abs(delta) < 0.2 && plan.hits === best.hits) {
    const bestOuts = new Set(best.moves.map((m) => m.out.id));
    const bestIns = new Set(best.moves.map((m) => m.inn.id));
    const otherOuts = plan.moves.filter((m) => !bestOuts.has(m.out.id));
    const otherIns = plan.moves.filter((m) => !bestIns.has(m.inn.id));
    if (otherOuts.length || otherIns.length) {
      const bits = [
        otherOuts.length
          ? `sell ${otherOuts.map((m) => m.out.webName).join(" & ")} instead`
          : null,
        otherIns.length
          ? `buy ${otherIns.map((m) => m.inn.webName).join(" & ")} instead`
          : null,
      ].filter(Boolean);
      return {
        tag: "Same week",
        why: `Matches recommended ${abbr("netXp")}. ${bits.join("; ")}.`,
      };
    }
  }

  if (hDelta >= 1 && delta < 0) {
    return {
      tag: "Longer run",
      why: `${signedXp(hDelta)} over 5 ${abbr("gw")} even though this week is ${vs}.`,
    };
  }

  if (plan.bank >= best.bank + 15) {
    return {
      tag: "Keep cash",
      why: `Leaves ${formatPrice(plan.bank)} in the bank (${signedPrice(plan.bank - best.bank)} vs recommended). ${vs}.`,
    };
  }

  if (plan.ftAfter > best.ftAfter) {
    return {
      tag: "Bank a FT",
      why: `${plan.ftAfter} ${abbr("ft")} next week vs ${best.ftAfter}. ${vs}.`,
    };
  }

  if (plan.hits < best.hits) {
    return {
      tag: "Smaller hit",
      why: `−${plan.hitCost} instead of −${best.hitCost}. ${vs}.`,
    };
  }

  return {
    tag: plan.moves.length === 1 ? "One transfer" : `${plan.moves.length} transfers`,
    why: `${vs} · ${formatXp(plan.netXp)} ${abbr("netXp")}.`,
  };
}

function flagNote(player: RankedPlayer): string | null {
  if (player.status === "a") return null;
  if (player.news.trim()) return player.news.replace(/\.$/, "");
  if (player.status === "i") return "injured";
  if (player.status === "d") return "doubtful";
  if (player.status === "s") return "suspended";
  if (player.status === "u") return "unavailable";
  return "flagged";
}

function whyTransfer(move: TransferMove): string {
  const { out, inn } = move;
  const gw = inn.xpThis - out.xpThis;
  const horizon = inn.xpNext5 - out.xpNext5;
  const outFlag = flagNote(out);
  const inFlag = flagNote(inn);
  const inFdr = inn.fdrThis ?? 3;
  const outFdr = out.fdrThis ?? 3;
  const outMins = Math.round(out.pMinutes * 100);

  if (outFlag && !inFlag) {
    return `Move ${out.webName} out (${outFlag}) for a fit ${inn.webName}.`;
  }
  if (out.pMinutes < 0.45 && inn.pMinutes >= 0.7 && gw > 0) {
    return `${out.webName} is not starting (${outMins}% mins). ${inn.webName} is, and is ${signedXp(gw)} ${abbr("xp")} this ${abbr("gw")}.`;
  }
  if (gw >= 2) {
    return `${inn.webName} is ${signedXp(gw)} ${abbr("xp")} better this week than ${out.webName}.`;
  }
  if (horizon >= 5 && horizon > gw + 1) {
    return `${inn.webName} is the 5-${abbr("gw")} pick (${signedXp(horizon)}) — this ${abbr("gw")} is secondary.`;
  }
  if (inFdr <= 2 && outFdr >= 4) {
    return `Swap a hard ${out.webName} fixture for ${inn.webName}'s easier match.`;
  }
  if (gw > 0) {
    return `Upgrade ${out.webName} to ${inn.webName} for ${signedXp(gw)} ${abbr("xp")} this week.`;
  }
  return `Take ${inn.webName} over ${out.webName} for the run, not this ${abbr("gw")}.`;
}

function MiniCard({
  player,
  tone,
  badge,
  delayMs,
  onOpen,
  priceTenths,
}: {
  player: RankedPlayer;
  tone: "out" | "in" | "cap";
  badge?: string;
  delayMs?: number;
  onOpen: (player: RankedPlayer) => void;
  priceTenths?: number;
}) {
  const fx = fixtureChip(player);
  const ring =
    tone === "in"
      ? "ring-accent/55"
      : tone === "out"
        ? "ring-danger/40"
        : "ring-warn/50";
  const anim =
    tone === "out" ? "week-card-out" : tone === "in" ? "week-card-in" : "week-card-cap";
  const stamp =
    tone === "out" ? "OUT" : tone === "in" ? "IN" : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(player)}
      className={`week-mini group w-[6.6rem] shrink-0 text-left sm:w-[7.2rem] ${anim}`}
      style={{ "--swap-delay": `${delayMs ?? 0}ms` } as CSSProperties}
      aria-label={`${player.webName}, ${formatXp(player.xpThis)} ${abbr("xp")}, ${fx.text}`}
    >
      <div className="relative mx-auto w-fit">
        <div
          className={`week-mini-shot relative overflow-hidden rounded-md ring-1 ${ring} transition duration-150 group-hover:scale-105 group-focus-visible:scale-105 ${
            tone === "in" ? "week-in-burst" : ""
          }`}
        >
          <PlayerPhoto
            key={player.id}
            player={player}
            className={`h-[4.6rem] w-[3.55rem] object-cover sm:h-[5.1rem] sm:w-[3.9rem] ${
              tone === "out" ? "week-photo-out" : tone === "in" ? "week-photo-in" : ""
            }`}
          />
          {stamp ? (
            <span
              className={`week-stamp pointer-events-none absolute left-1/2 top-1.5 -translate-x-1/2 rounded px-1.5 py-px text-[9px] font-black tracking-widest ${
                tone === "out"
                  ? "bg-danger text-white"
                  : "bg-accent text-on-accent"
              }`}
            >
              {stamp}
            </span>
          ) : null}
        </div>
        {badge ? (
          <span
            title={badge === "V" ? ABBR.vice.long : ABBR.cap.long}
            className={`absolute -right-1.5 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
              badge === "V"
                ? "bg-white/90 text-zinc-900"
                : "bg-warn text-background"
            }`}
          >
            {badge}
          </span>
        ) : null}
      </div>

      <div className={`week-mini-plate mt-1.5 overflow-hidden rounded-md text-center shadow-sm ring-1 ${ring}`}>
        <p className={`tabular px-1 pt-1 text-[11px] font-bold leading-none ${xpGradeClass(player.xpThis)}`}>
          {formatXp(player.xpThis)}
        </p>
        <p className="truncate px-1 pt-1 text-[12px] font-semibold leading-tight text-foreground group-hover:text-mint" suppressHydrationWarning>
          {player.webName}
        </p>
        {priceTenths != null ? (
          <p className="tabular px-1 text-[11px] font-bold leading-none text-foreground">
            {formatPrice(priceTenths)}
          </p>
        ) : null}
        <p
          className={`mx-1 mb-1 mt-1 inline-block rounded px-1 py-px text-[10px] ${fx.className}`}
          title={fx.title}
        >
          {fx.text}
        </p>
      </div>
    </button>
  );
}

function TransferArrow({
  xpDelta,
  bankDelta,
  delayMs,
}: {
  xpDelta: number;
  bankDelta: number;
  delayMs: number;
}) {
  const up = xpDelta >= 0;
  return (
    <div
      className="week-swap-mid relative flex w-20 shrink-0 flex-col items-center justify-center"
      style={{ "--swap-delay": `${delayMs}ms` } as CSSProperties}
    >
      <div className="week-swap-rail" aria-hidden>
        <span className="week-swap-rail-glow" />
        <span className="week-swap-packet" />
        <span className="week-swap-chevrons">››››</span>
      </div>
      <span
        className={`week-swap-xp mt-2 rounded-full px-1.5 py-0.5 tabular text-[11px] font-bold ${
          up ? "bg-accent/15 text-accent" : "bg-danger/15 text-danger"
        }`}
      >
        {signedXp(xpDelta)}
      </span>
      <span
        className={`mt-0.5 tabular text-[10px] font-semibold ${
          bankDelta >= 0 ? "text-accent" : "text-danger"
        }`}
      >
        {signedPrice(bankDelta)}
      </span>
    </div>
  );
}

function TransferRow({
  move,
  done,
  delay,
  onOpen,
}: {
  move: TransferMove;
  done?: boolean;
  delay: number;
  onOpen: (player: RankedPlayer) => void;
}) {
  const why = whyTransfer(move);
  const bankDelta = -move.net;
  const gwDelta = move.inn.xpThis - move.out.xpThis;
  return (
    <div
      className={`week-swap-row rounded-lg border px-3 py-3 ${
        done
          ? "border-accent/45 bg-accent/8"
          : "border-line bg-panel-2/60"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <MiniCard
          player={move.out}
          tone="out"
          delayMs={delay}
          onOpen={onOpen}
          priceTenths={move.sell}
        />
        <TransferArrow
          xpDelta={gwDelta}
          bankDelta={bankDelta}
          delayMs={delay + 180}
        />
        <MiniCard
          player={move.inn}
          tone="in"
          delayMs={delay + 320}
          onOpen={onOpen}
          priceTenths={move.buy}
        />
        <div className="min-w-40 flex-1 text-sm leading-5">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {why}
            {done ? <DoneBadge /> : null}
          </p>
        </div>
      </div>
    </div>
  );
}

export function WeekDecision({
  gameweekName,
  deadline,
  freeTransfers,
  bestPlan,
  holdPlan,
  plans,
  formations,
  entryId,
  teamName,
  squad,
  madeMoves,
  captainId,
  viceId,
  gameweekId,
  selectedKey,
  onSelectPlan,
}: {
  gameweekName: string;
  deadline: string | null;
  freeTransfers: number;
  bestPlan: TransferPlan;
  holdPlan: TransferPlan;
  plans?: TransferPlan[];
  formations?: { formation: string; xp: number }[];
  entryId?: number;
  teamName?: string;
  squad?: RankedPlayer[];
  madeMoves?: TransferMove[];
  captainId?: number | null;
  viceId?: number | null;
  gameweekId?: number;
  selectedKey?: string;
  onSelectPlan?: (key: string) => void;
}) {
  const app = useAppState();
  const [open, setOpen] = useState<RankedPlayer | null>(null);
  const recommendedKey = planKey(bestPlan);
  const [internalKey, setInternalKey] = useState(recommendedKey);
  const activeKey = selectedKey ?? internalKey;
  function setActiveKey(key: string) {
    onSelectPlan?.(key);
    if (selectedKey === undefined) setInternalKey(key);
  }
  const alts = useMemo(
    () => pickAlts(plans ?? [], bestPlan, holdPlan),
    [plans, bestPlan, holdPlan],
  );
  const options = useMemo(() => [bestPlan, ...alts], [bestPlan, alts]);
  const plan = options.find((row) => planKey(row) === activeKey) ?? bestPlan;
  const showingAlt = planKey(plan) !== recommendedKey;
  const gain = plan.netXp - holdPlan.netXp;
  const used = plan.moves.length;
  const ftUsed = Math.min(used, freeTransfers);
  const hold = plan.moves.length === 0;
  const captain = plan.lineup.captain;
  const vice = plan.lineup.vice;
  const squadIds = useMemo(
    () => new Set((squad ?? []).map((player) => player.id)),
    [squad],
  );
  const made = madeMoves ?? [];
  const madeKeys = useMemo(
    () => new Set(made.map(swapKey)),
    [made],
  );
  const [remembered, setRemembered] = useState<TransferMove[]>([]);
  useEffect(() => {
    if (!entryId || !gameweekId) return;
    const stored = readWeekPlan(entryId, gameweekId);
    const merged = mergeMoves(stored, made, bestPlan.moves);
    writeWeekPlan(entryId, gameweekId, merged);
    setRemembered(merged);
  }, [entryId, gameweekId, made, bestPlan.moves]);
  const liveDone = (move: TransferMove) =>
    squadIds.has(move.inn.id) && !squadIds.has(move.out.id);
  const pendingMoves = plan.moves.filter((move) => {
    if (madeKeys.has(swapKey(move))) return false;
    return !liveDone(move);
  });
  const doneMoves = useMemo(() => {
    return mergeMoves(
      made,
      plan.moves.filter(liveDone),
      remembered.filter((move) => madeKeys.has(swapKey(move)) || liveDone(move)),
    );
  }, [made, madeKeys, plan.moves, remembered, squadIds]);
  const transfersDone = pendingMoves.length === 0 && doneMoves.length > 0;
  const captainDone = captainId === captain.id;
  const viceDone = viceId === vice.id;
  const runnerUp = formations?.find(
    (row) => row.formation !== plan.lineup.formation,
  );

  useEffect(() => {
    setActiveKey(planKey(bestPlan));
  }, [recommendedKey, entryId]);

  useEffect(() => {
    if (!entryId) return;
    const planned = plan.lineup.xi.concat(plan.lineup.bench);
    const owned = squad ?? planned;
    app.hydrateTeam({
      id: entryId,
      name: teamName,
      clubIds: owned.map((p) => p.teamId),
      playerIds: owned.map((p) => p.id),
      formation: plan.lineup.formation,
    });
    // Seed shared session when the loaded squad or chosen plan changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, teamName, plan.lineup.formation, activeKey]);

  return (
    <section className="overflow-hidden rounded-2xl border border-accent/35 bg-panel">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-3 py-2.5 sm:px-4">
        <div>
          <h2 className="text-sm font-semibold">
            This week · {gameweekName}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {deadline ? `Deadline ${deadline}` : "No deadline posted"}
            {` · ${plan.lineup.formation} ${abbr("xi")}`}
            {runnerUp && !showingAlt
              ? ` · +${formatXp(plan.lineup.xp - runnerUp.xp)} vs ${runnerUp.formation}`
              : ""}
            {showingAlt ? " · alternative" : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-muted">
            {hold ? "Hold" : plan.hits > 0 ? `Hit −${plan.hitCost}` : "Free transfer"}
          </p>
          <p className="tabular text-xl font-semibold leading-tight text-accent">
            {formatXp(plan.netXp)}
            <span className="ml-1 text-xs font-medium text-muted">
              <Abbr of="netXp" />
            </span>
          </p>
          {hold ? (
            <p className="text-[11px] text-muted">
              {showingAlt ? `${signedXp(plan.netXp - bestPlan.netXp)} vs recommended` : "A hit is not worth it"}
            </p>
          ) : Math.abs(gain) >= 0.15 ? (
            <p
              className={`tabular text-[11px] ${gain >= 0 ? "text-accent" : "text-danger"}`}
            >
              {signedXp(gain)} vs hold
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-px border-b border-line bg-line sm:grid-cols-4">
        <Stat label={<Abbr of="xiXp" />} value={formatXp(plan.rawXp)} />
        <Stat
          label={<Abbr of="ft" />}
          value={hold ? `Bank ${freeTransfers}` : `${ftUsed}/${freeTransfers} used`}
        />
        <Stat
          label="Hits"
          value={plan.hits ? `−${plan.hitCost}` : "None"}
          danger={plan.hits > 0}
        />
        <Stat label="Bank after" value={formatPrice(plan.bank)} />
      </div>

      {options.length > 1 ? (
        <div className="border-b border-line px-3 py-3 sm:px-4">
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted">
            This week&apos;s options
          </p>
          <div
            className="grid gap-2 sm:grid-cols-2"
            role="listbox"
            aria-label="This week's transfer plans"
          >
            {options.map((option) => {
              const key = planKey(option);
              const selected = key === planKey(plan);
              const pitch = planPitch(option, bestPlan, freeTransfers);
              const vsBest = option.netXp - bestPlan.netXp;
              return (
                <button
                  key={key}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => setActiveKey(key)}
                  className={`rounded-xl border p-3 text-left transition ${
                    selected
                      ? "border-accent/60 bg-accent/10 shadow-[0_0_0_1px_var(--accent)]"
                      : "border-line bg-panel-2/40 hover:border-accent/30 hover:bg-panel-2"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${
                        pitch.tag === "Recommended"
                          ? "bg-accent text-on-accent"
                          : "bg-panel-2 text-muted"
                      }`}
                    >
                      {pitch.tag}
                    </span>
                    <span className="tabular shrink-0 text-sm font-semibold">
                      {formatXp(option.netXp)}
                      <span className="ml-1 text-[10px] font-medium text-muted">
                        {abbr("netXp")}
                      </span>
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium leading-5">
                    {planMovesLabel(option)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted">{pitch.why}</p>
                  <p className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted">
                    {option.hits > 0 ? (
                      <span className="text-danger">−{option.hitCost} hit</span>
                    ) : (
                      <span>No hit</span>
                    )}
                    <span>{formatPrice(option.bank)} bank</span>
                    <span>
                      {option.ftAfter} {abbr("ft")} next
                    </span>
                    {pitch.tag !== "Recommended" && Math.abs(vsBest) >= 0.15 ? (
                      <span className={vsBest >= 0 ? "text-accent" : ""}>
                        {signedXp(vsBest)}
                      </span>
                    ) : null}
                  </p>
                </button>
              );
            })}
          </div>
          {showingAlt ? (
            <p className="mt-2 text-[11px] text-muted">
              Showing this plan below.{" "}
              <button
                type="button"
                className="font-medium text-accent"
                onClick={() => setActiveKey(recommendedKey)}
              >
                Back to recommended
              </button>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-4 p-3 sm:p-4">
        {hold && doneMoves.length === 0 ? (
          <p className="text-sm leading-6 text-foreground/90">
            Hold.{" "}
            <strong className="tabular text-accent">{formatXp(plan.rawXp)}</strong>{" "}
            {abbr("xp")} projected
            {showingAlt
              ? ` · ${signedXp(plan.netXp - bestPlan.netXp)} vs recommended.`
              : "."}
          </p>
        ) : (
          <div className="space-y-4">
            <h3 className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
              Transfers{showingAlt ? " · this option" : ""}
              {transfersDone ? <DoneBadge /> : null}
            </h3>
            {doneMoves.map((move, i) => (
              <TransferRow
                key={`done-${swapKey(move)}`}
                move={move}
                done
                delay={i * 180}
                onOpen={(player) => {
                  setOpen(player);
                  app.setFocusPlayer(player.id);
                }}
              />
            ))}
            {pendingMoves.map((move, i) => (
              <TransferRow
                key={`pending-${swapKey(move)}`}
                move={move}
                delay={(doneMoves.length + i) * 180}
                onOpen={(player) => {
                  setOpen(player);
                  app.setFocusPlayer(player.id);
                }}
              />
            ))}
            {hold && doneMoves.length > 0 ? (
              <p className="text-sm leading-6 text-foreground/90">
                No further transfers.{" "}
                <strong className="tabular text-accent">{formatXp(plan.rawXp)}</strong>{" "}
                {abbr("xp")} projected
                {showingAlt
                  ? ` · ${signedXp(plan.netXp - bestPlan.netXp)} vs recommended.`
                  : "."}
              </p>
            ) : null}
          </div>
        )}

        <div>
          <h3 className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
            Captain
            {captainDone ? <DoneBadge>Set on FPL</DoneBadge> : null}
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <MiniCard
              player={captain}
              tone="cap"
              badge="C"
              delayMs={80}
              onOpen={(player) => {
                setOpen(player);
                app.setFocusPlayer(player.id);
              }}
            />
            <MiniCard
              player={vice}
              tone="cap"
              badge="V"
              delayMs={160}
              onOpen={(player) => {
                setOpen(player);
                app.setFocusPlayer(player.id);
              }}
            />
            <div className="min-w-40 text-sm leading-6">
              <p>
                Doubles to{" "}
                <span className={`tabular font-semibold ${xpGradeClass(captain.xpThis * 2)}`}>
                  {formatXp(captain.xpThis * 2)}
                </span>
                {captainDone ? null : " · set this as C"}
              </p>
              <p className="text-xs text-muted">
                Vice {vice.webName}
                {viceDone ? " · set" : ""}
                {captain.news ? ` · ${captain.news}` : ""}
              </p>
              <div className="mt-2">
                <Jump
                  href={playersHref({
                    view: "captain",
                    player: captain.id,
                    pos: captain.position,
                  })}
                  icon={BarChart3}
                  onClick={() =>
                    app.setRankings({
                      view: "captain",
                      pos: captain.position,
                      playerId: captain.id,
                      q: captain.webName,
                    })
                  }
                >
                  Compare captains
                </Jump>
              </div>
            </div>
          </div>
        </div>
      </div>

      {open ? <PlayerProfile player={open} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}

function Stat({
  label,
  value,
  danger,
}: {
  label: ReactNode;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="bg-panel px-4 py-2">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted">
        {label}
      </p>
      <p className={`tabular text-sm font-semibold ${danger ? "text-danger" : ""}`}>
        {value}
      </p>
    </div>
  );
}
