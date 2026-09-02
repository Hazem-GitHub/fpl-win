"use client";

import { useAppState } from "@/components/AppState";
import { abbr } from "@/lib/abbr";
import { formatXp } from "@/lib/format";
import type { LineupResult } from "@/lib/optimize/lineup";
import { Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { IconLabel } from "./Icon";
import { Pitch } from "./Pitch";

function signedXp(value: number): string {
  if (value > 0) return `+${formatXp(value)}`;
  return formatXp(value);
}

function shapeNote(best: string, other: string): string {
  if (best === other) return `Highest ${abbr("xiXp")}`;
  const [bd, bm, bf] = best.split("-").map(Number);
  const [od, om, ofwd] = other.split("-").map(Number);
  const bits: string[] = [];
  if (od !== bd) bits.push(od > bd ? `+${od - bd} ${abbr("def")}` : `−${bd - od} ${abbr("def")}`);
  if (om !== bm) bits.push(om > bm ? `+${om - bm} ${abbr("mid")}` : `−${bm - om} ${abbr("mid")}`);
  if (ofwd !== bf) {
    bits.push(ofwd > bf ? `+${ofwd - bf} ${abbr("fwd")}` : `−${bf - ofwd} ${abbr("fwd")}`);
  }
  return bits.join(" · ");
}

export function FormationBoard({
  options,
  gameweek,
  compact,
}: {
  options: LineupResult[];
  gameweek?: number;
  compact?: boolean;
}) {
  const app = useAppState();
  const best = options[0];
  const [selected, setSelected] = useState(best?.formation ?? "");
  const current = options.find((opt) => opt.formation === selected) ?? best;

  useEffect(() => {
    if (best?.formation) setSelected(best.formation);
  }, [best?.formation]);

  if (!best || !current) return null;
  const comparing = current.formation !== best.formation;

  function pick(formation: string) {
    setSelected(formation);
    app.setFormation(formation);
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="rounded-xl border border-line bg-panel p-2 sm:p-2.5">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <h2 className="text-sm font-semibold">Formation</h2>
          <p className="truncate text-[11px] text-muted">
            {comparing
              ? `${current.formation} · ${signedXp(current.xp - best.xp)} vs ${best.formation}`
              : `${best.formation} leads`}
          </p>
        </div>
        <div
          className="hide-scroll flex gap-1.5 overflow-x-auto p-1 sm:flex-wrap sm:overflow-x-visible"
          role="listbox"
          aria-label="Formation"
        >
          {options.map((opt, i) => {
            const isBest = i === 0;
            const active = opt.formation === current.formation;
            const delta = opt.xp - best.xp;
            return (
              <button
                key={opt.formation}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => pick(opt.formation)}
                className={`min-w-[5.5rem] shrink-0 rounded-lg border px-2.5 py-1.5 text-left transition sm:min-w-[5.75rem] sm:flex-1 ${
                  active
                    ? "border-accent/70 bg-accent/10 shadow-[0_0_0_1px_var(--accent)]"
                    : "border-line bg-panel-2/50 hover:border-accent/30 hover:bg-panel-2"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-semibold tracking-tight">
                    {opt.formation}
                  </span>
                  {isBest ? (
                    <span className="rounded-full bg-accent px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-on-accent">
                      Best
                    </span>
                  ) : (
                    <span className="tabular text-[10px] font-medium text-muted">
                      {signedXp(delta)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 tabular text-[13px] font-semibold leading-none text-accent">
                  {formatXp(opt.xp)}
                  <span className="ml-0.5 text-[9px] font-medium text-muted" title={abbr("xp")}>
                    xP
                  </span>
                </p>
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-[11px] text-muted">
          {shapeNote(best.formation, current.formation)}
          {` · ${abbr("cap")} ${current.captain.webName}`}
          {comparing ? (
            <>
              {" · "}
              <button
                type="button"
                className="text-accent"
                onClick={() => pick(best.formation)}
              >
                <IconLabel icon={Undo2} size="xs">
                  Back to {best.formation}
                </IconLabel>
              </button>
            </>
          ) : null}
        </p>
      </div>
      <Pitch
        xi={current.xi}
        bench={current.bench}
        captainId={current.captain.id}
        viceId={current.vice.id}
        gameweek={gameweek}
        formation={current.formation}
        compact={compact}
      />
    </div>
  );
}
