import { fetchEntry, fetchEntryHistory, fetchPicksSafe } from "@/lib/fpl/client";
import { MAX_FREE_TRANSFERS, sellPrice } from "@/lib/fpl/rules";
import { chipAdvice, type ChipAdvice } from "@/lib/optimize/chips";
import { adviseTransfers, inferFreeTransfers, type TransferPlan } from "@/lib/optimize/transfers";
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
  plans: TransferPlan[];
  bestPlan: TransferPlan;
  holdPlan: TransferPlan;
  chips: ChipAdvice[];
};

export async function adviseTeam(
  entryId: number,
  snapshot: EngineSnapshot,
): Promise<TeamAdvice> {
  const [entry, history] = await Promise.all([
    fetchEntry(entryId),
    fetchEntryHistory(entryId),
  ]);
  const picks = await fetchPicksSafe(entryId, snapshot.upcoming.id);
  const byId = new Map(snapshot.players.map((p) => [p.id, p]));
  const owned = picks.picks
    .map((pick) => {
      const player = byId.get(pick.element);
      if (!player) return null;
      const purchase = pick.purchase_price ?? player.cost;
      const selling = pick.selling_price ?? sellPrice(purchase, player.cost);
      return { player, sellingPrice: selling, purchasePrice: purchase };
    })
    .filter((row): row is NonNullable<typeof row> => row != null);

  const bank = picks.entry_history?.bank ?? entry.last_deadline_bank ?? 0;
  const freeTransfers = inferFreeTransfers(history.current, snapshot.upcoming.id);
  const plans = adviseTransfers({
    players: snapshot.players,
    owned,
    bank,
    freeTransfers,
  });
  const holdPlan = plans.find((p) => p.moves.length === 0) ?? plans[0];
  const bestPlan = plans[0] ?? holdPlan;
  const squad = owned.map((o) => o.player);
  const sellingPrices = Object.fromEntries(
    owned.map((o) => [o.player.id, o.sellingPrice]),
  );
  const chips = chipAdvice({
    eventId: snapshot.upcoming.id,
    plays: history.chips,
    lineup: bestPlan.lineup,
    squad: bestPlan.lineup.xi.concat(bestPlan.lineup.bench),
    bestPlan,
    holdPlan,
  });
  const teamValue = picks.entry_history?.value ?? entry.last_deadline_value;
  const past = history.current.filter((row) => row.event < snapshot.upcoming.id);
  const lastGw = past.at(-1) ?? null;

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
    captainId: picks.picks.find((p) => p.is_captain)?.element ?? null,
    viceId: picks.picks.find((p) => p.is_vice_captain)?.element ?? null,
    plans,
    bestPlan,
    holdPlan,
    chips,
  };
}
