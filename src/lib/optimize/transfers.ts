import { HIT_COST, MAX_FREE_TRANSFERS, SQUAD_COUNT, SQUAD_SIZE, TEAM_LIMIT } from "@/lib/fpl/rules";
import type { RankedPlayer } from "@/lib/xp/model";
import { bestLineup, type LineupResult } from "./lineup";

export type OwnedPlayer = {
  player: RankedPlayer;
  sellingPrice: number;
  purchasePrice: number;
};

export type TransferMove = {
  out: RankedPlayer;
  inn: RankedPlayer;
  /** Selling price received for `out`, FPL tenths. */
  sell: number;
  /** Purchase price paid for `inn`, FPL tenths. */
  buy: number;
  /** Bank change: buy − sell. Negative frees cash. */
  net: number;
};

export type TransferPlan = {
  moves: TransferMove[];
  hits: number;
  hitCost: number;
  bank: number;
  lineup: LineupResult;
  netXp: number;
  rawXp: number;
  ftAfter: number;
  label: string;
};

function ftAfterWeek(ft: number, used: number): number {
  const leftover = Math.max(0, ft - used);
  return Math.min(MAX_FREE_TRANSFERS, leftover + 1);
}

function legalSquad(squad: RankedPlayer[]): boolean {
  if (squad.length !== SQUAD_SIZE) return false;
  for (const pos of [1, 2, 3, 4] as const) {
    if (squad.filter((p) => p.position === pos).length !== SQUAD_COUNT[pos]) {
      return false;
    }
  }
  const teams = new Map<number, number>();
  for (const p of squad) {
    teams.set(p.teamId, (teams.get(p.teamId) ?? 0) + 1);
    if ((teams.get(p.teamId) ?? 0) > TEAM_LIMIT) return false;
  }
  return true;
}

function sniffXp(squad: RankedPlayer[]): number {
  const sorted = [...squad].sort((a, b) => b.xpThis - a.xpThis);
  const cap = sorted[0]?.xpThis ?? 0;
  return sorted.slice(0, 11).reduce((sum, p) => sum + p.xpThis, 0) + cap;
}

type Draft = {
  squad: RankedPlayer[];
  moves: TransferMove[];
  bank: number;
  sniff: number;
};

function finalize(
  draft: Draft,
  freeTransfers: number,
): TransferPlan | null {
  if (!legalSquad(draft.squad)) return null;
  if (draft.moves.some((m) => m.out.position !== m.inn.position)) return null;
  try {
    const lineup = bestLineup(draft.squad);
    const hits = Math.max(0, draft.moves.length - freeTransfers);
    const hitCost = hits * HIT_COST;
    const used = draft.moves.length;
    const after = ftAfterWeek(freeTransfers, used);
    const option = 0.28 * after;
    const rawXp = lineup.xp;
    const netXp = rawXp - hitCost + option;
    const label =
      draft.moves.length === 0
        ? "Hold / bank"
        : draft.moves.map((m) => `${m.out.webName} → ${m.inn.webName}`).join(", ");
    return {
      moves: draft.moves,
      hits,
      hitCost,
      bank: draft.bank,
      lineup,
      netXp,
      rawXp,
      ftAfter: after,
      label,
    };
  } catch {
    return null;
  }
}

function inCandidates(
  players: RankedPlayer[],
  owned: Set<number>,
  position?: number,
): RankedPlayer[] {
  return players
    .filter(
      (p) =>
        !owned.has(p.id) &&
        (position == null || p.position === position) &&
        p.pMinutes >= 0.35 &&
        p.status !== "u" &&
        p.status !== "n" &&
        p.xpThis + p.xpNext3 >= 6,
    )
    .sort((a, b) => b.xpThis + 0.25 * b.xpNext5 - (a.xpThis + 0.25 * a.xpNext5))
    .slice(0, position == null ? 12 : 10);
}

function pricedMove(
  out: RankedPlayer,
  inn: RankedPlayer,
  sellMap: Map<number, number>,
): TransferMove {
  const sell = sellMap.get(out.id) ?? out.cost;
  const buy = inn.cost;
  return { out, inn, sell, buy, net: buy - sell };
}

function pairSamePosition(
  a: RankedPlayer,
  b: RankedPlayer,
  inn1: RankedPlayer,
  inn2: RankedPlayer,
  sellMap: Map<number, number>,
): TransferMove[] | null {
  const direct =
    a.position === inn1.position && b.position === inn2.position
      ? [pricedMove(a, inn1, sellMap), pricedMove(b, inn2, sellMap)]
      : null;
  const swapped =
    a.position === inn2.position && b.position === inn1.position
      ? [pricedMove(a, inn2, sellMap), pricedMove(b, inn1, sellMap)]
      : null;
  if (direct && swapped) {
    const minDelta = (moves: TransferMove[]) =>
      Math.min(...moves.map((m) => m.inn.xpThis - m.out.xpThis));
    return minDelta(direct) >= minDelta(swapped) ? direct : swapped;
  }
  return direct ?? swapped;
}

