"use client";

import { IconLabel } from "@/components/Icon";
import { abbr } from "@/lib/abbr";
import { formatXp } from "@/lib/format";
import type { ChipAdvice } from "@/lib/optimize/chips";
import type { TransferPlan } from "@/lib/optimize/transfers";
import { planKey, planMovesLabel } from "@/lib/week-plan";
import { Check, Crown, Layers, LayoutGrid, Shuffle, Undo2 } from "lucide-react";

function chipIcon(chip: ChipAdvice["chip"]) {
  if (chip === "3xc") return Crown;
  if (chip === "bboost") return Layers;
  if (chip === "freehit") return Undo2;
  return Shuffle;
}

export function WeekPlanApply({
  options,
  selectedKey,
  onSelect,
  appliedXi,
  appliedArmband,
  appliedChip,
  onApplyXi,
  onApplyArmband,
  onApplyChip,
  selectedChips,
}: {
  options: TransferPlan[];
  selectedKey: string;
  onSelect: (key: string) => void;
  appliedXi: boolean;
  appliedArmband: boolean;
  appliedChip: ChipAdvice["chip"] | null;
  onApplyXi: () => void;
  onApplyArmband: () => void;
  onApplyChip: (chip: ChipAdvice["chip"]) => void;
  selectedChips: ChipAdvice[];
}) {
  const playable = selectedChips.filter((chip) => chip.available && chip.recommend);

  return (
    <div className="rounded-xl border border-line bg-panel p-2.5 sm:p-3">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          This week’s options
        </p>
        <p className="truncate text-[11px] text-muted">
          Apply to this {abbr("gw")} {abbr("xi")}
        </p>
      </div>
      <div
        className="hide-scroll flex gap-1.5 overflow-x-auto p-1 sm:flex-wrap sm:overflow-x-visible"
        role="listbox"
        aria-label="This week's transfer plans"
      >
        {options.map((plan) => {
          const key = planKey(plan);
          const active = key === selectedKey;
          return (
            <button
              key={key}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onSelect(key)}
              className={`min-w-30 shrink-0 rounded-lg border px-2.5 py-1.5 text-left transition sm:min-w-32 sm:flex-1 ${
                active
                  ? "border-accent/70 bg-accent/10 shadow-[0_0_0_1px_var(--accent)]"
                  : "border-line bg-panel-2/50 hover:border-accent/30 hover:bg-panel-2"
              }`}
            >
              <p className="truncate text-[11px] font-medium leading-4">
                {planMovesLabel(plan)}
              </p>
              <p className="mt-0.5 tabular text-[13px] font-semibold leading-none">
                {formatXp(plan.netXp)}
                <span className="ml-0.5 text-[9px] font-medium text-muted">
                  {abbr("netXp")}
                </span>
              </p>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 px-1">
        <button
          type="button"
          onClick={onApplyXi}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
            appliedXi
              ? "border-accent/50 bg-accent/10 text-accent"
              : "border-line text-muted hover:border-accent/40 hover:text-foreground"
          }`}
        >
          <IconLabel icon={appliedXi ? Check : LayoutGrid} size="xs">
            {appliedXi ? `Applied ${abbr("xi")}` : `Apply ${abbr("xi")}`}
          </IconLabel>
        </button>
        <button
          type="button"
          onClick={onApplyArmband}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
            appliedArmband
              ? "border-accent/50 bg-accent/10 text-accent"
              : "border-line text-muted hover:border-accent/40 hover:text-foreground"
          }`}
        >
          <IconLabel icon={appliedArmband ? Check : Crown} size="xs">
            {appliedArmband ? "Applied C & V" : "Apply C & V"}
          </IconLabel>
        </button>
        {playable.map((chip) => {
          const on = appliedChip === chip.chip;
          return (
            <button
              key={chip.chip}
              type="button"
              onClick={() => onApplyChip(chip.chip)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                on
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-line text-muted hover:border-accent/40 hover:text-foreground"
              }`}
            >
              <IconLabel icon={on ? Check : chipIcon(chip.chip)} size="xs">
                {on ? `Applied ${chip.label}` : `Apply ${chip.label}`}
              </IconLabel>
            </button>
          );
        })}
      </div>
    </div>
  );
}
