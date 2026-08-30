import { NextResponse } from "next/server";
import { subscribeMatchFeed, matchFeedSnapshot } from "@/lib/match-feed";
import type { MatchBoardData } from "@/lib/matches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (board: MatchBoardData) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(board)}\n\n`),
          );
        } catch {
          cleanup();
        }
      };

      const pingComment = () => {
        try {
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        } catch {
          cleanup();
        }
      };

      const cleanup = () => {
        unsubscribe?.();
        unsubscribe = null;
        if (ping) {
          clearInterval(ping);
          ping = null;
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      const snapshot = matchFeedSnapshot();
      if (snapshot) send(snapshot);
      unsubscribe = subscribeMatchFeed((board) => {
        if (board !== snapshot) send(board);
      });
      ping = setInterval(pingComment, 15_000);
      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      unsubscribe?.();
      if (ping) clearInterval(ping);
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
