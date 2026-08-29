"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAppState } from "@/components/AppState";
import { Jump } from "@/components/Jump";
import { Icon } from "@/components/Icon";
import {
  builderHref,
  fixturesHref,
  playersHref,
} from "@/lib/app-href";
import { Breakdown } from "@/components/Breakdown";
import { ClubCrest } from "@/components/ClubCrest";
import { PlayerTile, PosChip } from "@/components/PlayerTile";
import { abbr } from "@/lib/abbr";
import { Abbr } from "@/components/Abbr";
import { formatPct, formatPrice, formatXp, formTrend } from "@/lib/format";
import type { RecentMatch, RecentTotals, PlayerRecent } from "@/lib/player/recent";
import type { FixtureSlice, RankedPlayer } from "@/lib/xp/model";
import { BarChart3, CalendarDays, Wrench, X } from "lucide-react";

export function PlayerProfile({
  player,
  onClose,
}: {
  player: RankedPlayer;
  onClose: () => void;
}) {
  const [recent, setRecent] = useState<PlayerRecent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const app = useAppState();

  useEffect(() => {
    let cancelled = false;
    setRecent(null);
    setError(null);
    fetch(`/api/player/${player.id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load matches");
        return res.json() as Promise<PlayerRecent>;
      })
      .then((data) => {
        if (!cancelled) setRecent(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load matches");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [player.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const totals = recent?.totals;
  const verdict = pickVerdict(player);
  const trend = formTrend(player.form);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const panel = (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/50 sm:items-stretch sm:justify-end">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close player"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-[min(92dvh,100%)] w-full min-w-0 max-w-[100vw] flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-t-2xl border-t border-line bg-panel p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:h-full sm:max-w-lg sm:rounded-none sm:border-t-0 sm:border-l sm:p-5 sm:pb-5">
        <header className="flex items-start gap-3">
          <PlayerTile player={player} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <PosChip player={player} />
              <span className="text-[11px] uppercase tracking-widest text-muted">
                {player.team}
              </span>
              {verdict ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${verdict.className}`}
                >
                  {verdict.label}
                </span>
              ) : null}
            </div>
            <h2 className="mt-1 text-xl font-semibold leading-tight">
              {player.webName}
            </h2>
            <p className="text-sm text-muted">
              {player.firstName} {player.secondName}
            </p>
            <p className="mt-1 tabular text-sm">
              {formatPrice(player.cost)}
              <span className="text-muted"> · </span>
              {formatPct(player.selectedBy)} owned
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-muted hover:text-foreground"
            aria-label="Close"
          >
            <Icon icon={X} size="md" />
          </button>
        </header>

        {player.news ? (
          <p className="mt-3 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
            {player.news}
            {player.chanceNext != null ? ` · ${player.chanceNext}% next` : ""}
          </p>
        ) : null}

        <section className="mt-4 grid min-w-0 grid-cols-3 gap-2">
          <HeroStat
            label={<Abbr of="thisGw" />}
            value={formatXp(player.xpThis)}
            hint={fdrHint(player.fdrThis)}
            accent
          />
          <HeroStat
            label="Next 5"
            value={formatXp(player.xpNext5)}
            hint={`${formatXp(player.value)} ${abbr("xpPerM")}`}
          />
          <HeroStat
            label="Form"
            value={player.form.toFixed(1)}
            hint={`${player.pointsPerGame.toFixed(1)} ${abbr("ppg")}`}
            tone={
              trend === "hot" || trend === "up"
                ? "accent"
                : trend === "down" || trend === "cold"
                  ? "danger"
                  : undefined
            }
          />
        </section>

        <section className="mt-4 space-y-2.5">
          <Meter
            label="Minutes"
            value={player.pMinutes}
            display={`${Math.round(player.pMinutes * 100)}%`}
            tone={player.pMinutes >= 0.75 ? "accent" : player.pMinutes < 0.5 ? "danger" : "warn"}
          />
          <Meter
            label="Ownership"
            value={Math.min(1, player.selectedBy / 50)}
            display={formatPct(player.selectedBy)}
            tone={player.selectedBy < 8 ? "accent" : player.selectedBy > 40 ? "warn" : "muted"}
          />
          <Meter
            label="Form vs season"
            value={Math.min(1, player.form / 8)}
            display={formLabel(trend, player.form, player.pointsPerGame)}
            tone={
              trend === "hot" || trend === "up"
                ? "accent"
                : trend === "down" || trend === "cold"
                  ? "danger"
                  : "muted"
            }
          />
        </section>

        {totals ? <SampleStrip player={player} totals={totals} /> : null}

        {recent?.insights && recent.insights.length > 0 ? (
          <ul className="mt-4 space-y-1.5">
            {recent.insights.map((line) => (
              <li
                key={line}
                className={`rounded-lg border px-3 py-2 text-xs leading-5 ${insightTone(line)}`}
              >
                {line}
              </li>
            ))}
          </ul>
        ) : null}

        <section className="mt-5">
          <SectionTitle>
            <Abbr of="xpGw" />
          </SectionTitle>
          <Breakdown breakdown={player.breakdown} />
        </section>

        <section className="mt-5">
          <SectionTitle>Next five</SectionTitle>
          <FixtureRunway fixtures={player.fixtures} />
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Jump
              href={playersHref({
                pos: player.position,
                player: player.id,
                q: player.webName,
              })}
              icon={BarChart3}
              onClick={() =>
                app.setRankings({
                  pos: player.position,
                  playerId: player.id,
                  q: player.webName,
                  view: null,
                })
              }
            >
              Rankings
            </Jump>
            <Jump
              href={fixturesHref(player.teamId)}
              icon={CalendarDays}
              onClick={() => app.setFocusClub(player.teamId)}
            >
              {player.teamShort} fixtures
            </Jump>
            <Jump
              href={builderHref({
                lock: [...app.builderLocked.filter((id) => id !== player.id), player.id],
                ban: app.builderExcluded.filter((id) => id !== player.id),
              })}
              icon={Wrench}
              onClick={() =>
                app.setBuilder(
                  [...app.builderLocked.filter((id) => id !== player.id), player.id],
                  app.builderExcluded.filter((id) => id !== player.id),
                )
              }
            >
              Lock in builder
            </Jump>
          </div>
        </section>

        <section className="mt-5">
          <SectionTitle>Last 8 matches</SectionTitle>
          <p className="mb-3 text-[11px] leading-4 text-muted">
            {player.position === 1
              ? "Clean sheets, saves, and goals conceded — the keeper floor."
              : player.position === 2
                ? `Clean sheets and ${abbr("defcon")} hits — the two-point defensive floor.`
                : "Goals, assists, and xGI vs points — whether form is real or luck."}
          </p>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
          {!recent && !error ? <MatchSkeleton /> : null}
          {recent && recent.matches.length === 0 ? (
            <p className="text-xs text-muted">No matches recorded this season.</p>
          ) : null}
          {recent && recent.matches.length > 0 ? (
            <>
              <FormSpark matches={recent.matches} />
              {totals && (player.position === 3 || player.position === 4) ? (
                <OutputVsXgi totals={totals} />
              ) : null}
              {totals && (player.position === 1 || player.position === 2) ? (
                <DefFloor totals={totals} keeper={player.position === 1} />
              ) : null}
              <ol className="mt-3 space-y-1.5">
                {recent.matches.map((m) => (
                  <li key={`${m.fixtureId}-${m.round}`}>
                    <MatchCard match={m} position={player.position} />
                  </li>
                ))}
              </ol>
            </>
          ) : null}
          {recent?.lastSeason ? (
            <LastSeasonCard season={recent.lastSeason} position={player.position} />
          ) : null}
        </section>
      </aside>
    </div>
  );

  if (!mounted) return null;
  return createPortal(panel, document.body);
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-xs uppercase tracking-widest text-muted">{children}</h3>
  );
}

