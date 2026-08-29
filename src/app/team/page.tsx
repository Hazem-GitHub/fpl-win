import { TeamLookup } from "@/components/TeamLookup";
import { isValidTeamId, TEAM_ID_COOKIE } from "@/lib/team-id";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function TeamIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ switch?: string }>;
}) {
  const { switch: switching } = await searchParams;
  if (switching !== "1") {
    const stored = (await cookies()).get(TEAM_ID_COOKIE)?.value;
    if (stored && isValidTeamId(stored)) redirect(`/team/${stored}`);
  }
  return <TeamLookup />;
}
