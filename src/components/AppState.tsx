"use client";

import {
  parseIdList,
  type RankingsView,
  type TeamTab,
} from "@/lib/app-href";
import { readStoredTeamId } from "@/lib/team-id";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "fpl-win-session";

export type AppSession = {
  teamId: string | null;
  teamName: string | null;
  squadClubIds: number[];
  squadPlayerIds: number[];
  formation: string | null;
  teamTab: TeamTab;
  focusClubId: number | null;
  focusPlayerId: number | null;
  rankingsView: RankingsView | null;
  rankingsPos: 0 | 1 | 2 | 3 | 4;
  rankingsQ: string;
  rankingsClubIds: number[];
  builderLocked: number[];
  builderExcluded: number[];
};

const EMPTY: AppSession = {
  teamId: null,
  teamName: null,
  squadClubIds: [],
  squadPlayerIds: [],
  formation: null,
  teamTab: "play",
  focusClubId: null,
  focusPlayerId: null,
  rankingsView: null,
  rankingsPos: 0,
  rankingsQ: "",
  rankingsClubIds: [],
  builderLocked: [],
  builderExcluded: [],
};

type AppStateValue = AppSession & {
  hydrateTeam: (info: {
    id: string | number;
    name?: string;
    clubIds?: number[];
    playerIds?: number[];
    formation?: string | null;
  }) => void;
  setFocusClub: (id: number | null) => void;
  setFocusPlayer: (id: number | null) => void;
  setFormation: (formation: string | null) => void;
  setTeamTab: (tab: TeamTab) => void;
  setRankings: (patch: {
    view?: RankingsView | null;
    pos?: 0 | 1 | 2 | 3 | 4;
    q?: string;
    clubIds?: number[];
    playerId?: number | null;
  }) => void;
  setBuilder: (locked: number[], excluded: number[]) => void;
  applyPlanToBuilder: (opts: { keepIds: number[]; outIds: number[]; inIds: number[] }) => void;
};

const AppStateContext = createContext<AppStateValue | null>(null);

function unique(ids: number[]): number[] {
  return [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
}

function loadPersisted(): Partial<AppSession> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<AppSession>;
    return {
      teamName: typeof parsed.teamName === "string" ? parsed.teamName : null,
      squadClubIds: unique(parsed.squadClubIds ?? []),
      squadPlayerIds: unique(parsed.squadPlayerIds ?? []),
      formation: typeof parsed.formation === "string" ? parsed.formation : null,
      builderLocked: unique(parsed.builderLocked ?? []),
      builderExcluded: unique(parsed.builderExcluded ?? []),
    };
  } catch {
    return {};
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppSession>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStoredTeamId();
    const persisted = loadPersisted();
    setSession((current) => ({
      ...current,
      ...persisted,
      teamId: stored ?? persisted.teamId ?? current.teamId,
    }));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    const payload: Partial<AppSession> = {
      teamName: session.teamName,
      squadClubIds: session.squadClubIds,
      squadPlayerIds: session.squadPlayerIds,
      formation: session.formation,
      builderLocked: session.builderLocked,
      builderExcluded: session.builderExcluded,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    ready,
    session.teamName,
    session.squadClubIds,
    session.squadPlayerIds,
    session.formation,
    session.builderLocked,
    session.builderExcluded,
  ]);

  const hydrateTeam = useCallback<AppStateValue["hydrateTeam"]>((info) => {
    setSession((current) => ({
      ...current,
      teamId: String(info.id),
      teamName: info.name ?? current.teamName,
      squadClubIds: info.clubIds ? unique(info.clubIds) : current.squadClubIds,
      squadPlayerIds: info.playerIds ? unique(info.playerIds) : current.squadPlayerIds,
      formation: info.formation === undefined ? current.formation : info.formation,
    }));
  }, []);

  const setFocusClub = useCallback((id: number | null) => {
    setSession((current) => ({ ...current, focusClubId: id }));
  }, []);

  const setFocusPlayer = useCallback((id: number | null) => {
    setSession((current) => ({ ...current, focusPlayerId: id }));
  }, []);

  const setFormation = useCallback((formation: string | null) => {
    setSession((current) => ({ ...current, formation }));
  }, []);

  const setTeamTab = useCallback((tab: TeamTab) => {
    setSession((current) => ({ ...current, teamTab: tab }));
  }, []);

  const setRankings = useCallback<AppStateValue["setRankings"]>((patch) => {
    setSession((current) => ({
      ...current,
      rankingsView: patch.view === undefined ? current.rankingsView : patch.view,
      rankingsPos: patch.pos === undefined ? current.rankingsPos : patch.pos,
      rankingsQ: patch.q === undefined ? current.rankingsQ : patch.q,
      rankingsClubIds:
        patch.clubIds === undefined ? current.rankingsClubIds : unique(patch.clubIds),
      focusPlayerId:
        patch.playerId === undefined ? current.focusPlayerId : patch.playerId,
    }));
  }, []);

  const setBuilder = useCallback((locked: number[], excluded: number[]) => {
    setSession((current) => ({
      ...current,
      builderLocked: unique(locked),
      builderExcluded: unique(excluded),
    }));
  }, []);

  const applyPlanToBuilder = useCallback<AppStateValue["applyPlanToBuilder"]>(
    ({ keepIds, outIds, inIds }) => {
      const out = new Set(outIds);
      const locked = unique([...keepIds.filter((id) => !out.has(id)), ...inIds]);
      setSession((current) => ({
        ...current,
        builderLocked: locked,
        builderExcluded: unique(outIds),
      }));
    },
  []);

  const value = useMemo<AppStateValue>(
    () => ({
      ...session,
      hydrateTeam,
      setFocusClub,
      setFocusPlayer,
      setFormation,
      setTeamTab,
      setRankings,
      setBuilder,
      applyPlanToBuilder,
    }),
    [
      session,
      hydrateTeam,
      setFocusClub,
      setFocusPlayer,
      setFormation,
      setTeamTab,
      setRankings,
      setBuilder,
      applyPlanToBuilder,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return value;
}

export function useAppStateOptional(): AppStateValue | null {
  return useContext(AppStateContext);
}

export function idsFromSearch(raw: string | null | undefined, fallback: number[]): number[] {
  const parsed = parseIdList(raw);
  return parsed.length > 0 ? parsed : fallback;
}
