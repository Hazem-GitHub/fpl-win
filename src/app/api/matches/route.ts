import { NextResponse } from "next/server";
import { getMatchBoard } from "@/lib/matches";

export const runtime = "nodejs";

export async function GET() {
  try {
    const board = await getMatchBoard();
    return NextResponse.json(board, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Could not load matches" }, { status: 502 });
  }
}
