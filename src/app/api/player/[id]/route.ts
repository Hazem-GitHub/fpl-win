import { NextResponse } from "next/server";
import { fetchBootstrap, fetchElementSummary } from "@/lib/fpl/client";
import { buildPlayerRecent } from "@/lib/player/recent";
import type { ElementTypeId } from "@/lib/fpl/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const playerId = Number.parseInt(id, 10);
  if (!Number.isFinite(playerId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const [summary, bootstrap] = await Promise.all([
      fetchElementSummary(playerId),
      fetchBootstrap(),
    ]);
    const element = bootstrap.elements.find((el) => el.id === playerId);
    const position = (element?.element_type ?? 3) as ElementTypeId;
    const recent = buildPlayerRecent(summary, bootstrap.teams, position);
    return NextResponse.json(recent);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
