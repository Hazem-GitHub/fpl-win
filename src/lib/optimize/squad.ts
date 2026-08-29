import {
  SQUAD_COUNT,
  SQUAD_SIZE,
  STARTING_BUDGET,
  TEAM_LIMIT,
  XI_MAX,
  XI_MIN,
} from "@/lib/fpl/rules";
import type { RankedPlayer } from "@/lib/xp/model";
import { getHighs, selectedIds } from "./highs";
import { bestLineup, type LineupResult } from "./lineup";

export type SquadRequest = {
  players: RankedPlayer[];
  budget?: number;
  lockedIds?: number[];
  excludedIds?: number[];
  horizon?: 3 | 5;
  preferMip?: boolean;
};

export type SquadPlan = {
  squad: RankedPlayer[];
  lineup: LineupResult;
  cost: number;
  bank: number;
  xp5: number;
  solver: "highs" | "local-search";
};

function valueOf(player: RankedPlayer, horizon: 3 | 5): number {
  const xp = horizon === 3 ? player.xpNext3 : player.xpNext5;
  return xp + 0.4 * player.xpThis;
}

function candidatePool(
  players: RankedPlayer[],
  lockedIds: Set<number>,
  excludedIds: Set<number>,
): RankedPlayer[] {
  const locked = players.filter((p) => lockedIds.has(p.id));
  const rest = players.filter((p) => {
    if (lockedIds.has(p.id) || excludedIds.has(p.id)) return false;
    if (p.status === "u" || p.status === "n") return false;
    return p.xpNext5 >= 4 || p.cost <= 45 || p.pMinutes >= 0.6;
  });
  const byPos: Record<number, RankedPlayer[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const p of rest) byPos[p.position].push(p);
  const caps: Record<number, number> = { 1: 16, 2: 32, 3: 36, 4: 18 };
  const trimmed: RankedPlayer[] = [...locked];
  const seen = new Set(locked.map((p) => p.id));
  for (const pos of [1, 2, 3, 4] as const) {
    byPos[pos].sort((a, b) => valueOf(b, 5) - valueOf(a, 5));
    for (const p of byPos[pos].slice(0, caps[pos])) {
      if (!seen.has(p.id)) {
        trimmed.push(p);
        seen.add(p.id);
      }
    }
  }
  return trimmed;
}

function canAdd(
  player: RankedPlayer,
  squad: RankedPlayer[],
  budget: number,
): boolean {
  if (squad.some((p) => p.id === player.id)) return false;
  const spent = squad.reduce((s, p) => s + p.cost, 0);
  if (spent + player.cost > budget) return false;
  if (squad.filter((p) => p.position === player.position).length >= SQUAD_COUNT[player.position]) {
    return false;
  }
  if (squad.filter((p) => p.teamId === player.teamId).length >= TEAM_LIMIT) {
    return false;
  }
  return true;
}

function cheapSquadScore(squad: RankedPlayer[], horizon: 3 | 5): number {
  const byPos: Record<number, RankedPlayer[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const p of squad) byPos[p.position].push(p);
  for (const pos of [1, 2, 3, 4] as const) {
    byPos[pos].sort((a, b) => b.xpThis - a.xpThis);
  }
  let xi = 0;
  let taken = 0;
  const take = (pos: 1 | 2 | 3 | 4, n: number) => {
    for (let i = 0; i < n && i < byPos[pos].length; i++) {
      xi += byPos[pos][i].xpThis;
      taken += 1;
    }
    byPos[pos] = byPos[pos].slice(n);
  };
  take(1, XI_MIN[1]);
  take(2, XI_MIN[2]);
  take(3, XI_MIN[3]);
  take(4, XI_MIN[4]);
  const rest = [1, 2, 3, 4].flatMap((pos) =>
    byPos[pos as 1 | 2 | 3 | 4].map((p) => ({ p, pos: pos as 1 | 2 | 3 | 4 })),
  );
  rest.sort((a, b) => b.p.xpThis - a.p.xpThis);
  const used: Record<number, number> = {
    1: XI_MIN[1],
    2: XI_MIN[2],
    3: XI_MIN[3],
    4: XI_MIN[4],
  };
  for (const row of rest) {
    if (taken >= 11) break;
    if (used[row.pos] >= XI_MAX[row.pos]) continue;
    xi += row.p.xpThis;
    used[row.pos] += 1;
    taken += 1;
  }
  const bench = squad.reduce((s, p) => s + valueOf(p, horizon), 0);
  return xi * 6 + bench;
}