export function adviseTransfers(opts: {
  players: RankedPlayer[];
  owned: OwnedPlayer[];
  bank: number;
  freeTransfers: number;
  maxTransfers?: number;
}): TransferPlan[] {
  const { players, owned, bank, freeTransfers } = opts;
  const maxTransfers = opts.maxTransfers ?? Math.min(2, Math.max(1, freeTransfers + 1));
  const squad0 = owned.map((o) => o.player);
  const sell = new Map(owned.map((o) => [o.player.id, o.sellingPrice]));
  const ownedIds = new Set(owned.map((o) => o.player.id));
  const drafts: Draft[] = [];

  drafts.push({
    squad: squad0,
    moves: [],
    bank,
    sniff: sniffXp(squad0),
  });

  const incomingByPos: Record<number, RankedPlayer[]> = {
    1: inCandidates(players, ownedIds, 1),
    2: inCandidates(players, ownedIds, 2),
    3: inCandidates(players, ownedIds, 3),
    4: inCandidates(players, ownedIds, 4),
  };

  if (maxTransfers >= 1) {
    for (const outOwned of owned) {
      const out = outOwned.player;
      const cash = bank + (sell.get(out.id) ?? out.cost);
      for (const inn of incomingByPos[out.position] ?? []) {
        if (inn.position !== out.position) continue;
        if (inn.cost > cash) continue;
        const next = squad0.filter((p) => p.id !== out.id).concat(inn);
        if (!legalSquad(next)) continue;
        drafts.push({
          squad: next,
          moves: [pricedMove(out, inn, sell)],
          bank: cash - inn.cost,
          sniff: sniffXp(next) - Math.max(0, 1 - freeTransfers) * HIT_COST,
        });
      }
    }
  }

  if (maxTransfers >= 2) {
    const weakest = [...owned]
      .sort((a, b) => a.player.xpThis - b.player.xpThis)
      .slice(0, 8)
      .map((o) => o.player);
    for (let i = 0; i < weakest.length; i++) {
      for (let j = i + 1; j < weakest.length; j++) {
        const a = weakest[i];
        const b = weakest[j];
        const cash = bank + (sell.get(a.id) ?? a.cost) + (sell.get(b.id) ?? b.cost);
        const poolA = (incomingByPos[a.position] ?? []).slice(0, 8);
        const poolB = (incomingByPos[b.position] ?? []).slice(0, 8);
        const pairs: [RankedPlayer, RankedPlayer][] = [];
        if (a.position === b.position) {
          for (let x = 0; x < poolA.length; x++) {
            for (let y = x + 1; y < poolA.length; y++) {
              pairs.push([poolA[x], poolA[y]]);
            }
          }
        } else {
          for (const innA of poolA) {
            for (const innB of poolB) {
              if (innA.id === innB.id) continue;
              pairs.push([innA, innB]);
            }
          }
        }
        for (const [inn1, inn2] of pairs) {
          if (inn1.cost + inn2.cost > cash) continue;
          const moves = pairSamePosition(a, b, inn1, inn2, sell);
          if (!moves) continue;
          const next = squad0
            .filter((p) => p.id !== a.id && p.id !== b.id)
            .concat(moves[0].inn, moves[1].inn);
          if (!legalSquad(next)) continue;
          const hits = Math.max(0, 2 - freeTransfers);
          drafts.push({
            squad: next,
            moves,
            bank: cash - inn1.cost - inn2.cost,
            sniff: sniffXp(next) - hits * HIT_COST,
          });
        }
      }
    }
  }

  const holdDraft = drafts[0];
  drafts.sort((a, b) => b.sniff - a.sniff);
  const unique: TransferPlan[] = [];
  const seen = new Set<string>();
  for (const draft of drafts.slice(0, 24)) {
    const key = draft.moves
      .map((m) => `${m.out.id}:${m.inn.id}`)
      .sort()
      .join("|");
    if (seen.has(key)) continue;
    const plan = finalize(draft, freeTransfers);
    if (!plan) continue;
    seen.add(key);
    unique.push(plan);
    if (unique.length >= 8) break;
  }
  if (!unique.some((plan) => plan.moves.length === 0)) {
    const hold = finalize(holdDraft, freeTransfers);
    if (hold) unique.push(hold);
  }
  unique.sort((a, b) => b.netXp - a.netXp);
  return unique;
}

export function inferFreeTransfers(
  history: { event: number; event_transfers: number; event_transfers_cost: number }[],
  upcomingEvent: number,
): number {
  if (upcomingEvent <= 1) return 1;
  let ft = 1;
  for (const row of history) {
    if (row.event >= upcomingEvent) break;
    if (row.event === 1) {
      ft = 1;
      continue;
    }
    const chipWeek = row.event_transfers_cost === 0 && row.event_transfers > ft;
    const used = chipWeek ? 0 : row.event_transfers;
    const leftover = Math.max(0, ft - used);
    ft = Math.min(MAX_FREE_TRANSFERS, leftover + 1);
  }
  return ft;
}
