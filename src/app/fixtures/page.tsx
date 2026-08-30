import { ClubCrest } from "@/components/ClubCrest";
import { MatchBoard } from "@/components/MatchBoard";
import { getMatchBoard } from "@/lib/matches";

export default async function FixturesPage() {
  const board = await getMatchBoard();
  const headline =
    board.live[0] ??
    board.groups.flatMap((g) => g.matches).find((m) => m.status === "upcoming");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        {headline ? (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-panel px-3 py-2">
            <ClubCrest
              code={headline.home.code}
              name={headline.home.short}
              className="h-10 w-10 object-contain"
            />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted">
              {headline.status === "live" ? "Live" : "vs"}
            </span>
            <ClubCrest
              code={headline.away.code}
              name={headline.away.short}
              className="h-10 w-10 object-contain"
            />
          </div>
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fixtures</h1>
          <p className="mt-1 text-sm text-muted">
            Live pitch simulation while matches are on — second-resolution
            clock, then the next Premier League gameweeks with fixture
            difficulty for each side.
          </p>
        </div>
      </div>
      <MatchBoard initial={board} />
    </div>
  );
}
