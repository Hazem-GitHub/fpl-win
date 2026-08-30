import { NextResponse } from "next/server";
import { loadMatchBoard } from "@/lib/matches";

export const runtime = "nodejs";

export async function GET() {
  try {
    const board = await loadMatchBoard();
    return NextResponse.json(board, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Could not load matches" }, { status: 502 });
  }
}
