import type { TransferPlan } from "@/lib/optimize/transfers";

export function planKey(plan: TransferPlan): string {
  if (plan.moves.length === 0) return "hold";
  return plan.moves
    .map((m) => `${m.out.id}:${m.inn.id}`)
    .sort()
    .join("|");
}

export function planMovesLabel(plan: TransferPlan): string {
  if (plan.moves.length === 0) return plan.label;
  return plan.moves.map((m) => `${m.out.webName} → ${m.inn.webName}`).join(" · ");
}

export function horizonXp(plan: TransferPlan): number {
  return plan.moves.reduce((sum, m) => sum + (m.inn.xpNext5 - m.out.xpNext5), 0);
}

export function pickAlts(
  plans: TransferPlan[],
  best: TransferPlan,
  hold: TransferPlan,
): TransferPlan[] {
  const bestK = planKey(best);
  const others = plans.filter((p) => planKey(p) !== bestK);
  const out: TransferPlan[] = [];
  const seen = new Set<string>();

  function add(plan: TransferPlan | undefined) {
    if (!plan) return;
    const k = planKey(plan);
    if (k === bestK || seen.has(k)) return;
    seen.add(k);
    out.push(plan);
  }

  if (best.moves.length > 0) add(hold);

  if (best.hits > 0) {
    add(
      others
        .filter((p) => p.hits === 0 && p.moves.length > 0)
        .sort((a, b) => b.netXp - a.netXp)[0],
    );
  }

  const bestH = horizonXp(best);
  add(
    [...others]
      .filter((p) => horizonXp(p) > bestH + 0.8)
      .sort((a, b) => horizonXp(b) - horizonXp(a))[0],
  );

  add(
    [...others]
      .filter((p) => p.bank >= best.bank + 10)
      .sort((a, b) => b.bank - a.bank || b.netXp - a.netXp)[0],
  );

  add(
    others.find((p) => {
      if (Math.abs(p.netXp - best.netXp) >= 0.2 || p.hits !== best.hits) return false;
      const bestOuts = best.moves
        .map((m) => m.out.id)
        .sort()
        .join(",");
      const outs = p.moves
        .map((m) => m.out.id)
        .sort()
        .join(",");
      return outs !== bestOuts;
    }),
  );

  for (const p of others.sort((a, b) => b.netXp - a.netXp)) {
    if (out.length >= 3) break;
    add(p);
  }

  return out.slice(0, 3);
}

export function weekPlanOptions(
  plans: TransferPlan[],
  best: TransferPlan,
  hold: TransferPlan,
): TransferPlan[] {
  return [best, ...pickAlts(plans, best, hold)];
}
