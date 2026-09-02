import type { ChipAdvice } from "@/lib/optimize/chips";
import type { FplChipName } from "@/lib/fpl/types";
import { Crown, Layers, Shuffle, Undo2, type LucideIcon } from "lucide-react";
import { Icon } from "./Icon";

const urgencyClass = {
  none: "border-line text-muted",
  soon: "border-warn/40 text-warn",
  now: "border-danger/50 text-danger",
};

const CHIP_MARK: Record<FplChipName, { icon: LucideIcon; tone: string }> = {
  wildcard: { icon: Shuffle, tone: "bg-sky-500/15 text-sky-700 dark:text-sky-400" },
  freehit: { icon: Undo2, tone: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  bboost: { icon: Layers, tone: "bg-amber-400/20 text-amber-800 dark:text-amber-400" },
  "3xc": { icon: Crown, tone: "bg-warn/20 text-warn" },
};

export function ChipPanel({
  chips,
  appliedChip,
}: {
  chips: ChipAdvice[];
  appliedChip?: FplChipName | null;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {chips.map((chip) => {
        const mark = CHIP_MARK[chip.chip];
        const applied = appliedChip === chip.chip;
        return (
          <article
            key={chip.chip}
            className={`rounded-xl border bg-panel p-3 ${
              applied || chip.recommend
                ? "border-accent/50 bg-accent/5"
                : urgencyClass[chip.urgency]
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${mark.tone}`}
                >
                  <Icon icon={mark.icon} size="md" />
                </span>
                <h3 className="text-sm font-semibold">{chip.label}</h3>
              </span>
              <span className="text-[10px] uppercase tracking-widest">
                {chip.usedThisWeek
                  ? "Played"
                  : applied
                    ? "Applied"
                    : !chip.available
                      ? "Used"
                      : chip.recommend
                        ? "Play"
                        : chip.urgency === "now"
                          ? "Expiring"
                          : "Hold"}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">{chip.reason}</p>
          </article>
        );
      })}
    </div>
  );
}
