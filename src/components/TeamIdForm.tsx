"use client";

import { IconLabel } from "@/components/Icon";
import { useAppStateOptional } from "@/components/AppState";
import {
  formatTeamId,
  isValidTeamId,
  normalizeTeamId,
  readStoredTeamId,
  rememberTeamId,
} from "@/lib/team-id";
import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function TeamIdForm({
  initialId,
  compact = false,
}: {
  initialId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const app = useAppStateOptional();
  const [id, setId] = useState(initialId ?? "");

  useEffect(() => {
    if (initialId && isValidTeamId(initialId)) {
      const clean = normalizeTeamId(initialId);
      rememberTeamId(clean);
      setId(clean);
      return;
    }
    const stored = readStoredTeamId();
    if (stored) setId(stored);
  }, [initialId]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = normalizeTeamId(id);
    if (!isValidTeamId(clean)) return;
    rememberTeamId(clean);
    app?.hydrateTeam({ id: clean });
    router.push(`/team/${clean}`);
  }

  const preview = isValidTeamId(id) ? formatTeamId(id) : "";

  return (
    <form
      onSubmit={submit}
      className={compact ? "flex flex-col gap-2" : "flex flex-col gap-3"}
    >
      <div className={compact ? "flex gap-2" : "flex flex-col gap-3 sm:flex-row"}>
        <input
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          value={id}
          onChange={(e) => setId(normalizeTeamId(e.target.value))}
          placeholder="FPL Team ID"
          aria-label="FPL Team ID"
          className="w-full rounded-md border border-line bg-panel-2 px-3 py-2 text-sm tabular outline-none ring-accent/40 placeholder:text-muted focus:ring-2 sm:w-56"
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent/90"
        >
          <IconLabel icon={Download} size="sm">
            Load squad
          </IconLabel>
        </button>
      </div>
      <p className="text-xs text-muted">
        {preview ? (
          <>
            Remembered as{" "}
            <span className="tabular font-medium text-foreground">{preview}</span>
            {" · "}kept on this device for a week
          </>
        ) : (
          "We’ll keep this ID on this device for a week so My team opens the same squad."
        )}
      </p>
    </form>
  );
}
