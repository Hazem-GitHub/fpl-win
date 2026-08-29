/** FPL's fixture `minutes` often lag the stadium clock by several minutes. */

const HALF = 45;
const HT_BREAK = 15;
const MAX_ADDED = 12;
/** Ignore small gaps — usually first-half added time, not FPL lag. */
const LAG_IGNORE = 2;
/** Never jump more than this ahead of FPL's last official minute. */
const LAG_CATCH = 10;

export type LivePhase = "first" | "ht" | "second" | "added";

export type LiveClock = {
  minute: number;
  phase: LivePhase;
  label: string;
};

function wallMinutes(kickoff: string | null, now: number): number | null {
  if (!kickoff) return null;
  const kick = Date.parse(kickoff);
  if (!Number.isFinite(kick) || now < kick) return null;
  return Math.floor((now - kick) / 60_000);
}

function estimateFromKickoff(elapsed: number, fpl: number): {
  minute: number;
  phase: LivePhase;
} {
  if (fpl < HALF) {
    const minute = Math.min(elapsed, HALF + MAX_ADDED);
    return {
      minute,
      phase: minute > HALF ? "added" : "first",
    };
  }
  if (fpl > HALF && fpl < 90) {
    return {
      minute: Math.min(90 + MAX_ADDED, Math.max(HALF + 1, elapsed - HT_BREAK)),
      phase: "second",
    };
  }
  if (fpl >= 90) {
    return {
      minute: Math.min(90 + MAX_ADDED, Math.max(90, elapsed - HT_BREAK)),
      phase: "added",
    };
  }
  // FPL stuck at 45': stoppage, half-time, or early second half.
  if (elapsed <= HALF + 7) {
    return { minute: Math.min(elapsed, HALF + MAX_ADDED), phase: "added" };
  }
  if (elapsed < HALF + 7 + HT_BREAK) {
    return { minute: HALF, phase: "ht" };
  }
  return {
    minute: Math.min(90 + MAX_ADDED, elapsed - HT_BREAK),
    phase: "second",
  };
}

function catchUp(fpl: number, estimate: number): number {
  if (estimate <= fpl) return fpl;
  const lag = estimate - fpl;
  if (lag <= LAG_IGNORE) return fpl;
  return Math.min(estimate, fpl + LAG_CATCH);
}

function formatClock(minute: number, phase: LivePhase): string {
  if (phase === "ht") return "HT";
  if (minute > 90) return `Live 90+${minute - 90}`;
  if (phase === "added" && minute >= HALF && minute < 90) {
    return `Live 45+${Math.max(1, minute - HALF)}`;
  }
  return `Live ${Math.max(1, minute)}'`;
}

export function liveMatchClock(
  match: { kickoff: string | null; minutes: number; status: string },
  now = Date.now(),
): LiveClock {
  const fpl = Math.max(0, match.minutes);
  const elapsed = wallMinutes(match.kickoff, now);

  if (elapsed == null) {
    const phase: LivePhase = fpl >= 90 ? "added" : fpl > HALF ? "second" : "first";
    return {
      minute: fpl,
      phase,
      label: fpl > 0 ? formatClock(fpl, phase) : "Live",
    };
  }

  const estimated = estimateFromKickoff(elapsed, fpl);
  if (estimated.phase === "ht" && fpl <= HALF) {
    return { minute: HALF, phase: "ht", label: "HT" };
  }

  const minute = catchUp(fpl, estimated.minute);
  const phase =
    minute >= 90
      ? "added"
      : estimated.phase === "ht"
        ? "second"
        : estimated.phase;
  return { minute, phase, label: formatClock(minute, phase) };
}
