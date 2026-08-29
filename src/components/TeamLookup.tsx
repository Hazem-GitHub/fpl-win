"use client";

import { TeamIdForm } from "./TeamIdForm";
import { formatTeamId, readStoredTeamId } from "@/lib/team-id";
import Link from "next/link";
import { useEffect, useState } from "react";

export function TeamLookup() {
  const [remembered, setRemembered] = useState<string | null>(null);

  useEffect(() => {
    setRemembered(readStoredTeamId());
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-line bg-panel p-6">
      <h1 className="text-xl font-semibold">Load your FPL squad</h1>
      <p className="text-sm leading-6 text-muted">
        Your Team ID is public. On the FPL site it is the number in the URL when
        you open Points, e.g.{" "}
        <code className="text-foreground">/entry/1234567/event/2</code>.
        We keep the last ID on this device for a week so My team opens the same
        squad.
      </p>
      {remembered ? (
        <p className="rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm">
          Last used{" "}
          <span className="tabular font-semibold">{formatTeamId(remembered)}</span>
          {" · "}
          <Link href={`/team/${remembered}`} className="text-accent">
            Open it
          </Link>
        </p>
      ) : null}
      <TeamIdForm />
    </div>
  );
}
