import { loadMatchBoard, type MatchBoardData } from "@/lib/matches";

type Listener = (board: MatchBoardData) => void;

const listeners = new Set<Listener>();
let last: MatchBoardData | null = null;
let lastStamp = "";
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let inFlight = false;

function stamp(board: MatchBoardData): string {
  const parts: string[] = [String(board.live.length)];
  const push = (m: MatchBoardData["live"][number]) => {
    parts.push(
      `${m.id}:${m.status}:${m.minutes}:${m.home.score ?? ""}:${m.away.score ?? ""}`,
    );
  };
  for (const m of board.live) push(m);
  for (const g of board.groups) {
    for (const m of g.matches) push(m);
  }
  return parts.join("|");
}

function pollDelay(board: MatchBoardData | null): number {
  if (!board || board.live.length > 0) return 3_000;
  const now = Date.now();
  const windowMs = 90 * 60 * 1000;
  const soon = board?.groups.some((g) =>
    g.matches.some((m) => {
      if (!m.kickoff) return false;
      const kick = Date.parse(m.kickoff);
      return Number.isFinite(kick) && Math.abs(kick - now) < windowMs;
    }),
  );
  return soon ? 5_000 : 20_000;
}

async function tick(): Promise<void> {
  if (!running || inFlight) return;
  inFlight = true;
  try {
    const board = await loadMatchBoard({ fresh: true });
    last = board;
    const nextStamp = stamp(board);
    const changed = nextStamp !== lastStamp;
    lastStamp = nextStamp;
    if (changed) {
      for (const listener of listeners) listener(board);
    }
  } catch {
    /* keep the last good board */
  } finally {
    inFlight = false;
  }
  if (!running) return;
  timer = setTimeout(() => {
    void tick();
  }, pollDelay(last));
}

function ensureRunning(): void {
  if (running) return;
  running = true;
  void tick();
}

function stopIfIdle(): void {
  if (listeners.size > 0) return;
  running = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/** One FPL poller for every SSE client — lowest latency without a request per browser. */
export function subscribeMatchFeed(listener: Listener): () => void {
  listeners.add(listener);
  if (last) listener(last);
  ensureRunning();
  return () => {
    listeners.delete(listener);
    stopIfIdle();
  };
}

export function matchFeedSnapshot(): MatchBoardData | null {
  return last;
}
