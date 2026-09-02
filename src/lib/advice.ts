import {
  fetchEntry,
  fetchEntryHistory,
  fetchEntryTransfers,
  fetchPicks,
  fetchPicksWithFallback,
} from "@/lib/fpl/client";
import type { FplChipName, FplChipPlay, FplPick, FplTransfer } from "@/lib/fpl/types";
import { MAX_FREE_TRANSFERS, sellPrice } from "@/lib/fpl/rules";
import { chipAdvice, type ChipAdvice } from "@/lib/optimize/chips";
import {
  adviseTransfers,
  inferFreeTransfers,
  type OwnedPlayer,
  type TransferMove,
  type TransferPlan,
} from "@/lib/optimize/transfers";
import { lineupFromPicks, bestLineup, type LineupResult } from "@/lib/optimize/lineup";
import type { EngineSnapshot } from "@/lib/snapshot";
import type { RankedPlayer } from "@/lib/xp/model";

export type TeamPulse = {
  points: number;
  lastGwPoints: number | null;
  lastGwEvent: number | null;
  rank: number | null;
  previousRank: number | null;
  managers: number;
  squadValue: number;
  lastSquadValue: number | null;
  bank: number;
  bankAfter: number;
  freeTransfers: number;
  maxFt: number;
  planMoves: number;
  planHits: number;
  planHitCost: number;
  ftAfter: number;
};

export type TeamAdvice = {
  entryId: number;
  teamName: string;
  manager: string;
  overallPoints: number;
  overallRank: number | null;
  bank: number;
  teamValue: number;
  freeTransfers: number;
  pulse: TeamPulse;
  squad: RankedPlayer[];
  sellingPrices: Record<number, number>;
  captainId: number | null;
  viceId: number | null;
  madeMoves: TransferMove[];
  plans: TransferPlan[];
  bestPlan: TransferPlan;
  holdPlan: TransferPlan;
  picked: LineupResult;
  picksLive: boolean;
  chips: ChipAdvice[];
  chipPlays: FplChipPlay[];
  activeChip: FplChipName | null;
};

function ownedFromPicks(
  picks: FplPick[],
  byId: Map<number, RankedPlayer>,
): OwnedPlayer[] {
  return picks
    .map((pick) => {
      const player = byId.get(pick.element);
      if (!player) return null;
      const purchase = pick.purchase_price ?? player.cost;
      const selling = pick.selling_price ?? sellPrice(purchase, player.cost);
      return { player, sellingPrice: selling, purchasePrice: purchase };
    })
    .filter((row): row is OwnedPlayer => row != null);
}

function applyTransfers(
  owned: OwnedPlayer[],
  transfers: FplTransfer[],
  byId: Map<number, RankedPlayer>,
): OwnedPlayer[] {
  let next = [...owned];
  for (const transfer of transfers) {
    next = next.filter((row) => row.player.id !== transfer.element_out);
    const player = byId.get(transfer.element_in);
    if (!player) continue;
    next.push({
      player,
      purchasePrice: transfer.element_in_cost,
      sellingPrice: sellPrice(transfer.element_in_cost, player.cost),
    });
  }
  return next;
}

function transferReflected(owned: OwnedPlayer[], transfer: FplTransfer): boolean {
  const ids = new Set(owned.map((row) => row.player.id));
  return !ids.has(transfer.element_out) && ids.has(transfer.element_in);
}

function applyOutstandingTransfers(
  owned: OwnedPlayer[],
  transfers: FplTransfer[],
  byId: Map<number, RankedPlayer>,
): { owned: OwnedPlayer[]; applied: FplTransfer[] } {
  let next = owned;
  const applied: FplTransfer[] = [];
  for (const transfer of transfers) {
    if (transferReflected(next, transfer)) continue;
    next = applyTransfers(next, [transfer], byId);
    applied.push(transfer);
  }
  return { owned: next, applied };
}

function bankAfterTransfers(bank: number, transfers: FplTransfer[]): number {
  return transfers.reduce(
    (sum, transfer) =>
      sum + transfer.element_out_cost - transfer.element_in_cost,
    bank,
  );
}

