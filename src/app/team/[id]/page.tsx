import { IconLabel } from "@/components/Icon";
import { TeamIdForm } from "@/components/TeamIdForm";
import { TeamWorkspace } from "@/components/TeamWorkspace";
import { adviseTeam } from "@/lib/advice";
import { deadlineLabel } from "@/lib/format";
import { getSnapshot } from "@/lib/snapshot";
import { RotateCcw } from "lucide-react";
import Link from "next/link";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entryId = Number.parseInt(id, 10);
  if (!Number.isFinite(entryId) || entryId <= 0) {
    return (
      <p className="text-sm text-danger">
        Invalid Team ID.{" "}
        <Link href="/team" className="text-accent">
          <IconLabel icon={RotateCcw} size="xs">
            Try again
          </IconLabel>
        </Link>
      </p>
    );
  }

  const snapshot = await getSnapshot();
  let advice;
  try {
    advice = await adviseTeam(entryId, snapshot);
  } catch {
    return (
      <div className="space-y-3">
        <p className="text-sm text-danger">
          Could not load team {entryId}. Check the ID on the FPL site.
        </p>
        <TeamIdForm />
      </div>
    );
  }

  const { bestPlan, holdPlan, plans } = advice;

  return (
    <TeamWorkspace
      entryId={entryId}
      manager={advice.manager}
      teamName={advice.teamName}
      pulse={advice.pulse}
      freeTransfers={advice.freeTransfers}
      gameweekName={snapshot.upcoming.name}
      gameweekId={snapshot.upcoming.id}
      deadline={
        snapshot.upcoming.deadline_time
          ? deadlineLabel(snapshot.upcoming.deadline_time)
          : null
      }
      bestPlan={bestPlan}
      holdPlan={holdPlan}
      plans={plans}
      picked={advice.picked}
      picksLive={advice.picksLive}
      chips={advice.chips}
      chipPlays={advice.chipPlays}
      activeChip={advice.activeChip}
      squad={advice.squad}
      madeMoves={advice.madeMoves}
      captainId={advice.captainId}
      viceId={advice.viceId}
    />
  );
}
