import { XI_MAX, XI_MIN } from "@/lib/fpl/rules";
import type { RankedPlayer } from "@/lib/xp/model";

export type LineupResult = {
  xi: RankedPlayer[];
  bench: RankedPlayer[];
  captain: RankedPlayer;
  vice: RankedPlayer;
  xp: number;
  formation: string;
};

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (k > items.length) return [];
  const out: T[][] = [];
  const walk = (start: number, chosen: T[]) => {
    if (chosen.length === k) {
      out.push([...chosen]);
      return;
    }
    const need = k - chosen.length;
    for (let i = start; i <= items.length - need; i++) {
      chosen.push(items[i]);
      walk(i + 1, chosen);
      chosen.pop();
    }
  };
  walk(0, []);
  return out;
}

function packLineup(
  xi: RankedPlayer[],
  squad: RankedPlayer[],
  gkps: RankedPlayer[],
  nd: number,
  nm: number,
  nf: number,
  captainMultiplier: number,
): LineupResult {
  let captain = xi[0];
  for (const p of xi) {
    if (p.xpThis > captain.xpThis) captain = p;
  }
  let vice = xi.find((p) => p.id !== captain.id) ?? captain;
  for (const p of xi) {
    if (p.id !== captain.id && p.xpThis > vice.xpThis) vice = p;
  }
  const base = xi.reduce((sum, p) => sum + p.xpThis, 0);
  const xp = base + (captainMultiplier - 1) * captain.xpThis;
  const xiIds = new Set(xi.map((p) => p.id));
  const benchGk = gkps.find((p) => !xiIds.has(p.id));
  const outfieldBench = squad
    .filter((p) => !xiIds.has(p.id) && p.position !== 1)
    .sort((a, b) => b.xpThis - a.xpThis);
  return {
    xi,
    bench: [...(benchGk ? [benchGk] : []), ...outfieldBench],
    captain,
    vice,
    xp,
    formation: `${nd}-${nm}-${nf}`,
  };
}

/** Best XI for every legal formation, highest xP first. */
export function rankFormations(
  squad: RankedPlayer[],
  captainMultiplier = 2,
): LineupResult[] {
  const gkps = squad.filter((p) => p.position === 1);
  const defs = squad.filter((p) => p.position === 2);
  const mids = squad.filter((p) => p.position === 3);
  const fwds = squad.filter((p) => p.position === 4);
  const byShape = new Map<string, LineupResult>();

  for (const gk of gkps) {
    for (let nd = XI_MIN[2]; nd <= Math.min(XI_MAX[2], defs.length); nd++) {
      for (const defComb of combinations(defs, nd)) {
        for (let nm = XI_MIN[3]; nm <= Math.min(XI_MAX[3], mids.length); nm++) {
          const nf = 11 - 1 - nd - nm;
          if (nf < XI_MIN[4] || nf > XI_MAX[4] || nf > fwds.length) continue;
          for (const midComb of combinations(mids, nm)) {
            for (const fwdComb of combinations(fwds, nf)) {
              const xi = [gk, ...defComb, ...midComb, ...fwdComb];
              const packed = packLineup(
                xi,
                squad,
                gkps,
                nd,
                nm,
                nf,
                captainMultiplier,
              );
              const prev = byShape.get(packed.formation);
              if (!prev || packed.xp > prev.xp) {
                byShape.set(packed.formation, packed);
              }
            }
          }
        }
      }
    }
  }

  return [...byShape.values()].sort(
    (a, b) => b.xp - a.xp || a.formation.localeCompare(b.formation),
  );
}

export function bestLineup(
  squad: RankedPlayer[],
  captainMultiplier = 2,
): LineupResult {
  const ranked = rankFormations(squad, captainMultiplier);
  if (!ranked[0]) {
    throw new Error("Could not form a legal starting XI from this squad");
  }
  return ranked[0];
}

export function squadXp(squad: RankedPlayer[], captainMultiplier = 2): number {
  return bestLineup(squad, captainMultiplier).xp;
}