function inferTransfersFromPicks(
  prev: FplPick[],
  curr: FplPick[],
  byId: Map<number, RankedPlayer>,
  entryId: number,
  event: number,
): FplTransfer[] {
  const currIds = new Set(curr.map((pick) => pick.element));
  const prevIds = new Set(prev.map((pick) => pick.element));
  const outs = prev.filter((pick) => !currIds.has(pick.element));
  const inns = curr.filter((pick) => !prevIds.has(pick.element));
  const outByPos = new Map<number, FplPick[]>();
  const inByPos = new Map<number, FplPick[]>();
  for (const pick of outs) {
    const pos = byId.get(pick.element)?.position;
    if (pos == null) continue;
    const list = outByPos.get(pos) ?? [];
    list.push(pick);
    outByPos.set(pos, list);
  }
  for (const pick of inns) {
    const pos = byId.get(pick.element)?.position;
    if (pos == null) continue;
    const list = inByPos.get(pos) ?? [];
    list.push(pick);
    inByPos.set(pos, list);
  }
  const inferred: FplTransfer[] = [];
  for (const [pos, leaving] of outByPos) {
    const arriving = [...(inByPos.get(pos) ?? [])];
    arriving.sort((a, b) => (a.purchase_price ?? 0) - (b.purchase_price ?? 0));
    const sortedOut = [...leaving].sort(
      (a, b) => (a.selling_price ?? 0) - (b.selling_price ?? 0),
    );
    const n = Math.min(sortedOut.length, arriving.length);
    for (let i = 0; i < n; i++) {
      const out = sortedOut[i];
      const inn = arriving[i];
      inferred.push({
        element_in: inn.element,
        element_in_cost:
          inn.purchase_price ?? byId.get(inn.element)?.cost ?? 0,
        element_out: out.element,
        element_out_cost: out.selling_price ?? 0,
        entry: entryId,
        event,
        time: "",
      });
    }
  }
  return inferred;
}

function applyTransfersToPicks(
  picks: FplPick[],
  transfers: FplTransfer[],
): FplPick[] {
  const next = picks.map((pick) => ({ ...pick }));
  const ids = new Set(next.map((pick) => pick.element));
  for (const transfer of transfers) {
    const idx = next.findIndex((pick) => pick.element === transfer.element_out);
    if (idx >= 0) {
      const slot = next[idx];
      next[idx] = {
        ...slot,
        element: transfer.element_in,
        is_captain: false,
        is_vice_captain: false,
        multiplier: slot.position <= 11 ? 1 : 0,
        purchase_price: transfer.element_in_cost,
      };
      ids.delete(transfer.element_out);
      ids.add(transfer.element_in);
      continue;
    }
    if (ids.has(transfer.element_in)) continue;
    const benchPos = Math.max(11, ...next.map((pick) => pick.position)) + 1;
    next.push({
      element: transfer.element_in,
      position: benchPos,
      multiplier: 0,
      is_captain: false,
      is_vice_captain: false,
      purchase_price: transfer.element_in_cost,
    });
    ids.add(transfer.element_in);
  }
  return next;
}

function pickCaptain(picks: FplPick[], ownedIds: Set<number>): number | null {
  const cap = picks.find((p) => p.is_captain && ownedIds.has(p.element));
  if (cap) return cap.element;
  const vice = picks.find((p) => p.is_vice_captain && ownedIds.has(p.element));
  return vice?.element ?? null;
}

function pickVice(
  picks: FplPick[],
  ownedIds: Set<number>,
  captainId: number | null,
): number | null {
  const vice = picks.find(
    (p) => p.is_vice_captain && ownedIds.has(p.element) && p.element !== captainId,
  );
  return vice?.element ?? null;
}

function toMadeMoves(
  transfers: FplTransfer[],
  byId: Map<number, RankedPlayer>,
): TransferMove[] {
  const moves: TransferMove[] = [];
  for (const transfer of transfers) {
    const out = byId.get(transfer.element_out);
    const inn = byId.get(transfer.element_in);
    if (!out || !inn) continue;
    moves.push({
      out,
      inn,
      sell: transfer.element_out_cost,
      buy: transfer.element_in_cost,
      net: transfer.element_in_cost - transfer.element_out_cost,
    });
  }
  return moves;
}

