import Link from "next/link";
import { IconLabel } from "@/components/Icon";
import { MatchBoard } from "@/components/MatchBoard";
import { PlayerLeadList } from "@/components/PlayerLeadList";
import { PlayerTile } from "@/components/PlayerTile";
import { TeamIdForm } from "@/components/TeamIdForm";
import { WeekDecision } from "@/components/WeekDecision";
import { adviseTeam } from "@/lib/advice";
import { playersHref } from "@/lib/app-href";
import { deadlineLabel } from "@/lib/format";
import { getMatchBoard } from "@/lib/matches";
import { rankFormations } from "@/lib/optimize/lineup";
import { getSnapshot } from "@/lib/snapshot";
import { isValidTeamId, TEAM_ID_COOKIE } from "@/lib/team-id";
import { BarChart3, Coins, Crown, Wrench } from "lucide-react";
import { cookies } from "next/headers";

export default async function HomePage() {
  const stored = (await cookies()).get(TEAM_ID_COOKIE)?.value;
  const teamId =
    stored && isValidTeamId(stored) ? Number.parseInt(stored, 10) : null;

  const snapshot = await getSnapshot();
  const [matches, advice] = await Promise.all([
    getMatchBoard(),
    teamId && Number.isFinite(teamId)
      ? adviseTeam(teamId, snapshot).catch(() => null)
      : Promise.resolve(null),
  ]);

  const captains = [...snapshot.players]
    .filter((p) => p.pMinutes >= 0.6)
    .sort((a, b) => b.xpThis - a.xpThis)
    .slice(0, 6);
  const value = [...snapshot.players]
    .filter((p) => p.pMinutes >= 0.55 && p.cost <= 70)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  const deadline = snapshot.upcoming.deadline_time
    ? deadlineLabel(snapshot.upcoming.deadline_time)
    : null;

  return (
    <div className="space-y-8">
      <section
        className={
          advice
            ? "space-y-4"
            : "grid gap-6 lg:grid-cols-[1.3fr_0.9fr]"
        }
      >
        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex">
              {captains.slice(0, 3).map((player, i) => (
                <div
                  key={player.id}
                  className="relative"
                  style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }}
                >
                  <PlayerTile player={player} size={i === 0 ? "lg" : "md"} />
                </div>
              ))}
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-accent">
              {snapshot.upcoming.name} ·{" "}
              {snapshot.totalManagers.toLocaleString("en-GB")} managers
            </p>
          </div>
          <h1 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Play the week that maximizes expected points.
          </h1>
          <p className="max-w-xl text-sm leading-6 text-muted">
            Rankings, a legal 15-man builder, and a weekly advisor that loads your
            public FPL team. The model blends FPL&apos;s own EP with minutes,
            fixtures, xG/xA and defensive contributions. It cannot promise first
            place — it removes the sloppy transfers that lose it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={playersHref({ view: "gw" })}
              className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent"
            >
              <IconLabel icon={BarChart3} size="sm">
                Open rankings
              </IconLabel>
            </Link>
            <Link
              href="/builder"
              className="inline-flex items-center rounded-md border border-line bg-panel px-4 py-2 text-sm hover:bg-panel-2"
            >
              <IconLabel icon={Wrench} size="sm">
                Build a squad
              </IconLabel>
            </Link>
          </div>
        </div>
        {advice ? null : (
          <div className="rounded-xl border border-line bg-panel p-5">
            <h2 className="text-sm font-semibold">Weekly advisor</h2>
            <p className="mt-1 mb-4 text-xs text-muted">
              Paste your Team ID. We never log into FPL. Advice then follows you
              into rankings, fixtures, and the builder.
            </p>
            <TeamIdForm />
          </div>
        )}
      </section>

      {advice ? (
        <>
          <WeekDecision
            compact
            entryId={advice.entryId}
            teamName={advice.teamName}
            gameweekName={snapshot.upcoming.name}
            deadline={deadline}
            freeTransfers={advice.freeTransfers}
            bestPlan={advice.bestPlan}
            holdPlan={advice.holdPlan}
            plans={advice.plans}
            chips={advice.chips}
            squad={advice.squad}
            formations={rankFormations(
              advice.bestPlan.lineup.xi.concat(advice.bestPlan.lineup.bench),
            ).map((row) => ({ formation: row.formation, xp: row.xp }))}
          />
          <p className="text-center text-xs text-muted">
            <Link href="/team?switch=1" className="hover:text-accent">
              Advise a different team
            </Link>
          </p>
        </>
      ) : null}

      <MatchBoard initial={matches} compact />

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border border-line bg-panel p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Captain board</h2>
            <Link href={playersHref({ view: "captain" })} className="text-xs text-accent">
              <IconLabel icon={Crown} size="xs">
                Captains view
              </IconLabel>
            </Link>
          </div>
          <PlayerLeadList players={captains} kind="captain" />
        </article>
        <article className="rounded-xl border border-line bg-panel p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Value under £7.0m</h2>
            <Link href={playersHref({ view: "value" })} className="text-xs text-accent">
              <IconLabel icon={Coins} size="xs">
                Value view
              </IconLabel>
            </Link>
          </div>
          <PlayerLeadList players={value} kind="value" />
        </article>
      </section>
    </div>
  );
}
