import type { LivePhase } from "@/lib/live-clock";

export const PITCH_L = 105;
export const PITCH_W = 68;

export type SimPlayer = {
  x: number;
  y: number;
  home: boolean;
};

export type SimState = {
  ballX: number;
  ballY: number;
  ballVx: number;
  ballVy: number;
  possession: 1 | -1;
  possessUntil: number;
  players: SimPlayer[];
  goalFlash: number;
  scorer: 1 | -1;
  lastHome: number;
  lastAway: number;
  seed: number;
};

/** 4-3-3 slots in metres, home attacking +x. */
const HOME_SHAPE: ReadonlyArray<readonly [number, number]> = [
  [7, 34],
  [18, 11],
  [20, 25],
  [20, 43],
  [18, 57],
  [38, 18],
  [40, 34],
  [38, 50],
  [58, 14],
  [62, 34],
  [58, 54],
];

function hash(n: number): number {
  let x = (n | 0) * 1597334677;
  x = Math.imul(x ^ (x >>> 16), 2246822507);
  x = Math.imul(x ^ (x >>> 13), 3266489909);
  return (x ^ (x >>> 16)) >>> 0;
}

function rand(state: SimState): number {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

function slot(i: number): readonly [number, number] {
  return HOME_SHAPE[i] ?? [40, 34];
}

export function createSim(matchId: number, homeScore = 0, awayScore = 0): SimState {
  const seed = hash(matchId + 17);
  const players: SimPlayer[] = HOME_SHAPE.map(([x, y]) => ({
    x: x + ((hash(matchId * 3 + x) % 100) / 100 - 0.5) * 1.2,
    y: y + ((hash(matchId * 7 + y) % 100) / 100 - 0.5) * 1.2,
    home: true,
  }));
  for (const [x, y] of HOME_SHAPE) {
    players.push({
      x: PITCH_L - x + ((hash(matchId * 11 + x) % 100) / 100 - 0.5) * 1.2,
      y: y + ((hash(matchId * 13 + y) % 100) / 100 - 0.5) * 1.2,
      home: false,
    });
  }
  return {
    ballX: PITCH_L / 2,
    ballY: PITCH_W / 2,
    ballVx: 0,
    ballVy: 0,
    possession: seed % 2 === 0 ? 1 : -1,
    possessUntil: 2.4,
    players,
    goalFlash: 0,
    scorer: 1,
    lastHome: homeScore,
    lastAway: awayScore,
    seed,
  };
}

export type SimInput = {
  dt: number;
  phase: LivePhase;
  homeScore: number;
  awayScore: number;
  homeRating: number;
  awayRating: number;
  reduced: boolean;
};

function restartKickoff(state: SimState, to: 1 | -1): void {
  state.ballX = PITCH_L / 2;
  state.ballY = PITCH_W / 2;
  state.ballVx = to * 6;
  state.ballVy = (rand(state) - 0.5) * 4;
  state.possession = to;
  state.possessUntil = 1.6 + rand(state) * 1.4;
}

export function stepSim(state: SimState, input: SimInput): void {
  const { dt, phase, reduced } = input;
  if (dt <= 0) return;

  if (input.homeScore > state.lastHome || input.awayScore > state.lastAway) {
    state.scorer = input.homeScore > state.lastHome ? 1 : -1;
    state.goalFlash = 2.15;
    state.ballX = state.scorer === 1 ? PITCH_L - 2.2 : 2.2;
    state.ballY = PITCH_W / 2;
    state.ballVx = 0;
    state.ballVy = 0;
  }
  state.lastHome = input.homeScore;
  state.lastAway = input.awayScore;

  if (reduced) {
    state.ballX = PITCH_L / 2;
    state.ballY = PITCH_W / 2;
    state.ballVx = 0;
    state.ballVy = 0;
    for (let i = 0; i < 11; i++) {
      const [sx, sy] = slot(i);
      state.players[i].x = sx;
      state.players[i].y = sy;
      state.players[i + 11].x = PITCH_L - sx;
      state.players[i + 11].y = sy;
    }
    return;
  }

  if (state.goalFlash > 0) {
    const prev = state.goalFlash;
    state.goalFlash = Math.max(0, state.goalFlash - dt);
    if (prev > 1.05 && state.goalFlash <= 1.05) {
      restartKickoff(state, state.scorer === 1 ? -1 : 1);
    }
  }

  const ht = phase === "ht";
  if (ht) {
    state.ballVx *= Math.pow(0.08, dt);
    state.ballVy *= Math.pow(0.08, dt);
    state.ballX += (PITCH_L / 2 - state.ballX) * Math.min(1, 2.8 * dt);
    state.ballY += (PITCH_W / 2 - state.ballY) * Math.min(1, 2.8 * dt);
  } else if (state.goalFlash <= 1.05) {
    state.possessUntil -= dt;
    if (state.possessUntil <= 0) {
      const scorePush = (input.awayScore - input.homeScore) * 0.07;
      const ratingPush = (input.homeRating - input.awayRating) / 14;
      const pHome = clamp(0.5 + ratingPush * 0.22 + scorePush, 0.28, 0.72);
      state.possession = rand(state) < pHome ? 1 : -1;
      state.possessUntil = 1.5 + rand(state) * 4.6;
      state.ballVx += state.possession * (8 + rand(state) * 7);
      state.ballVy += (rand(state) - 0.5) * 10;
    }

    const targetX =
      state.possession === 1
        ? 72 + rand(state) * 18
        : 15 + rand(state) * 18;
    const targetY = 10 + rand(state) * 48;
    const ax = (targetX - state.ballX) * 2.4;
    const ay = (targetY - state.ballY) * 1.8;
    state.ballVx += ax * dt + (rand(state) - 0.5) * 18 * dt;
    state.ballVy += ay * dt + (rand(state) - 0.5) * 16 * dt;
    const speed = Math.hypot(state.ballVx, state.ballVy);
    const cap = 22;
    if (speed > cap) {
      state.ballVx = (state.ballVx / speed) * cap;
      state.ballVy = (state.ballVy / speed) * cap;
    }
    state.ballVx *= Math.pow(0.55, dt);
    state.ballVy *= Math.pow(0.55, dt);
    state.ballX += state.ballVx * dt;
    state.ballY += state.ballVy * dt;
  }

  if (state.ballX < 1.2) {
    state.ballX = 1.2;
    state.ballVx = Math.abs(state.ballVx) * 0.55;
    if (!ht) state.possession = 1;
  } else if (state.ballX > PITCH_L - 1.2) {
    state.ballX = PITCH_L - 1.2;
    state.ballVx = -Math.abs(state.ballVx) * 0.55;
    if (!ht) state.possession = -1;
  }
  if (state.ballY < 1.2) {
    state.ballY = 1.2;
    state.ballVy = Math.abs(state.ballVy) * 0.6;
  } else if (state.ballY > PITCH_W - 1.2) {
    state.ballY = PITCH_W - 1.2;
    state.ballVy = -Math.abs(state.ballVy) * 0.6;
  }

  const follow = ht ? 0.04 : 0.2;
  const snap = ht ? 3.2 : 5.4;
  const bounce = state.goalFlash > 1.05 ? Math.sin(state.goalFlash * 22) * 0.55 : 0;

  for (let i = 0; i < 11; i++) {
    const [sx, sy] = slot(i);
    const home = state.players[i];
    const away = state.players[i + 11];
    const hx = sx + (state.ballX - PITCH_L / 2) * follow;
    const hy = sy + (state.ballY - PITCH_W / 2) * follow * 0.48 + bounce;
    const ax = PITCH_L - sx + (state.ballX - PITCH_L / 2) * follow;
    const ay = sy + (state.ballY - PITCH_W / 2) * follow * 0.48 + bounce;
    home.x += (clamp(hx, 3, PITCH_L / 2 + 8) - home.x) * Math.min(1, snap * dt);
    home.y += (clamp(hy, 3, PITCH_W - 3) - home.y) * Math.min(1, snap * dt);
    away.x += (clamp(ax, PITCH_L / 2 - 8, PITCH_L - 3) - away.x) * Math.min(1, snap * dt);
    away.y += (clamp(ay, 3, PITCH_W - 3) - away.y) * Math.min(1, snap * dt);
  }

  // Keep the nearest attacker a little closer to the ball.
  if (!ht && state.goalFlash <= 1.05) {
    const start = state.possession === 1 ? 0 : 11;
    let best = start;
    let bestD = 1e9;
    for (let i = start; i < start + 11; i++) {
      const p = state.players[i];
      const d =
        (p.x - state.ballX) * (p.x - state.ballX) +
        (p.y - state.ballY) * (p.y - state.ballY);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const p = state.players[best];
    p.x += (state.ballX - p.x) * Math.min(1, 3.6 * dt);
    p.y += (state.ballY - p.y) * Math.min(1, 3.6 * dt);
  }
}