export async function adviseTeam(
  entryId: number,
  snapshot: EngineSnapshot,
): Promise<TeamAdvice> {
  const upcomingId = snapshot.upcoming.id;
  const [entry, history, loaded, transfers] = await Promise.all([
    fetchEntry(entryId),
    fetchEntryHistory(entryId),
    fetchPicksWithFallback(entryId, upcomingId),
    fetchEntryTransfers(entryId).catch(() => [] as FplTransfer[]),
  ]);
  const byId = new Map(snapshot.players.map((p) => [p.id, p]));
  let weekTransfers = transfers
    .filter((row) => row.event === upcomingId || row.event > loaded.eventId)
    .sort((a, b) => a.time.localeCompare(b.time));

  let owned = ownedFromPicks(loaded.picks.picks, byId);
  let bank = loaded.picks.entry_history?.bank ?? entry.last_deadline_bank ?? 0;
  const thisWeekPicks = loaded.eventId === upcomingId;
  let previousPicks: FplPick[] | null = null;
  if (thisWeekPicks && upcomingId > 1) {
    try {
      previousPicks = (await fetchPicks(entryId, upcomingId - 1)).picks;
    } catch {
      previousPicks = null;
    }
  }
  if (weekTransfers.length === 0 && previousPicks) {
    weekTransfers = inferTransfersFromPicks(
      previousPicks,
      loaded.picks.picks,
      byId,
      entryId,
      upcomingId,
    );
  }
  const synced = applyOutstandingTransfers(owned, weekTransfers, byId);
  owned = synced.owned;
  bank = bankAfterTransfers(bank, synced.applied);

  const ftBefore = inferFreeTransfers(history.current, upcomingId);
  const freeTransfers = Math.max(0, ftBefore - weekTransfers.length);
  const plans = adviseTransfers({
    players: snapshot.players,
    owned,
    bank,
    freeTransfers,
  });
  const holdPlan = plans.find((p) => p.moves.length === 0) ?? plans[0];
  const bestPlan = plans[0] ?? holdPlan;
  const squad = owned.map((o) => o.player);
  const ownedIds = new Set(owned.map((row) => row.player.id));
  const displayPicks = thisWeekPicks
    ? loaded.picks.picks
    : applyTransfersToPicks(loaded.picks.picks, synced.applied);
  const picked =
    lineupFromPicks(displayPicks, squad) ??
    plans.find((p) => p.moves.length === 0)?.lineup ??
    bestLineup(squad);
  const captainId = pickCaptain(displayPicks, ownedIds) ?? picked.captain.id;
  const viceId = pickVice(displayPicks, ownedIds, captainId) ?? picked.vice.id;
  const sellingPrices = Object.fromEntries(
    owned.map((o) => [o.player.id, o.sellingPrice]),
  );
  const chips = chipAdvice({
    eventId: upcomingId,
    plays: history.chips,
    lineup: picked,
    squad,
    bestPlan,
    holdPlan,
    activeChip: thisWeekPicks ? loaded.picks.active_chip : null,
  });
  const teamValue = loaded.picks.entry_history?.value ?? entry.last_deadline_value;
  const past = history.current.filter((row) => row.event < upcomingId);
  const lastGw = past.at(-1) ?? null;
  const madeMoves = toMadeMoves(weekTransfers, byId);

  return {
    entryId,
    teamName: entry.name,
    manager: `${entry.player_first_name} ${entry.player_last_name}`,
    overallPoints: entry.summary_overall_points,
    overallRank: entry.summary_overall_rank,
    bank,
    teamValue,
    freeTransfers,
    pulse: {
      points: entry.summary_overall_points,
      lastGwPoints: lastGw?.points ?? null,
      lastGwEvent: lastGw?.event ?? null,
      rank: entry.summary_overall_rank,
      previousRank: lastGw?.overall_rank ?? null,
      managers: snapshot.totalManagers,
      squadValue: teamValue,
      lastSquadValue: lastGw?.value ?? null,
      bank,
      bankAfter: bestPlan.bank,
      freeTransfers,
      maxFt: MAX_FREE_TRANSFERS,
      planMoves: bestPlan.moves.length,
      planHits: bestPlan.hits,
      planHitCost: bestPlan.hitCost,
      ftAfter: bestPlan.ftAfter,
    },
    squad,
    sellingPrices,
    captainId,
    viceId,
    madeMoves,
    plans,
    bestPlan,
    holdPlan,
    picked,
    picksLive: thisWeekPicks,
    chips,
    chipPlays: history.chips,
    activeChip: thisWeekPicks ? loaded.picks.active_chip : null,
  };
}
