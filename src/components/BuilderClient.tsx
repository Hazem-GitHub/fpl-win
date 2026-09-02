"use client";

import { useAppState, idsFromSearch } from "@/components/AppState";
import { Jump } from "@/components/Jump";
import { teamHref } from "@/lib/app-href";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { SquadPlan } from "@/lib/optimize/squad";
import { rankFormations } from "@/lib/optimize/lineup";
import { abbr } from "@/lib/abbr";
import { formatPrice, formatXp } from "@/lib/format";
import type { RankedPlayer } from "@/lib/xp/model";
import { Icon } from "./Icon";
import { FormationBoard } from "./FormationBoard";
import { PlayerTile, PosChip } from "./PlayerTile";
import { Ban, Lock, LockOpen, RotateCcw, Search, Shirt } from "lucide-react";

export function BuilderClient({
  players,
  initial,
  gameweek,
}: {
  players: RankedPlayer[];
  initial: SquadPlan;
  gameweek: number;
}) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-panel" />}>
      <BuilderInner players={players} initial={initial} gameweek={gameweek} />
    </Suspense>
  );
}

function BuilderInner({
  players,
  initial,
  gameweek,
}: {
  players: RankedPlayer[];
  initial: SquadPlan;
  gameweek: number;
}) {
  const searchParams = useSearchParams();
  const app = useAppState();
  const bootLock = idsFromSearch(searchParams.get("lock"), app.builderLocked);
  const bootBan = idsFromSearch(searchParams.get("ban"), app.builderExcluded);
  const [locked, setLocked] = useState<number[]>(bootLock);
  const [excluded, setExcluded] = useState<number[]>(bootBan);
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const seeded = useRef(false);

  const selected = useMemo(
    () => new Set(plan.squad.map((p) => p.id)),
    [plan.squad],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return players
      .filter((p) => `${p.webName} ${p.team}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [players, query]);

  function rebuild(nextLocked = locked, nextExcluded = excluded) {
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lockedIds: nextLocked,
          excludedIds: nextExcluded,
          budget: 1000,
          horizon: 5,
        }),
      });
      if (!res.ok) {
        setError("Optimizer failed. Try fewer locks.");
        return;
      }
      const data = (await res.json()) as SquadPlan;
      setPlan(data);
    });
  }

  function lockPlayer(id: number) {
    const next = locked.includes(id)
      ? locked.filter((x) => x !== id)
      : [...locked.filter((x) => x !== id), id];
    const nextEx = excluded.filter((x) => x !== id);
    setLocked(next);
    setExcluded(nextEx);
    rebuild(next, nextEx);
  }

  function banPlayer(id: number) {
    const next = excluded.includes(id)
      ? excluded.filter((x) => x !== id)
      : [...excluded, id];
    const nextLock = locked.filter((x) => x !== id);
    setExcluded(next);
    setLocked(nextLock);
    rebuild(nextLock, next);
  }

  useEffect(() => {
    const fromUrl = Boolean(searchParams.get("lock") || searchParams.get("ban"));
    if (fromUrl) {
      if (!seeded.current && (bootLock.length > 0 || bootBan.length > 0)) {
        seeded.current = true;
        rebuild(bootLock, bootBan);
      }
      return;
    }
    if (seeded.current) return;
    if (app.builderLocked.length > 0 || app.builderExcluded.length > 0) {
      seeded.current = true;
      setLocked(app.builderLocked);
      setExcluded(app.builderExcluded);
      rebuild(app.builderLocked, app.builderExcluded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.builderLocked, app.builderExcluded]);

  const skipSync = useRef(true);
  useEffect(() => {
    if (skipSync.current) {
      skipSync.current = false;
      return;
    }
    app.setBuilder(locked, excluded);
  }, [app.setBuilder, locked, excluded]);

  const namedLocks = locked
    .map((id) => players.find((p) => p.id === id)?.webName)
    .filter(Boolean);
  const namedBans = excluded
    .map((id) => players.find((p) => p.id === id)?.webName)
    .filter(Boolean);

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-3">
        {namedLocks.length > 0 || namedBans.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/8 px-3 py-2 text-xs">
            <p className="font-medium">
              {namedLocks.length
                ? `Locked ${namedLocks.slice(0, 4).join(", ")}${namedLocks.length > 4 ? ` +${namedLocks.length - 4}` : ""}`
                : "No locks"}
              {namedBans.length ? ` · banned ${namedBans.join(", ")}` : ""}
            </p>
            {app.teamId ? (
              <Jump href={teamHref(app.teamId, "play")} icon={Shirt}>
                Back to this week
              </Jump>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>
            Cost{" "}
            <strong className="tabular text-accent">{formatPrice(plan.cost)}</strong>
          </span>
          <span className="text-muted">Bank {formatPrice(plan.bank)}</span>
          <span>
            {abbr("xiXp")} <strong className="tabular">{formatXp(plan.lineup.xp)}</strong>
          </span>
          <span className="text-muted">
            {plan.lineup.formation} · {plan.solver}
          </span>
          {pending ? <span className="text-warn">Solving…</span> : null}
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <FormationBoard
          key={plan.squad.map((p) => p.id).join("-")}
          options={rankFormations(plan.squad)}
          gameweek={gameweek}
          compact
        />
        <div className="flex flex-wrap gap-2">
          {plan.squad.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => lockPlayer(p.id)}
              className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-xs ${
                locked.includes(p.id)
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-line text-muted"
              }`}
            >
              <PlayerTile player={p} size="xs" />
              <Icon icon={locked.includes(p.id) ? Lock : LockOpen} size="xs" />
              {locked.includes(p.id) ? "Locked" : "Lock"} {p.webName}
            </button>
          ))}
        </div>
      </div>

      <aside className="min-w-0 space-y-4 rounded-xl border border-line bg-panel p-4 xl:sticky xl:top-20 xl:self-start">
        <h2 className="text-sm font-semibold">Force / exclude</h2>
        <label className="relative block">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <Icon icon={Search} size="sm" />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search to lock or ban"
            className="w-full rounded-md border border-line bg-panel-2 py-2 pl-9 pr-3 text-sm"
          />
        </label>
        <ul className="space-y-2">
          {matches.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <PlayerTile player={p} size="sm" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{p.webName}</span>
                    <PosChip player={p} />
                    {selected.has(p.id) ? (
                      <span className="text-[10px] text-accent">in</span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted">
                    {p.teamShort} · {formatPrice(p.cost)}
                  </span>
                </span>
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  onClick={() => lockPlayer(p.id)}
                  className="inline-flex items-center gap-1 rounded border border-line px-2 py-0.5 text-[11px]"
                >
                  <Icon icon={Lock} size="xs" />
                  Lock
                </button>
                <button
                  type="button"
                  onClick={() => banPlayer(p.id)}
                  className="inline-flex items-center gap-1 rounded border border-line px-2 py-0.5 text-[11px] text-danger"
                >
                  <Icon icon={Ban} size="xs" />
                  Ban
                </button>
              </span>
            </li>
          ))}
        </ul>
        {excluded.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {excluded.map((id) => {
              const player = players.find((p) => p.id === id);
              if (!player) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => banPlayer(id)}
                  className="flex items-center gap-1.5 rounded-full border border-danger/40 py-1 pl-1 pr-2 text-xs text-danger"
                >
                  <PlayerTile player={player} size="xs" />
                  <Icon icon={Ban} size="xs" />
                  {player.webName}
                </button>
              );
            })}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setLocked([]);
            setExcluded([]);
            app.setBuilder([], []);
            rebuild([], []);
          }}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-line px-3 py-2 text-sm text-muted hover:text-foreground"
        >
          <Icon icon={RotateCcw} size="sm" />
          Reset constraints
        </button>
      </aside>
    </div>
  );
}
