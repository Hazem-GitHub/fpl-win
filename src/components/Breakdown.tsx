import { Abbr } from "@/components/Abbr";
import type { XpBreakdown } from "@/lib/xp/model";
import { abbr } from "@/lib/abbr";
import { formatXp } from "@/lib/format";
import type { ReactNode } from "react";

const rows: Array<{ key: keyof XpBreakdown; label: string }> = [
  { key: "appearance", label: "Minutes" },
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "cleanSheet", label: "Clean sheet" },
  { key: "defcon", label: abbr("defcon") },
  { key: "bonus", label: "Bonus" },
  { key: "saves", label: "Saves" },
  { key: "conceded", label: "Conceded" },
  { key: "cards", label: "Cards" },
];

export function Breakdown({ breakdown }: { breakdown: XpBreakdown }) {
  const parts = rows
    .map((row) => ({ ...row, value: breakdown[row.key] }))
    .filter((row) => Math.abs(row.value) >= 0.01);
  const max = Math.max(0.5, ...parts.map((row) => Math.abs(row.value)));
  const modelLead = breakdown.model - breakdown.official;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <XpHero label="Model" value={breakdown.model} />
        <XpHero label={<Abbr of="fplEp" />} value={breakdown.official} />
      </div>
      {Math.abs(modelLead) >= 0.3 ? (
        <p className="text-[11px] leading-4 text-muted">
          Model is{" "}
          <span className={modelLead > 0 ? "text-accent" : "text-danger"}>
            {modelLead > 0 ? "+" : ""}
            {formatXp(modelLead, 1)}
          </span>{" "}
          vs official {abbr("ep")}
          {modelLead > 0 ? " — the engine likes this more than FPL." : " — FPL is more optimistic."}
        </p>
      ) : null}
      {parts.length > 0 ? (
        <ul className="space-y-1.5">
          {parts.map((row) => (
            <li key={row.key} className="grid min-w-0 grid-cols-[minmax(0,5.5rem)_1fr_2.1rem] items-center gap-2">
              <span className="truncate text-[11px] text-muted">{row.label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-panel-2">
                <span
                  className={`block h-full rounded-full ${
                    row.value < 0 ? "bg-danger" : "bg-accent"
                  }`}
                  style={{ width: `${Math.max(6, (Math.abs(row.value) / max) * 100)}%` }}
                />
              </span>
              <span
                className={`tabular text-right text-[11px] ${
                  row.value < 0 ? "text-danger" : ""
                }`}
              >
                {row.value < 0 ? "" : "+"}
                {formatXp(row.value, 2)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-muted">No meaningful {abbr("xp")} components this week.</p>
      )}
    </div>
  );
}

function XpHero({ label, value }: { label: ReactNode; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2 px-2 py-2 text-center">
      <p className="tabular text-lg font-semibold">{formatXp(value)}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}
