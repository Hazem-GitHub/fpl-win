import { NextResponse } from "next/server";
import { buildSquad } from "@/lib/optimize/squad";
import { getSnapshot } from "@/lib/snapshot";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    lockedIds?: number[];
    excludedIds?: number[];
    budget?: number;
    horizon?: 3 | 5;
  };
  const snapshot = await getSnapshot();
  const plan = await buildSquad({
    players: snapshot.players,
    lockedIds: body.lockedIds ?? [],
    excludedIds: body.excludedIds ?? [],
    budget: body.budget ?? 1000,
    horizon: body.horizon ?? 5,
    preferMip: body.preferMip ?? false,
  });
  return NextResponse.json(plan);
}
