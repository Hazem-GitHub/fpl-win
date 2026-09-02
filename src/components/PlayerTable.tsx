"use client";

import { Abbr } from "@/components/Abbr";
import { useAppState } from "@/components/AppState";
import { parseIdList, parseRankingsView } from "@/lib/app-href";
import { ABBR } from "@/lib/abbr";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ElementTypeId, FplTeam } from "@/lib/fpl/types";
import { POS_SHORT } from "@/lib/fpl/rules";
import { formatPct, formatPrice, formatXp, xpGradeClass } from "@/lib/format";
import type { RankedPlayer } from "@/lib/xp/model";
import { ClubCrest } from "./ClubCrest";
import { FixtureStrip } from "./FixtureStrip";
import { Icon, IconLabel } from "./Icon";
import { PlayerProfile } from "./PlayerProfile";
import { PlayerTile, PosChip } from "./PlayerTile";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  CalendarRange,
  ChevronsUpDown,
  Coins,
  Crown,
  Gem,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

type SortKey =
  | "xpThis"
  | "xpNext3"
  | "xpNext5"
  | "cost"
  | "selectedBy"
  | "form"
  | "value"
  | "pMinutes";

type QuickView = "gw" | "next5" | "captain" | "value" | "diff";
type PriceBand = "any" | "lte45" | "lte70" | "mid" | "prem";
type MinsFilter = "any" | "start" | "rotate";
type FdrFilter = "any" | "easy" | "mid" | "hard";
type OwnFilter = "any" | "template" | "diff" | "ultra";

const VIEWS: { id: QuickView; label: string; hint: string; icon: LucideIcon }[] = [
  { id: "gw", label: ABBR.thisGw.short, hint: `Best ${ABBR.xp.short} this week`, icon: Calendar },
  { id: "next5", label: "Next 5", hint: "Horizon haul", icon: CalendarRange },
  { id: "captain", label: "Captains", hint: `Likely starters, ${ABBR.xpGw.short}`, icon: Crown },
  { id: "value", label: "Value", hint: "Points per million, ≤ £7.0m", icon: Coins },
  { id: "diff", label: "Diff", hint: "Under 10% owned", icon: Gem },
];

const POS_PILLS: { id: 0 | ElementTypeId; label: string; hint: string }[] = [
  { id: 0, label: "All", hint: "All positions" },
  { id: 1, label: ABBR.gk.short, hint: ABBR.gk.long },
  { id: 2, label: ABBR.def.short, hint: ABBR.def.long },
  { id: 3, label: ABBR.mid.short, hint: ABBR.mid.long },
  { id: 4, label: ABBR.fwd.short, hint: ABBR.fwd.long },
];

const PRICE_BANDS: { id: PriceBand; label: string }[] = [
  { id: "any", label: "Any" },
  { id: "lte45", label: "≤4.5" },
  { id: "lte70", label: "≤7.0" },
  { id: "mid", label: "7–10" },
  { id: "prem", label: "10+" },
];

function riskClass(p: RankedPlayer): string {
  if (p.status !== "a" || p.pMinutes < 0.45) return "text-danger";
  if (p.pMinutes < 0.7) return "text-warn";
  return "text-accent";
}

function matchesPrice(cost: number, band: PriceBand): boolean {
  if (band === "any") return true;
  if (band === "lte45") return cost <= 45;
  if (band === "lte70") return cost <= 70;
  if (band === "mid") return cost > 70 && cost <= 100;
  return cost > 100;
}

function matchesFdr(player: RankedPlayer, fdr: FdrFilter): boolean {
  if (fdr === "any") return true;
  const rating = player.fdrThis;
  if (rating == null) return false;
  if (fdr === "easy") return rating <= 2;
  if (fdr === "hard") return rating >= 4;
  return rating === 3;
}