function HeroStat({
  label,
  value,
  hint,
  accent,
  tone,
}: {
  label: ReactNode;
  value: string;
  hint?: string;
  accent?: boolean;
  tone?: "accent" | "danger";
}) {
  const color =
    accent || tone === "accent"
      ? "text-accent"
      : tone === "danger"
        ? "text-danger"
        : "";
  return (
    <div
      className={`min-w-0 overflow-hidden rounded-xl border px-2 py-2.5 sm:px-2.5 ${
        accent ? "border-accent/40 bg-accent/10" : "border-line bg-panel-2"
      }`}
    >
      <p className={`tabular text-xl font-semibold leading-none ${color}`}>{value}</p>
      <p className="mt-1 text-[10px] leading-snug tracking-wide text-muted">{label}</p>
      {hint ? (
        <p className="mt-0.5 break-words text-[10px] leading-snug text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function Meter({
  label,
  value,
  display,
  tone,
}: {
  label: string;
  value: number;
  display: string;
  tone: "accent" | "danger" | "warn" | "muted";
}) {
  const fill =
    tone === "accent"
      ? "bg-accent"
      : tone === "danger"
        ? "bg-danger"
        : tone === "warn"
          ? "bg-warn"
          : "bg-muted";
  return (
    <div>
      <div className="flex justify-between gap-2 text-[11px]">
        <span className="text-muted">{label}</span>
        <span className="tabular">{display}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel-2">
        <div
          className={`h-full rounded-full ${fill}`}
          style={{ width: `${Math.max(4, Math.min(100, value * 100))}%` }}
        />
      </div>
    </div>
  );
}

function SampleStrip({
  player,
  totals,
}: {
  player: RankedPlayer;
  totals: RecentTotals;
}) {
  const stats = headlineStats(player.position, totals);
  return (
    <div className="mt-4 grid min-w-0 grid-cols-4 gap-1.5">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="min-w-0 overflow-hidden rounded-lg border border-line bg-panel-2 px-1 py-2 text-center"
        >
          <p className="tabular text-sm font-semibold">{stat.value}</p>
          <p className="break-words text-[9px] leading-tight tracking-wide text-muted">
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function FixtureRunway({ fixtures }: { fixtures: FixtureSlice[] }) {
  if (fixtures.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-panel-2 px-3 py-4 text-center text-xs text-muted">
        Blank — no fixture in this window.
      </p>
    );
  }
  return (
    <ol className="flex min-w-0 gap-1.5">
      {fixtures.slice(0, 6).map((fx, i) => (
        <li
          key={`${fx.event}-${fx.opponentId}-${i}`}
          className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl border px-1 py-2 ${fdrSurface(fx.fdr)}`}
          title={`${abbr("gw")} ${fx.event} ${fx.opponent} ${fx.home ? "home" : "away"} · ${abbr("fdr")} ${fx.fdr}`}
        >
          <ClubCrest
            code={fx.opponentCode}
            name={fx.opponentShort}
            className="h-7 w-7 object-contain"
          />
          <span className="max-w-full truncate text-[10px] font-semibold">
            {fx.opponentShort}
          </span>
          <span className="max-w-full break-words px-0.5 text-center text-[8px] leading-tight opacity-80">
            {fx.home ? abbr("home") : abbr("away")}
            <br />
            {abbr("fdr")} {fx.fdr}
          </span>
        </li>
      ))}
    </ol>
  );
}

function FormSpark({ matches }: { matches: RecentMatch[] }) {
  const chronological = [...matches].reverse();
  const max = Math.max(8, ...chronological.map((m) => m.points));
  return (
    <div className="rounded-xl border border-line bg-panel-2 px-3 py-3">
      <p className="mb-2 text-[10px] uppercase tracking-widest text-muted">Points trend</p>
      <div className="flex h-16 items-end gap-1">
        {chronological.map((m) => (
          <div
            key={`${m.fixtureId}-${m.round}`}
            className="flex min-w-0 flex-1 flex-col items-center gap-1"
            title={`${abbr("gw")} ${m.round} ${m.opponentShort} ${m.home ? abbr("home") : abbr("away")} · ${m.points} pts`}
          >
            <span
              className={`w-full max-w-[1.35rem] rounded-t ${sparkTone(m)}`}
              style={{
                height: `${Math.max(m.minutes === 0 ? 6 : 10, (m.points / max) * 100)}%`,
              }}
            />
            <span className="truncate text-[8px] text-muted">{m.opponentShort}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OutputVsXgi({ totals }: { totals: RecentTotals }) {
  const gi = totals.goals + totals.assists;
  const xgi = totals.xg + totals.xa;
  const max = Math.max(gi, xgi, 0.8);
  const delta = gi - xgi;
  return (
    <div className="mt-2 rounded-xl border border-line bg-panel-2 px-3 py-2.5">
      <p className="mb-2 text-[10px] uppercase tracking-widest text-muted">Output vs chance</p>
      <CompareRow label="G+A" value={gi.toFixed(0)} fill={gi / max} tone="accent" />
      <CompareRow label="xGI" value={formatXp(xgi)} fill={xgi / max} tone="muted" />
      <p className="mt-1.5 text-[11px] text-muted">
        {Math.abs(delta) < 0.4
          ? "Finishing matches the film."
          : delta > 0
            ? `Running hot by ${delta.toFixed(1)} — don't buy the overperformance.`
            : `${Math.abs(delta).toFixed(1)} xGI unused. Underlying is better than the points.`}
      </p>
    </div>
  );
}

function DefFloor({ totals, keeper }: { totals: RecentTotals; keeper: boolean }) {
  const n = Math.max(totals.matches, 1);
  return (
    <div className="mt-2 rounded-xl border border-line bg-panel-2 px-3 py-2.5">
      <p className="mb-2 text-[10px] uppercase tracking-widest text-muted">
        {keeper ? "Keeper floor" : "Defensive floor"}
      </p>
      <CompareRow
        label={abbr("cs")}
        value={`${totals.cleanSheets}/${totals.matches}`}
        fill={totals.cleanSheets / n}
        tone="accent"
      />
      {keeper ? (
        <CompareRow
          label="Saves"
          value={String(totals.saves)}
          fill={Math.min(1, totals.saves / (n * 4))}
          tone="muted"
        />
      ) : (
        <CompareRow
          label={abbr("defcon")}
          value={`${totals.defconHits}/${totals.matches}`}
          fill={totals.defconHits / n}
          tone="accent"
        />
      )}
    </div>
  );
}

function CompareRow({
  label,
  value,
  fill,
  tone,
}: {
  label: string;
  value: string;
  fill: number;
  tone: "accent" | "muted";
}) {
  return (
    <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_minmax(2.5rem,1fr)_auto] items-center gap-2">
      <span className="min-w-0 break-words text-[11px] leading-snug text-muted">
        {label}
      </span>
      <span className="h-1.5 overflow-hidden rounded-full bg-background/60">
        <span
          className={`block h-full rounded-full ${tone === "accent" ? "bg-accent" : "bg-muted"}`}
          style={{ width: `${Math.max(6, Math.min(100, fill * 100))}%` }}
        />
      </span>
      <span className="tabular text-right text-[11px]">{value}</span>
    </div>
  );
}

function MatchCard({ match: m, position }: { match: RecentMatch; position: number }) {
  const chips = matchChips(m, position);
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-line bg-panel-2/60 px-2.5 py-2">
      <ClubCrest
        code={m.opponentCode}
        name={m.opponentShort}
        className="h-8 w-8 shrink-0 object-contain"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium">
          {m.opponentShort}{" "}
          <span className="text-muted">{m.home ? abbr("home") : abbr("away")}</span>
          <span className="ml-1.5 tabular text-muted">{m.score}</span>
        </p>
        <p className="text-[10px] text-muted">
          {abbr("gw")} {m.round} · {m.minutes} min
          {m.started ? "" : m.minutes > 0 ? " · cameo" : " · DNP (did not play)"}
        </p>
        {chips.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {chips.map((chip) => (
              <span
                key={chip.label}
                className={`rounded px-1 py-px text-[9px] font-semibold ${chip.className}`}
              >
                {chip.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <p
        className={`tabular w-10 text-right text-lg font-semibold ${
          m.points >= 8 ? "text-accent" : m.points <= 2 ? "text-danger" : ""
        }`}
      >
        {m.points}
      </p>
    </div>
  );
}

function LastSeasonCard({
  season,
  position,
}: {
  season: NonNullable<PlayerRecent["lastSeason"]>;
  position: number;
}) {
  const extras =
    position === 1 || position === 2
      ? `${season.cleanSheets} ${abbr("cs")}`
      : `${season.goals}G ${season.assists}A`;
  return (
    <div className="mt-3 rounded-xl border border-line px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-widest text-muted">
        {season.season} prior
      </p>
      <p className="mt-1 text-sm">
        <span className="tabular font-semibold">{season.points}</span> pts
        <span className="text-muted"> · </span>
        {season.starts} starts
        <span className="text-muted"> · </span>
        {extras}
      </p>
    </div>
  );
}

function MatchSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <div className="h-20 animate-pulse rounded-xl bg-panel-2" />
      <div className="h-14 animate-pulse rounded-xl bg-panel-2" />
      <div className="h-14 animate-pulse rounded-xl bg-panel-2" />
    </div>
  );
}

function pickVerdict(player: RankedPlayer) {
  if (player.news) {
    return { label: "Flagged", className: "bg-warn/15 text-warn" };
  }
  if (player.pMinutes < 0.5) {
    return { label: "Minutes risk", className: "bg-danger/15 text-danger" };
  }
  if (player.xpThis >= 6.5 && (player.fdrThis == null || player.fdrThis <= 2)) {
    return { label: "Captain pick", className: "bg-accent/15 text-accent" };
  }
  if (player.xpThis >= 5.5) {
    return { label: "Captain watch", className: "bg-accent/10 text-accent" };
  }
  if (player.selectedBy < 8 && player.xpNext5 >= 18) {
    return { label: "Differential", className: "bg-accent/15 text-accent" };
  }
  if (player.selectedBy > 40) {
    return { label: "Template", className: "bg-panel-2 text-muted" };
  }
  return null;
}

function fdrHint(fdr: number | null) {
  if (fdr == null) return "Blank";
  if (fdr <= 2) return `${abbr("fdr")} ${fdr} · easy`;
  if (fdr >= 4) return `${abbr("fdr")} ${fdr} · tough`;
  return `${abbr("fdr")} ${fdr}`;
}

function formLabel(trend: ReturnType<typeof formTrend>, form: number, ppg: number) {
  const word =
    trend === "hot"
      ? "Hot"
      : trend === "up"
        ? "Rising"
        : trend === "down"
          ? "Cooling"
          : trend === "cold"
            ? "Cold"
            : "Steady";
  return `${word} · ${form.toFixed(1)} vs ${ppg.toFixed(1)}`;
}

function fdrSurface(fdr: number) {
  if (fdr >= 4) return "border-danger/30 bg-danger/10 text-danger";
  if (fdr <= 2) return "border-accent/30 bg-accent/10 text-accent";
  return "border-line bg-panel-2 text-muted";
}

function sparkTone(m: RecentMatch) {
  if (m.minutes === 0) return "bg-line";
  if (m.points >= 8) return "bg-accent";
  if (m.points <= 2) return "bg-danger/70";
  return "bg-muted";
}

function insightTone(line: string) {
  const lower = line.toLowerCase();
  if (
    lower.includes("nailed") ||
    lower.includes("haul") ||
    lower.includes("matches the film") ||
    lower.includes("real 2-pt")
  ) {
    return "border-accent/30 bg-accent/10 text-foreground/90";
  }
  if (
    lower.includes("running hot") ||
    lower.includes("volatility") ||
    lower.includes("don't buy") ||
    lower.includes("don't chase") ||
    lower.includes("cameo") ||
    lower.includes("low minutes") ||
    lower.includes("finishing cold")
  ) {
    return "border-warn/30 bg-warn/10 text-foreground/90";
  }
  return "border-line bg-panel-2 text-foreground/90";
}

function matchChips(m: RecentMatch, position: number) {
  const chips: Array<{ label: string; className: string }> = [];
  const good = "bg-accent/15 text-accent";
  const warn = "bg-warn/15 text-warn";
  const bad = "bg-danger/15 text-danger";
  if (m.goals) chips.push({ label: `${m.goals}G`, className: good });
  if (m.assists) chips.push({ label: `${m.assists}A`, className: good });
  if (m.cleanSheet && (position === 1 || position === 2)) {
    chips.push({ label: abbr("cs"), className: good });
  }
  if (m.defconHit) chips.push({ label: abbr("defcon"), className: good });
  if (position === 1 && m.saves) chips.push({ label: `${m.saves} sv`, className: good });
  if (m.bonus) chips.push({ label: `+${m.bonus}`, className: warn });
  if (m.yellow) chips.push({ label: abbr("yc"), className: warn });
  if (m.red) chips.push({ label: abbr("rc"), className: bad });
  if ((position === 1 || position === 2) && m.conceded > 0 && !m.cleanSheet) {
    chips.push({ label: `${m.conceded} ${abbr("gc")}`, className: bad });
  }
  return chips;
}

function headlineStats(position: number, totals: RecentTotals) {
  if (position === 1) {
    return [
      { label: `${totals.matches}G pts`, value: formatXp(totals.avgPoints) },
      { label: abbr("cs"), value: String(totals.cleanSheets) },
      { label: "Saves", value: String(totals.saves) },
      { label: abbr("gc"), value: String(totals.conceded) },
    ];
  }
  if (position === 2) {
    return [
      { label: `${totals.matches}G pts`, value: formatXp(totals.avgPoints) },
      { label: abbr("cs"), value: String(totals.cleanSheets) },
      { label: abbr("defcon"), value: `${totals.defconHits}/${totals.matches}` },
      { label: abbr("per90"), value: formatXp(totals.ptsPer90) },
    ];
  }
  return [
    { label: `${totals.matches}G pts`, value: formatXp(totals.avgPoints) },
    { label: abbr("per90"), value: formatXp(totals.ptsPer90) },
    { label: abbr("ga"), value: String(totals.goals + totals.assists) },
    { label: abbr("xgi"), value: formatXp(totals.xg + totals.xa) },
  ];
}
