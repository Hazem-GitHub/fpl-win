/** FPL's fixture `minutes` often lag the stadium clock by several minutes. */

const HALF = 45;
const HT_BREAK = 15;
const MAX_ADDED = 12;
/** Ignore small gaps — usually first-half added time, not FPL lag. */
const LAG_IGNORE = 2;
/** Never jump more than this ahead of FPL's last official minute. */
const LAG_CATCH = 10;

const HALF_S = HALF * 60;
const HT_S = HT_BREAK * 60;
const MAX_ADDED_S = MAX_ADDED * 60;
const LAG_IGNORE_S = LAG_IGNORE * 60;
const LAG_CATCH_S = LAG_CATCH * 60;

export type LivePhase = "first" | "ht" | "second" | "added" | "ft";

export type LiveClock = {
  minute: number;
  second: number;
  playSec: number;
  phase: LivePhase;
  label: string;
};

function wallElapsedSec(kickoff: string | null, now: number): number | null {
  if (!kickoff) return null;
  const kick = Date.parse(kickoff);
  if (!Number.isFinite(kick) || now < kick) return null;
  return (now - kick) / 1000;
}

function estimateFromKickoff(
  elapsedSec: number,
  fpl: number,
): { playSec: number; phase: LivePhase } {
  if (fpl < HALF) {
    const playSec = Math.min(elapsedSec, HALF_S + MAX_ADDED_S);
    return {
      playSec,
      phase: playSec > HALF_S ? "added" : "first",
    };
  }
  if (fpl > HALF && fpl < 90) {
    const playSec = Math.min(
      90 * 60 + MAX_ADDED_S,
      Math.max(HALF_S + 1, elapsedSec - HT_S),
    );
    return {
      playSec,
      phase: playSec >= 90 * 60 ? "added" : "second",
    };
  }
  if (fpl >= 90) {
    return {
      playSec: Math.min(
        90 * 60 + MAX_ADDED_S,
        Math.max(90 * 60, elapsedSec - HT_S),
      ),
      phase: "added",
    };
  }
  // FPL stuck at 45': stoppage, half-time, or early second half.
  if (elapsedSec <= HALF_S + 7 * 60) {
    const playSec = Math.min(elapsedSec, HALF_S + MAX_ADDED_S);
    return {
      playSec,
      phase: playSec > HALF_S ? "added" : "first",
    };
  }
  if (elapsedSec < HALF_S + 7 * 60 + HT_S) {
    return { playSec: HALF_S, phase: "ht" };
  }
  const playSec = Math.min(90 * 60 + MAX_ADDED_S, elapsedSec - HT_S);
  return {
    playSec,
    phase: playSec >= 90 * 60 ? "added" : "second",
  };
}

function catchUpSec(fplMin: number, estimateSec: number): number {
  const fplSec = fplMin * 60;
  if (estimateSec <= fplSec) return fplSec;
  const lag = estimateSec - fplSec;
  if (lag <= LAG_IGNORE_S) return estimateSec;
  return Math.min(estimateSec, fplSec + LAG_CATCH_S);
}

function pad2(n: number): string {
  return String(Math.max(0, Math.min(59, n))).padStart(2, "0");
}

function formatClock(playSec: number, phase: LivePhase): string {
  if (phase === "ht") return "HT";
  if (phase === "ft") return "FT";
  const minute = Math.floor(playSec / 60);
  const second = Math.floor(playSec % 60);
  const sec = pad2(second);
  if (minute > 90) return `Live 90+${minute - 90}:${sec}`;
  if (phase === "added" && minute >= HALF && minute < 90) {
    return `Live 45+${Math.max(1, minute - HALF)}:${sec}`;
  }
  return `Live ${Math.max(0, minute)}:${sec}`;
}

function phaseAfterCatch(
  playSec: number,
  estimated: LivePhase,
  fpl: number,
): LivePhase {
  if (estimated === "ht" || estimated === "ft") return estimated;
  const minute = playSec / 60;
  if (minute >= 90 || fpl >= 90) return "added";
  if (fpl > HALF) return "second";
  if (estimated === "added" || (estimated === "first" && minute > HALF)) {
    return minute > HALF ? "added" : "first";
  }
  return estimated;
}

export function liveMatchClock(
  match: { kickoff: string | null; minutes: number; status: string },
  now = Date.now(),
): LiveClock {
  const fpl = Math.max(0, match.minutes);
  const elapsed = wallElapsedSec(match.kickoff, now);

  if (elapsed == null) {
    const phase: LivePhase =
      fpl >= 90 ? "added" : fpl > HALF ? "second" : "first";
    const playSec = fpl * 60;
    return {
      minute: fpl,
      second: 0,
      playSec,
      phase,
      label: fpl > 0 ? formatClock(playSec, phase) : "Live",
    };
  }

  const estimated = estimateFromKickoff(elapsed, fpl);
  if (estimated.phase === "ht" && fpl <= HALF) {
    return {
      minute: HALF,
      second: 0,
      playSec: HALF_S,
      phase: "ht",
      label: "HT",
    };
  }

  const playSec = catchUpSec(fpl, estimated.playSec);
  const phase = phaseAfterCatch(playSec, estimated.phase, fpl);
  return {
    minute: Math.floor(playSec / 60),
    second: Math.floor(playSec % 60),
    playSec,
    phase,
    label: formatClock(playSec, phase),
  };
}