function viewPreset(view: QuickView | null): {
  sort: SortKey;
  dir: "desc" | "asc";
  price: PriceBand;
  mins: MinsFilter;
  own: OwnFilter;
} {
  if (view === "next5") {
    return { sort: "xpNext5", dir: "desc", price: "any", mins: "any", own: "any" };
  }
  if (view === "captain") {
    return { sort: "xpThis", dir: "desc", price: "any", mins: "start", own: "any" };
  }
  if (view === "value") {
    return { sort: "value", dir: "desc", price: "lte70", mins: "start", own: "any" };
  }
  if (view === "diff") {
    return { sort: "xpThis", dir: "desc", price: "any", mins: "start", own: "diff" };
  }
  return { sort: "xpThis", dir: "desc", price: "any", mins: "any", own: "any" };
}

export function PlayerTable({
  players,
  teams,
}: {
  players: RankedPlayer[];
  teams: FplTeam[];
}) {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-panel" />}>
      <PlayerTableInner players={players} teams={teams} />
    </Suspense>
  );
}

function PlayerTableInner({
  players,
  teams,
}: {
  players: RankedPlayer[];
  teams: FplTeam[];
}) {
  const searchParams = useSearchParams();
  const { setRankings, setFocusPlayer } = useAppState();
  const urlView = parseRankingsView(searchParams.get("view"));
  const urlPosRaw = Number.parseInt(searchParams.get("pos") ?? "", 10);
  const urlPos: 0 | ElementTypeId =
    urlPosRaw >= 1 && urlPosRaw <= 4 ? (urlPosRaw as ElementTypeId) : 0;
  const urlClubs = parseIdList(searchParams.get("club"));
  const urlQ = searchParams.get("q") ?? "";
  const urlPlayer = Number.parseInt(searchParams.get("player") ?? "", 10);
  const focusId = Number.isFinite(urlPlayer) && urlPlayer > 0 ? urlPlayer : null;
  const preset = viewPreset(urlView ?? "gw");

  const [q, setQ] = useState(urlQ);
  const [pos, setPos] = useState<ElementTypeId | 0>(urlPos);
  const [clubIds, setClubIds] = useState<number[]>(urlClubs);
  const [price, setPrice] = useState<PriceBand>(preset.price);
  const [mins, setMins] = useState<MinsFilter>(preset.mins);
  const [fdr, setFdr] = useState<FdrFilter>("any");
  const [own, setOwn] = useState<OwnFilter>(preset.own);
  const [availableOnly, setAvailableOnly] = useState(focusId ? false : true);
  const [view, setView] = useState<QuickView | null>(urlView ?? "gw");
  const [sort, setSort] = useState<SortKey>(preset.sort);
  const [dir, setDir] = useState<"desc" | "asc">(preset.dir);
  const [open, setOpen] = useState<RankedPlayer | null>(
    () => players.find((p) => p.id === focusId) ?? null,
  );

  const clubs = useMemo(
    () => [...teams].sort((a, b) => a.short_name.localeCompare(b.short_name)),
    [teams],
  );

  useEffect(() => {
    setRankings({
      view,
      pos,
      q,
      clubIds,
      playerId: open?.id ?? focusId,
    });
  }, [setRankings, view, pos, q, clubIds, open?.id, focusId]);

  useEffect(() => {
    if (!focusId) return;
    const row = document.querySelector(`[data-player-id="${focusId}"]`);
    row?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focusId]);

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const clubSet = new Set(clubIds);
    const filtered = players.filter((p) => {
      if (pos && p.position !== pos) return false;
      if (clubSet.size > 0 && !clubSet.has(p.teamId)) return false;
      if (!matchesPrice(p.cost, price)) return false;
      if (!matchesFdr(p, fdr)) return false;
      if (mins === "start" && (p.status !== "a" || p.pMinutes < 0.7)) return false;
      if (mins === "rotate" && (p.pMinutes < 0.35 || p.pMinutes >= 0.7)) return false;
      if (own === "template" && p.selectedBy < 20) return false;
      if (own === "diff" && p.selectedBy >= 10) return false;
      if (own === "ultra" && p.selectedBy >= 5) return false;
      if (availableOnly && (p.status === "u" || p.status === "n" || p.pMinutes < 0.12)) {
        return false;
      }
      if (
        query &&
        !`${p.webName} ${p.firstName} ${p.secondName} ${p.team} ${p.teamShort} ${p.positionShort}`
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }
      return true;
    });
    filtered.sort((a, b) => {
      const av = a[sort];
      const bv = b[sort];
      return dir === "desc" ? bv - av : av - bv;
    });
    return filtered;
  }, [players, q, pos, clubIds, price, mins, fdr, own, availableOnly, sort, dir]);

  const filtered = 
    q.trim() !== "" ||
    pos !== 0 ||
    clubIds.length > 0 ||
    price !== "any" ||
    mins !== "any" ||
    fdr !== "any" ||
    own !== "any" ||
    !availableOnly ||
    view !== "gw" ||
    sort !== "xpThis" ||
    dir !== "desc";

  function applyView(next: QuickView) {
    const presetNext = viewPreset(next);
    setView(next);
    setQ("");
    setPos(0);
    setClubIds([]);
    setFdr("any");
    setAvailableOnly(true);
    setSort(presetNext.sort);
    setDir(presetNext.dir);
    setPrice(presetNext.price);
    setMins(presetNext.mins);
    setOwn(presetNext.own);
  }

  function reset() {
    applyView("gw");
  }

  function toggleClub(id: number) {
    setView(null);
    setClubIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  function toggleSort(key: SortKey) {
    setView(null);
    if (sort === key) setDir(dir === "desc" ? "asc" : "desc");
    else {
      setSort(key);
      setDir("desc");
    }
  }

  const th = (key: SortKey, label: ReactNode) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      <Icon
        icon={sort === key ? (dir === "desc" ? ArrowDown : ArrowUp) : ChevronsUpDown}
        size="xs"
        className={sort === key ? "text-foreground" : "opacity-40"}
      />
    </button>
  );

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (pos) {
    chips.push({
      key: "pos",
      label: POS_SHORT[pos] === "GKP" ? "GK" : POS_SHORT[pos],
      clear: () => setPos(0),
    });
  }
  if (price !== "any") {
    chips.push({
      key: "price",
      label: PRICE_BANDS.find((b) => b.id === price)?.label ?? price,
      clear: () => setPrice("any"),
    });
  }
  if (mins === "start") chips.push({ key: "mins", label: ABBR.likelyXi.short, clear: () => setMins("any") });
  if (mins === "rotate") chips.push({ key: "mins", label: "Rotation", clear: () => setMins("any") });
  if (fdr === "easy") chips.push({ key: "fdr", label: `Easy ${ABBR.fdr.short}`, clear: () => setFdr("any") });
  if (fdr === "mid") chips.push({ key: "fdr", label: `${ABBR.fdr.short} 3`, clear: () => setFdr("any") });
  if (fdr === "hard") chips.push({ key: "fdr", label: `Tough ${ABBR.fdr.short}`, clear: () => setFdr("any") });
  if (own === "template") chips.push({ key: "own", label: "Template ≥20%", clear: () => setOwn("any") });
  if (own === "diff") chips.push({ key: "own", label: "Diff <10%", clear: () => setOwn("any") });
  if (own === "ultra") chips.push({ key: "own", label: "Ultra <5%", clear: () => setOwn("any") });
  if (!availableOnly) {
    chips.push({ key: "flag", label: "Including flagged", clear: () => setAvailableOnly(true) });
  }
  for (const id of clubIds) {
    const club = clubs.find((c) => c.id === id);
    chips.push({
      key: `club-${id}`,
      label: club?.short_name ?? String(id),
      clear: () => toggleClub(id),
    });
  }
  if (q.trim()) {
    chips.push({ key: "q", label: `“${q.trim()}”`, clear: () => setQ("") });
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="space-y-2 rounded-xl border border-line bg-background/90 p-2.5 shadow-sm md:sticky md:top-16 md:z-20 md:backdrop-blur-md">
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search players</span>
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
              <Icon icon={Search} size="sm" />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-lg border border-line bg-panel py-1.5 pl-8 pr-3 text-sm outline-none ring-accent/40 placeholder:text-muted focus:ring-2"
              placeholder="Name, club, position"
            />
          </label>
          <p className="shrink-0 tabular text-[11px] text-muted">
            <span className="font-semibold text-foreground">{rows.length}</span>
            <span className="text-muted">/{players.length}</span>
          </p>
          {filtered ? (
            <button
              type="button"
              onClick={reset}
              className="shrink-0 rounded-md border border-line px-2 py-1 text-[11px] text-muted hover:text-foreground"
            >
              <IconLabel icon={RotateCcw} size="xs">
                Reset
              </IconLabel>
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.hint}
              onClick={() => applyView(item.id)}
              className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${
                view === item.id
                  ? "bg-accent text-on-accent"
                  : "bg-panel-2 text-muted hover:text-foreground"
              }`}
            >
              <Icon icon={item.icon} size="xs" />
              {item.label}
            </button>
          ))}
          <span className="hidden h-4 w-px bg-line sm:block" aria-hidden />
          {POS_PILLS.map((item) => (
            <button
              key={item.id}
              type="button"
              title={item.hint}
              onClick={() => {
                setPos(item.id);
                setView(null);
              }}
              className={`inline-flex min-w-8 items-center justify-center rounded-md px-2 py-1 text-[11px] font-semibold ${
                pos === item.id
                  ? "bg-accent text-on-accent"
                  : "bg-panel-2 text-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <Seg label="£" title="Price">
            {PRICE_BANDS.map((band) => (
              <SegBtn
                key={band.id}
                active={price === band.id}
                title={band.id === "any" ? "Any price" : `£${band.label}m`}
                onClick={() => {
                  setView(null);
                  setPrice(band.id);
                }}
              >
                {band.label}
              </SegBtn>
            ))}
          </Seg>
          <Seg label={ABBR.mins.short} title={ABBR.mins.long}>
            <SegBtn active={mins === "any"} onClick={() => { setMins("any"); setView(null); }}>
              Any
            </SegBtn>
            <SegBtn
              active={mins === "start"}
              title={ABBR.likelyXi.long}
              onClick={() => { setMins("start"); setView(null); }}
            >
              {ABBR.xi.short}
            </SegBtn>
            <SegBtn
              active={mins === "rotate"}
              title="Rotation risk"
              onClick={() => { setMins("rotate"); setView(null); }}
            >
              Rot
            </SegBtn>
          </Seg>
          <Seg label={ABBR.fdr.short} title={ABBR.fdr.long}>
            <SegBtn active={fdr === "any"} onClick={() => { setFdr("any"); setView(null); }}>
              Any
            </SegBtn>
            <SegBtn
              active={fdr === "easy"}
              tone="easy"
              title="Easy fixture, FDR ≤ 2"
              onClick={() => { setFdr("easy"); setView(null); }}
            >
              Easy
            </SegBtn>
            <SegBtn
              active={fdr === "mid"}
              title={`${ABBR.fdr.short} 3`}
              onClick={() => { setFdr("mid"); setView(null); }}
            >
              3
            </SegBtn>
            <SegBtn
              active={fdr === "hard"}
              tone="hard"
              title="Tough fixture, FDR ≥ 4"
              onClick={() => { setFdr("hard"); setView(null); }}
            >
              Hard
            </SegBtn>
          </Seg>
          <Seg label={ABBR.sel.short} title={ABBR.sel.long}>
            <SegBtn active={own === "any"} onClick={() => { setOwn("any"); setView(null); }}>
              Any
            </SegBtn>
            <SegBtn
              active={own === "template"}
              title="Template, 20%+ owned"
              onClick={() => { setOwn("template"); setView(null); }}
            >
              ≥20%
            </SegBtn>
            <SegBtn
              active={own === "diff"}
              title="Differential, under 10% owned"
              onClick={() => { setOwn("diff"); setView(null); }}
            >
              &lt;10%
            </SegBtn>
            <SegBtn
              active={own === "ultra"}
              title="Ultra differential, under 5% owned"
              onClick={() => { setOwn("ultra"); setView(null); }}
            >
              &lt;5%
            </SegBtn>
          </Seg>
          <Seg label="Show" title="Availability">
            <SegBtn
              active={availableOnly}
              title="Hide unavailable players and tiny minutes"
              onClick={() => setAvailableOnly((on) => !on)}
            >
              Avail
            </SegBtn>
          </Seg>
        </div>

        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-muted">
            Club{clubIds.length ? ` · ${clubIds.length}` : ""}
          </span>
          <div className="hide-scroll flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
            {clubs.map((club) => {
              const on = clubIds.includes(club.id);
              return (
                <button
                  key={club.id}
                  type="button"
                  title={club.name}
                  onClick={() => toggleClub(club.id)}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                    on
                      ? "border-accent bg-accent/15 ring-1 ring-accent"
                      : "border-transparent hover:border-line hover:bg-panel-2"
                  }`}
                >
                  <ClubCrest
                    code={club.code}
                    name={club.short_name}
                    className="h-5 w-5 object-contain"
                  />
                </button>
              );
            })}
          </div>
        </div>

        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                className="inline-flex items-center gap-0.5 rounded-md bg-panel-2 px-1.5 py-0.5 text-[10px] text-foreground hover:bg-danger/15 hover:text-danger"
              >
                {chip.label}
                <Icon icon={X} size="xs" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-panel px-4 py-10 text-center">
          <p className="text-sm font-medium">No players match those filters.</p>
          <p className="mt-1 text-xs text-muted">
            Loosen {ABBR.fdr.short}, minutes, or price — or reset to {ABBR.thisGw.short}.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-medium text-on-accent"
          >
            <Icon icon={RotateCcw} size="xs" />
            Reset filters
          </button>
        </div>
      ) : (
        <div className="min-w-0 overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-panel-2 text-xs tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Player</th>
                <th className="px-3 py-2 font-medium">{th("cost", "£")}</th>
                <th className="px-3 py-2 font-medium">{th("xpThis", <Abbr of="xpGw" />)}</th>
                <th className="px-3 py-2 font-medium">{th("xpNext5", <Abbr of="xp5" />)}</th>
                <th className="px-3 py-2 font-medium">{th("selectedBy", <Abbr of="sel" />)}</th>
                <th className="px-3 py-2 font-medium">{th("pMinutes", <Abbr of="mins" />)}</th>
                <th className="px-3 py-2 font-medium">Fixtures</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  data-player-id={p.id}
                  onClick={() => {
                    setOpen(p);
                    setFocusPlayer(p.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpen(p);
                    }
                  }}
                  tabIndex={0}
                  className={`cursor-pointer border-t border-line/70 odd:bg-panel even:bg-background hover:bg-panel-2 ${
                    p.id === (open?.id ?? focusId) ? "bg-accent/10 even:bg-accent/10" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <PlayerTile player={p} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className="truncate">{p.webName}</span>
                          <PosChip player={p} />
                        </div>
                        <div className="text-[11px] text-muted">{p.teamShort}</div>
                      </div>
                    </div>
                  </td>
                  <td className="tabular px-3 py-2">{formatPrice(p.cost)}</td>
                  <td className={`tabular px-3 py-2 font-medium ${xpGradeClass(p.xpThis)}`}>
                    {formatXp(p.xpThis)}
                  </td>
                  <td className="tabular px-3 py-2">{formatXp(p.xpNext5)}</td>
                  <td className="tabular px-3 py-2">{formatPct(p.selectedBy)}</td>
                  <td className={`tabular px-3 py-2 ${riskClass(p)}`}>
                    {Math.round(p.pMinutes * 100)}%
                  </td>
                  <td className="px-3 py-2">
                    <FixtureStrip player={p} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <PlayerProfile
          player={open}
          onClose={() => {
            setOpen(null);
            setFocusPlayer(null);
          }}
        />
      ) : null}
    </div>
  );
}

function Seg({
  label,
  title,
  children,
}: {
  label: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <span
        className="text-[9px] font-semibold uppercase tracking-wider text-muted"
        title={title ?? label}
      >
        {label}
      </span>
      <div className="inline-flex rounded-md bg-panel-2 p-0.5">{children}</div>
    </div>
  );
}

function SegBtn({
  active,
  onClick,
  children,
  title,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
  tone?: "easy" | "hard";
}) {
  const on =
    active && tone === "easy"
      ? "bg-accent/20 text-accent"
      : active && tone === "hard"
        ? "bg-danger/15 text-danger"
        : active
          ? "bg-panel text-foreground shadow-sm"
          : "text-muted hover:text-foreground";
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${on}`}
    >
      {children}
    </button>
  );
}