function localSearchSquad(
  players: RankedPlayer[],
  budget: number,
  lockedIds: Set<number>,
  excludedIds: Set<number>,
  horizon: 3 | 5,
): RankedPlayer[] {
  const pool = candidatePool(players, lockedIds, excludedIds);
  const squad: RankedPlayer[] = pool.filter((p) => lockedIds.has(p.id));
  const ranked = [...pool].sort(
    (a, b) =>
      valueOf(b, horizon) / Math.pow(Math.max(b.cost, 40) / 10, 0.5) -
      valueOf(a, horizon) / Math.pow(Math.max(a.cost, 40) / 10, 0.5),
  );

  for (const pos of [1, 2, 3, 4] as const) {
    while (squad.filter((p) => p.position === pos).length < SQUAD_COUNT[pos]) {
      const pick = ranked.find((p) => p.position === pos && canAdd(p, squad, budget));
      if (!pick) break;
      squad.push(pick);
    }
  }

  let best = [...squad];
  let bestScore = cheapSquadScore(best, horizon);
  const unlocked = () => best.filter((p) => !lockedIds.has(p.id));

  for (let round = 0; round < 3; round++) {
    for (const out of unlocked()) {
      for (const inn of ranked) {
        if (inn.position !== out.position || inn.id === out.id) continue;
        const next = best.filter((p) => p.id !== out.id);
        if (!canAdd(inn, next, budget)) continue;
        next.push(inn);
        const s = cheapSquadScore(next, horizon);
        if (s > bestScore) {
          best = next;
          bestScore = s;
        }
      }
    }
  }

  return best;
}

function buildLp(
  pool: RankedPlayer[],
  budget: number,
  lockedIds: Set<number>,
  excludedIds: Set<number>,
  horizon: 3 | 5,
): string {
  const terms = pool.map((p) => `${valueOf(p, horizon).toFixed(4)} x${p.id}`);
  const lines: string[] = ["Maximize", ` obj: ${terms.join(" + ")}`, "Subject To"];
  lines.push(` squad: ${pool.map((p) => `x${p.id}`).join(" + ")} = ${SQUAD_SIZE}`);
  for (const pos of [1, 2, 3, 4] as const) {
    const group = pool.filter((p) => p.position === pos);
    if (group.length === 0) continue;
    lines.push(
      ` pos${pos}: ${group.map((p) => `x${p.id}`).join(" + ")} = ${SQUAD_COUNT[pos]}`,
    );
  }
  lines.push(
    ` budget: ${pool.map((p) => `${p.cost} x${p.id}`).join(" + ")} <= ${budget}`,
  );
  const teams = new Set(pool.map((p) => p.teamId));
  for (const teamId of teams) {
    const group = pool.filter((p) => p.teamId === teamId);
    if (group.length <= TEAM_LIMIT) continue;
    lines.push(
      ` team${teamId}: ${group.map((p) => `x${p.id}`).join(" + ")} <= ${TEAM_LIMIT}`,
    );
  }
  for (const id of lockedIds) {
    if (pool.some((p) => p.id === id)) lines.push(` lock${id}: x${id} = 1`);
  }
  for (const id of excludedIds) {
    if (pool.some((p) => p.id === id)) lines.push(` excl${id}: x${id} = 0`);
  }
  lines.push("Bounds");
  for (const p of pool) lines.push(` 0 <= x${p.id} <= 1`);
  lines.push("Binary");
  lines.push(` ${pool.map((p) => `x${p.id}`).join(" ")}`);
  lines.push("End");
  return lines.join("\n");
}

async function highsSquad(
  pool: RankedPlayer[],
  budget: number,
  lockedIds: Set<number>,
  excludedIds: Set<number>,
  horizon: 3 | 5,
): Promise<RankedPlayer[] | null> {
  try {
    const highs = await getHighs();
    const lp = buildLp(pool, budget, lockedIds, excludedIds, horizon);
    const result = highs.solve(lp, {
      time_limit: 1.5,
      output_flag: false,
      log_to_console: false,
    });
    if (result.Status !== "Optimal" && result.Status !== "Time limit reached") {
      return null;
    }
    const ids = selectedIds(result.Columns, "x");
    const byId = new Map(pool.map((p) => [p.id, p]));
    const squad = ids.map((id) => byId.get(id)).filter((p): p is RankedPlayer => !!p);
    if (squad.length !== SQUAD_SIZE) return null;
    return squad;
  } catch {
    return null;
  }
}

export async function buildSquad(req: SquadRequest): Promise<SquadPlan> {
  const budget = req.budget ?? STARTING_BUDGET;
  const lockedIds = new Set(req.lockedIds ?? []);
  const excludedIds = new Set(req.excludedIds ?? []);
  const horizon = req.horizon ?? 5;
  const pool = candidatePool(req.players, lockedIds, excludedIds);

  let solver: SquadPlan["solver"] = "local-search";
  let squad = localSearchSquad(req.players, budget, lockedIds, excludedIds, horizon);

  if (req.preferMip !== false && lockedIds.size === 0 && excludedIds.size === 0) {
    const mip = await highsSquad(pool, budget, lockedIds, excludedIds, horizon);
    if (mip) {
      const mipScore = cheapSquadScore(mip, horizon);
      const localScore = cheapSquadScore(squad, horizon);
      if (mipScore >= localScore) {
        squad = mip;
        solver = "highs";
      }
    }
  }

  const lineup = bestLineup(squad);
  const cost = squad.reduce((s, p) => s + p.cost, 0);
  return {
    squad,
    lineup,
    cost,
    bank: budget - cost,
    xp5: squad.reduce((s, p) => s + p.xpNext5, 0),
    solver,
  };
}
