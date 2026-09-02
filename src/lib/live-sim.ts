import type { LivePhase } from "@/lib/live-clock";

export const PITCH_L = 105;
export const PITCH_W = 68;

export type SimRole = "gk" | "fb" | "cb" | "mid" | "winger" | "st";
export type SimMode = "hold" | "flight" | "dead" | "set" | "celebrate" | "ht";
export type SimFlight = "pass" | "cross" | "shot" | "clear";
export type SimDead =
  | "foul"
  | "card"
  | "throw"
  | "corner"
  | "goalkick"
  | "kickoff"
  | "penalty"
  | "var"
  | "offside"
  | "injury";
export type SimSet =
  | "freekick"
  | "corner"
  | "throw"
  | "goalkick"
  | "kickoff"
  | "penalty";
export type SimCaptionKind =
  | "play"
  | "chance"
  | "goal"
  | "save"
  | "card"
  | "red"
  | "stop"
  | "set"
  | "var"
  | "offside"
  | "out"
  | "added";

export type SimPlayer = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number;
  home: boolean;
  role: SimRole;
  slot: number;
  hop: number;
  off: boolean;
  card: 0 | 1 | 2;
};

export type SimFeedItem = {
  text: string;
  kind: SimCaptionKind;
};

export type SimDecision = {
  clock: string;
  text: string;
  kind: SimCaptionKind;
};

export type SimState = {
  mode: SimMode;
  ballX: number;
  ballY: number;
  ballZ: number;
  carrier: number;
  possession: 1 | -1;
  holdT: number;
  flight: SimFlight;
  from: number;
  to: number;
  t: number;
  dur: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  curve: number;
  pendingGoal: 0 | 1 | -1;
  shotMustScore: boolean;
  chanceAt: number;
  homeGoals: number;
  awayGoals: number;
  lastTouch: 1 | -1;
  dead: SimDead;
  deadT: number;
  set: SimSet;
  setT: number;
  kicker: number;
  foulX: number;
  foulY: number;
  lastPasser: number;
  lastPassAt: number;
  time: number;
  caption: string;
  captionSub: string;
  captionKind: SimCaptionKind;
  captionT: number;
  sting: boolean;
  feed: SimFeedItem[];
  feedStamp: number;
  decisions: SimDecision[];
  decisionStamp: number;
  players: SimPlayer[];
  trail: number[];
  seed: number;
  htArmed: boolean;
  ftArmed: boolean;
  addedArmed: 0 | 1 | 2;
  kickOffFirst: 1 | -1;
  offsideArmed: boolean;
  noOffside: boolean;
};

const ROLES: readonly SimRole[] = [
  "gk",
  "fb",
  "cb",
  "cb",
  "fb",
  "mid",
  "mid",
  "mid",
  "winger",
  "st",
  "winger",
];

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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

function slot(i: number): readonly [number, number] {
  return HOME_SHAPE[i] ?? [40, 34];
}

function sideOf(i: number): 1 | -1 {
  return i < 11 ? 1 : -1;
}

function startOf(side: 1 | -1): number {
  return side === 1 ? 0 : 11;
}

function club(input: SimInput, side: 1 | -1): string {
  return side === 1 ? input.homeShort : input.awayShort;
}

const BOX = 16.5;
const BOX_H = 40.32;
const SIX = 5.5;
const SIX_H = 18.32;
const GOAL_H = 7.32;
const PEN = 11;
const CORNER_R = 1;

function edge(input: SimInput, side: 1 | -1): number {
  const a = side === 1 ? input.homeRating : input.awayRating;
  const b = side === 1 ? input.awayRating : input.homeRating;
  return clamp((a - b) / 8, -0.32, 0.32);
}

function inBox(x: number, y: number, attack: 1 | -1): boolean {
  const deep = attack === 1 ? x > PITCH_L - BOX : x < BOX;
  const gy = (PITCH_W - BOX_H) / 2;
  return deep && y > gy && y < gy + BOX_H;
}

function shotRange(x: number, side: 1 | -1): number {
  return side === 1 ? PITCH_L - x : x;
}

/** Direct free kick close enough to goal that a wall would form. */
function dangerousFk(state: SimState): boolean {
  const range = shotRange(state.ballX, state.possession);
  if (range > 28) return false;
  const wide = Math.abs(state.ballY - PITCH_W / 2);
  if (wide > 22) return false;
  if (range > 22 && wide > 14) return false;
  return true;
}

function fkWallCount(state: SimState): number {
  const range = shotRange(state.ballX, state.possession);
  const wide = Math.abs(state.ballY - PITCH_W / 2);
  if (range < 20 && wide < 12) return 4;
  if (range < 25 && wide < 16) return 3;
  return 2;
}

function secondLastX(state: SimState, attack: 1 | -1): number {
  const start = startOf(attack === 1 ? -1 : 1);
  const xs: number[] = [];
  for (let i = start; i < start + 11; i++) {
    if (state.players[i].off) continue;
    xs.push(state.players[i].x);
  }
  if (xs.length < 2) return attack === 1 ? 0 : PITCH_L;
  xs.sort((a, b) => (attack === 1 ? b - a : a - b));
  return xs[1] ?? xs[0];
}

/** Law 11 at the moment a teammate plays the ball. */
function attackerOffside(state: SimState, recv: number, passer: number): boolean {
  if (recv < 0 || state.noOffside) return false;
  if (sideOf(recv) !== sideOf(passer)) return false;
  const p = state.players[recv];
  if (p.off) return false;
  const att = sideOf(recv);
  const half = PITCH_L / 2;
  if (att === 1 && (p.x <= half || p.x <= state.ballX)) return false;
  if (att === -1 && (p.x >= half || p.x >= state.ballX)) return false;
  const last = secondLastX(state, att);
  return att === 1 ? p.x > last : p.x < last;
}

function pushTrail(state: SimState): void {
  state.trail.push(state.ballX, state.ballY);
  if (state.trail.length > 28) state.trail.splice(0, 2);
}

function clockStamp(input: SimInput): string {
  if (input.phase === "ht") return "HT";
  if (input.phase === "ft") return "FT";
  const m = Math.max(0, Math.floor(input.playSec / 60));
  if (m > 90) return `90+${m - 90}'`;
  if (input.phase === "added" && m >= 45 && m < 90) {
    return `45+${Math.max(1, m - 45)}'`;
  }
  return `${m}'`;
}

function recordDecision(
  state: SimState,
  input: SimInput,
  kind: SimCaptionKind,
  text: string,
): void {
  const clock = clockStamp(input);
  const last = state.decisions[0];
  if (last && last.text === text && last.clock === clock) return;
  state.decisions.unshift({ clock, text, kind });
  if (state.decisions.length > 14) state.decisions.length = 14;
  state.decisionStamp += 1;
}

function setCaption(
  state: SimState,
  kind: SimCaptionKind,
  text: string,
  dur: number,
  notable: boolean,
  sub = "",
  sting?: boolean,
): void {
  state.caption = text;
  state.captionSub = sub;
  state.captionKind = kind;
  state.captionT = dur;
  state.sting = sting ?? (kind !== "play" && kind !== "chance");
  if (!notable || !text) return;
  if (state.feed[0]?.text === text) return;
  state.feed.unshift({ text, kind });
  if (state.feed.length > 4) state.feed.length = 4;
  state.feedStamp += 1;
}

function glueBall(state: SimState, i: number): void {
  const p = state.players[i];
  const dir = sideOf(i);
  state.ballX = p.x + dir * 1.15;
  state.ballY = p.y;
  state.ballZ = 0.35;
  state.carrier = i;
  state.possession = dir;
  state.lastTouch = dir;
}

function nearest(
  state: SimState,
  side: 1 | -1,
  x: number,
  y: number,
  skip = -1,
  allowOff = false,
): number {
  const start = startOf(side);
  let best = start;
  let bestD = 1e9;
  for (let i = start; i < start + 11; i++) {
    if (i === skip) continue;
    const p = state.players[i];
    if (p.off && !allowOff) continue;
    const d = dist(p.x, p.y, x, y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function pickPassTarget(state: SimState, from: number): number {
  const side = sideOf(from);
  const start = startOf(side);
  const dir = side;
  const a = state.players[from];
  let best = -1;
  let bestS = -1e9;
  for (let i = start; i < start + 11; i++) {
    if (i === from || state.players[i].off) continue;
    const p = state.players[i];
    const d = dist(a.x, a.y, p.x, p.y);
    if (d < 6 || d > 52) continue;
    const fwd = (p.x - a.x) * dir;
    if (p.role === "gk" && fwd > -4) continue;
    let s = fwd * 1.05 - d * 0.035 + rand(state) * 4.2;
    if (fwd < 0) s -= 6.5;
    const wide = Math.abs(p.y - a.y);
    if (wide > 14) s += wide * 0.16;
    if (p.role === "st" && fwd > 5) s += 7;
    if (p.role === "winger" && fwd > 0) s += 4.2;
    if (p.role === "mid" && fwd > 2 && wide > 8) s += 3.2;
    if (p.role === "fb" && fwd < 4 && d < 18) s += 2.4;
    if (s > bestS) {
      bestS = s;
      best = i;
    }
  }
  if (best >= 0) return best;
  return nearest(state, side, a.x + dir * 12, a.y, from);
}

function beginFlight(
  state: SimState,
  kind: SimFlight,
  from: number,
  toX: number,
  toY: number,
  to: number,
  curve: number,
): void {
  const a = state.players[from];
  state.mode = "flight";
  state.flight = kind;
  state.from = from;
  state.to = to;
  state.carrier = -1;
  state.x0 = state.ballX;
  state.y0 = state.ballY;
  state.x1 = toX;
  state.y1 = toY;
  state.t = 0;
  const d = dist(a.x, a.y, state.x1, state.y1);
  const speed =
    kind === "shot" ? 38 : kind === "cross" ? 22 : kind === "clear" ? 32 : 26;
  state.dur = clamp(d / speed, 0.28, kind === "cross" ? 1.15 : 0.95);
  state.curve = curve;
  state.lastTouch = sideOf(from);
  if (kind === "pass" || kind === "cross") {
    state.lastPasser = from;
    state.lastPassAt = state.time;
    state.offsideArmed = attackerOffside(state, to, from);
  } else {
    state.offsideArmed = false;
  }
  state.noOffside = false;
}

function beginPass(state: SimState, input: SimInput, from: number, cross: boolean): void {
  const to = pickPassTarget(state, from);
  const p = state.players[to];
  const dir = sideOf(from);
  const through =
    !cross &&
    (p.role === "st" || p.role === "winger") &&
    (p.x - state.players[from].x) * dir > 8 &&
    rand(state) < 0.38;
  const lead = dir * (through ? 8.5 : cross ? 2.4 : 1.15);
  const curve = cross
    ? 5.5 + rand(state) * 3
    : through
      ? 1.2 + rand(state)
      : (rand(state) - 0.5) * 3.4;
  beginFlight(
    state,
    cross ? "cross" : "pass",
    from,
    clamp(p.x + lead, -1.5, PITCH_L + 1.5),
    clamp(p.y + (rand(state) - 0.5) * (through ? 3.5 : 2), -1.5, PITCH_W + 1.5),
    to,
    curve,
  );
  const clubName = club(input, dir);
  setCaption(
    state,
    through ? "chance" : "play",
    cross ? `Cross · ${clubName}` : through ? `Through ball · ${clubName}` : `Pass · ${clubName}`,
    cross ? 1.35 : through ? 1.2 : 0.95,
    cross || through,
  );
}

function beginShot(
  state: SimState,
  input: SimInput,
  from: number,
  isGoal: boolean,
): void {
  const dir = sideOf(from);
  const posts = GOAL_H / 2;
  const onTarget = isGoal || rand(state) < 0.38;
  let y: number;
  if (isGoal) {
    y = PITCH_W / 2 + (rand(state) - 0.5) * posts * 0.88;
  } else if (onTarget) {
    y = PITCH_W / 2 + (rand(state) - 0.5) * posts * 1.35;
  } else {
    y =
      PITCH_W / 2 +
      (rand(state) < 0.5 ? -1 : 1) * (posts + 1.8 + rand(state) * 12);
  }
  const x = dir === 1 ? PITCH_L + 0.4 : -0.4;
  beginFlight(state, "shot", from, x, y, -1, (rand(state) - 0.5) * 1.4);
  state.shotMustScore = isGoal;
  if (isGoal) state.pendingGoal = dir;
  setCaption(
    state,
    isGoal || onTarget ? "chance" : "play",
    `Shot · ${club(input, dir)}`,
    1.2,
    true,
  );
}

function beginCelebrate(state: SimState, input: SimInput, side: 1 | -1, own = false): void {
  state.mode = "celebrate";
  state.pendingGoal = 0;
  state.shotMustScore = false;
  if (side === 1) state.homeGoals += 1;
  else state.awayGoals += 1;
  state.carrier = -1;
  state.ballX = side === 1 ? PITCH_L - 1.2 : 1.2;
  state.ballY = PITCH_W / 2 + (rand(state) - 0.5) * 2;
  state.ballZ = 0.2;
  state.holdT = 2.4 + rand(state) * 0.5;
  const assist =
    !own &&
    state.lastPasser >= 0 &&
    sideOf(state.lastPasser) === side &&
    state.time - state.lastPassAt < 3.2;
  setCaption(
    state,
    "goal",
    own ? "OWN GOAL" : "GOAL",
    2.8,
    true,
    own
      ? club(input, side === 1 ? -1 : 1)
      : assist
        ? `${club(input, side)}  ·  Assist`
        : club(input, side),
  );
  recordDecision(
    state,
    input,
    "goal",
    own
      ? `Own goal · ${club(input, side === 1 ? -1 : 1)}`
      : assist
        ? `Goal given · ${club(input, side)} · assist`
        : `Goal given · ${club(input, side)}`,
  );
}

function beginDead(
  state: SimState,
  input: SimInput,
  kind: SimDead,
  dur: number,
  text: string,
  captionKind: SimCaptionKind,
  notable: boolean,
): void {
  state.mode = "dead";
  state.dead = kind;
  state.deadT = dur;
  state.carrier = -1;
  state.ballZ = 0.2;
  const title =
    kind === "var"
      ? "VAR CHECK"
      : kind === "offside"
        ? "OFFSIDE"
        : kind === "penalty"
          ? "PENALTY"
          : kind === "throw" || kind === "goalkick"
            ? "OUT"
            : kind === "corner"
              ? "CORNER"
              : kind === "card"
                ? captionKind === "red"
                  ? "RED CARD"
                  : "YELLOW CARD"
                : kind === "foul"
                  ? "FOUL"
                  : text;
  const sub =
    kind === "offside" ? text.replace(/^Offside ·\s*/i, "") : text;
  setCaption(state, captionKind, title, dur + 0.45, notable, sub);
  if (notable) recordDecision(state, input, captionKind, text);
}

function beginSet(
  state: SimState,
  input: SimInput,
  kind: SimSet,
  kickoffLabel?: string,
): void {
  state.mode = "set";
  state.set = kind;
  state.carrier = -1;
  const side = state.possession;
  if (kind === "kickoff") {
    state.ballX = PITCH_L / 2;
    state.ballY = PITCH_W / 2;
    state.ballZ = 0.22;
    state.kicker = nearest(state, side, PITCH_L / 2, PITCH_W / 2);
    state.setT = 1.15;
    const restart = kickoffLabel ?? "Kick-off";
    setCaption(
      state,
      "set",
      restart === "Kick-off" ? "KICK-OFF" : restart.toUpperCase(),
      1.3,
      false,
      restart === "Kick-off" ? "" : restart,
      restart === "Kick-off" || Boolean(kickoffLabel),
    );
    recordDecision(state, input, "set", restart);
  } else if (kind === "throw") {
    state.ballY = state.ballY < PITCH_W / 2 ? 0.35 : PITCH_W - 0.35;
    state.ballX = clamp(state.ballX, 1, PITCH_L - 1);
    state.ballZ = 0.35;
    state.kicker = nearest(state, side, state.ballX, state.ballY);
    state.setT = 1.05;
    setCaption(
      state,
      "out",
      "OUT",
      0.9,
      false,
      `Throw-in · ${club(input, side)}`,
      false,
    );
  } else if (kind === "corner") {
    const attackRight = side === 1;
    const near = state.foulY < PITCH_W / 2;
    state.ballX = attackRight ? PITCH_L - CORNER_R * 0.55 : CORNER_R * 0.55;
    state.ballY = near ? CORNER_R * 0.55 : PITCH_W - CORNER_R * 0.55;
    state.ballZ = 0.22;
    state.kicker = nearest(state, side, state.ballX, state.ballY);
    state.setT = 1.7;
    setCaption(state, "set", "CORNER", 1.8, true, club(input, side));
  } else if (kind === "goalkick") {
    const left = side === 1;
    const sixY0 = (PITCH_W - SIX_H) / 2;
    state.ballX = left ? SIX : PITCH_L - SIX;
    state.ballY = clamp(
      PITCH_W / 2 + (rand(state) - 0.5) * 10,
      sixY0 + 1.2,
      sixY0 + SIX_H - 1.2,
    );
    state.ballZ = 0.22;
    state.kicker = startOf(side);
    state.setT = 1.25;
    setCaption(
      state,
      "out",
      "OUT",
      0.95,
      false,
      `Goal kick · ${club(input, side)}`,
      false,
    );
  } else if (kind === "penalty") {
    const attackRight = side === 1;
    state.ballX = attackRight ? PITCH_L - PEN : PEN;
    state.ballY = PITCH_W / 2;
    state.ballZ = 0.22;
    state.kicker = startOf(side) + 9;
    state.setT = 2.15;
    setCaption(state, "set", "PENALTY", 2.2, true, club(input, side));
  } else {
    placeFreeKick(state);
    state.ballZ = 0.22;
    state.kicker = nearest(state, side, state.ballX, state.ballY);
    state.setT = 1.85;
    setCaption(state, "set", "FREE KICK", 2, true, club(input, side));
  }
}

function placeFreeKick(state: SimState): void {
  let x = state.foulX;
  let y = state.foulY;
  const att = state.possession;
  const sixX = att === 1 ? PITCH_L - SIX : SIX;
  const sixY0 = (PITCH_W - SIX_H) / 2;
  const inAttSix =
    (att === 1 ? x > PITCH_L - SIX : x < SIX) &&
    y > sixY0 &&
    y < sixY0 + SIX_H;
  if (inAttSix) x = sixX;
  state.ballX = clamp(x, 0.6, PITCH_L - 0.6);
  state.ballY = clamp(y, 0.6, PITCH_W - 0.6);
}

function beginKickoff(
  state: SimState,
  input: SimInput,
  to: 1 | -1,
  label?: string,
): void {
  state.possession = to;
  state.lastTouch = to;
  beginSet(state, input, "kickoff", label);
}

/** Start a chance in the attacking third — no teleport into the six-yard box. */
function buildChance(state: SimState, side: 1 | -1): void {
  const start = startOf(side);
  const prefs = [9, 8, 10, 7, 6, 5];
  let i = start + 9;
  for (const off of prefs) {
    const idx = start + off;
    if (state.players[idx] && !state.players[idx].off) {
      i = idx;
      break;
    }
  }
  const p = state.players[i];
  const destX = side === 1 ? 74 : 31;
  const destY = PITCH_W / 2 + (rand(state) - 0.5) * 14;
  p.x = clamp(
    lerp(p.x, destX, 0.55),
    side === 1 ? 58 : 18,
    side === 1 ? 84 : 47,
  );
  p.y = clamp(lerp(p.y, destY, 0.45), 10, PITCH_W - 10);
  p.vx = side * 5.5;
  p.vy = (destY - p.y) * 0.12;
  state.possession = side;
  state.carrier = i;
  glueBall(state, i);
  state.mode = "hold";
  state.holdT = 0.55 + rand(state) * 0.35;
  state.chanceAt = state.time;
}

export function createSim(
  matchId: number,
  homeScore = 0,
  awayScore = 0,
  opts?: { playSec?: number; phase?: LivePhase },
): SimState {
  const seed = hash(matchId + 17);
  const players: SimPlayer[] = [];
  for (let i = 0; i < 11; i++) {
    const [x, y] = slot(i);
    players.push({
      x: x + ((hash(matchId * 3 + x) % 100) / 100 - 0.5) * 1.2,
      y: y + ((hash(matchId * 7 + y) % 100) / 100 - 0.5) * 1.2,
      vx: 0,
      vy: 0,
      facing: 0,
      home: true,
      role: ROLES[i] ?? "mid",
      slot: i,
      hop: 0,
      off: false,
      card: 0,
    });
  }
  for (let i = 0; i < 11; i++) {
    const [x, y] = slot(i);
    players.push({
      x: PITCH_L - x + ((hash(matchId * 11 + x) % 100) / 100 - 0.5) * 1.2,
      y: y + ((hash(matchId * 13 + y) % 100) / 100 - 0.5) * 1.2,
      vx: 0,
      vy: 0,
      facing: Math.PI,
      home: false,
      role: ROLES[i] ?? "mid",
      slot: i,
      hop: 0,
      off: false,
      card: 0,
    });
  }
  const playSec = Math.max(0, opts?.playSec ?? 0);
  const phase = opts?.phase ?? "first";
  const atHt = phase === "ht";
  const inPlay =
    !atHt &&
    (playSec > 20 || phase === "second" || phase === "added" || phase === "ft");
  const kickSide: 1 | -1 = seed % 2 === 0 ? 1 : -1;
  if (inPlay || atHt) {
    const trailHome = homeScore < awayScore;
    const trailAway = awayScore < homeScore;
    for (let i = 0; i < 11; i++) {
      if (atHt) {
        players[i].x = PITCH_L / 2 - 8 + (players[i].slot - 5) * 1.4;
        players[i].y = PITCH_W / 2 + (players[i].slot % 3 - 1) * 6;
      } else {
        players[i].x = clamp(
          players[i].x + (trailHome ? 10 : trailAway ? -3 : 4),
          5,
          72,
        );
      }
    }
    for (let i = 11; i < 22; i++) {
      if (atHt) {
        players[i].x = PITCH_L / 2 + 8 + (players[i].slot - 5) * 1.4;
        players[i].y = PITCH_W / 2 + (players[i].slot % 3 - 1) * 6;
      } else {
        players[i].x = clamp(
          players[i].x + (trailAway ? -10 : trailHome ? 3 : -4),
          33,
          100,
        );
      }
    }
  }
  const possession: 1 | -1 = kickSide;
  const kick = kickSide === 1 ? 6 : 17;
  if (!inPlay && !atHt) {
    players[kick].x = PITCH_L / 2 - kickSide * 2.2;
    players[kick].y = PITCH_W / 2;
  }
  const carrier = kick;
  if (inPlay) {
    const mid = players[carrier];
    mid.x = clamp(PITCH_L / 2 + kickSide * 6, 18, PITCH_L - 18);
    mid.y = PITCH_W / 2 + ((hash(matchId + 5) % 100) / 100 - 0.5) * 10;
  }
  const minute = Math.max(0, Math.floor(playSec / 60));
  const addedArmed: 0 | 1 | 2 =
    phase === "added" && playSec >= 90 * 60
      ? 2
      : phase === "second" || phase === "ht" || phase === "added" || phase === "ft"
        ? 1
        : 0;
  const joinClock =
    phase === "ht" ? "HT" : phase === "ft" ? "FT" : `${minute}'`;
  return {
    mode: atHt || phase === "ft" ? "ht" : inPlay ? "hold" : "set",
    ballX: inPlay ? players[carrier].x + kickSide * 1.15 : PITCH_L / 2,
    ballY: inPlay ? players[carrier].y : PITCH_W / 2,
    ballZ: 0.4,
    carrier: atHt ? -1 : carrier,
    possession,
    holdT: inPlay ? 0.85 : 0,
    flight: "pass",
    from: kick,
    to: -1,
    t: 0,
    dur: 0,
    x0: PITCH_L / 2,
    y0: PITCH_W / 2,
    x1: PITCH_L / 2,
    y1: PITCH_W / 2,
    curve: 0,
    pendingGoal: 0,
    shotMustScore: false,
    chanceAt: -10,
    homeGoals: homeScore,
    awayGoals: awayScore,
    lastTouch: possession,
    dead: "kickoff",
    deadT: 0,
    set: "kickoff",
    setT: inPlay || atHt ? 0 : 1.1,
    kicker: kick,
    foulX: PITCH_L / 2,
    foulY: PITCH_W / 2,
    lastPasser: -1,
    lastPassAt: -10,
    time: 0,
    caption: atHt ? "HALF-TIME" : inPlay ? "" : "KICK-OFF",
    captionSub: "",
    captionKind: atHt ? "stop" : inPlay ? "play" : "set",
    captionT: atHt ? 1.2 : inPlay ? 0 : 1.4,
    sting: !inPlay && !atHt,
    feed: [],
    feedStamp: 0,
    decisions: inPlay
      ? [{ clock: joinClock, text: "Live", kind: "play" }]
      : atHt
        ? [{ clock: "HT", text: "Half-time", kind: "stop" }]
        : [{ clock: "0'", text: "Kick-off", kind: "set" }],
    decisionStamp: 1,
    players,
    trail: [],
    seed,
    htArmed: atHt,
    ftArmed: phase === "ft",
    addedArmed,
    kickOffFirst: possession,
    offsideArmed: false,
    noOffside: true,
  };
}

export type SimInput = {
  dt: number;
  phase: LivePhase;
  homeScore: number;
  awayScore: number;
  homeRating: number;
  awayRating: number;
  homeShort: string;
  awayShort: string;
  reduced: boolean;
  playSec: number;
};

function ownBox(x: number, y: number, home: boolean): boolean {
  return inBox(x, y, home ? -1 : 1);
}

function shapeTarget(
  state: SimState,
  i: number,
): { x: number; y: number } {
  const p = state.players[i];
  const [sx, sy] = slot(p.slot);
  const home = p.home;
  const dir = home ? 1 : -1;
  const ownGoalX = home ? 0 : PITCH_L;
  const attack = state.possession === (home ? 1 : -1);
  const ballX = state.ballX;
  const ballY = state.ballY;
  const ballOwn = home ? ballX < PITCH_L / 2 : ballX > PITCH_L / 2;

  if (p.off) {
    return { x: home ? 8 : PITCH_L - 8, y: 2.2 };
  }

  if (p.role === "gk") {
    const gx = ownGoalX;
    const gy = PITCH_W / 2;
    const dx = ballX - gx;
    const dy = ballY - gy;
    const len = Math.max(10, Math.hypot(dx, dy));
    const inThird = home ? ballX < 40 : ballX > PITCH_L - 40;
    const come = inThird || ownBox(ballX, ballY, home);
    const off = come ? clamp(ownBox(ballX, ballY, home) ? 11 : 6.2, 4.2, 14) : 4.4;
    let x = gx + (dx / len) * off;
    let y = gy + (dy / len) * off * 0.72;
    x = clamp(x, home ? 2.6 : PITCH_L - 15, home ? 15 : PITCH_L - 2.6);
    y = clamp(y, 26, 42);
    return { x, y };
  }

  const depth = attack ? (ballOwn ? 0.9 : 1.06) : ballOwn ? 0.68 : 0.82;
  const shiftX =
    (ballX - PITCH_L / 2) *
    (p.role === "cb" ? 0.08 : p.role === "fb" ? 0.14 : p.role === "mid" ? 0.2 : 0.26);
  const shiftY =
    (ballY - PITCH_W / 2) *
    (p.role === "cb" ? 0.12 : p.role === "mid" ? 0.22 : 0.28);
  const push = attack
    ? p.role === "st"
      ? 10
      : p.role === "winger"
        ? 8
        : p.role === "mid"
          ? 5
          : p.role === "fb"
            ? 6
            : 2
    : p.role === "st"
      ? -6
      : p.role === "winger"
        ? -4
        : p.role === "mid"
          ? -2
          : 0;
  let x = ownGoalX + dir * sx * depth + shiftX + push * dir;
  let y = sy + shiftY;
  if (p.role === "fb") {
    y = p.slot === 1 ? clamp(y, 6, 18) : clamp(y, 50, 62);
  } else if (p.role === "cb") {
    x = home ? clamp(x, 8, 50) : clamp(x, 55, 97);
  } else if (p.role === "st") {
    x = home ? clamp(x, 38, 98) : clamp(x, 7, 67);
  } else if (p.role === "winger") {
    y = p.slot === 8 ? clamp(y, 6, 22) : clamp(y, 46, 62);
  }
  return {
    x: clamp(x, 4, PITCH_L - 4),
    y: clamp(y, 3.5, PITCH_W - 3.5),
  };
}

function moveToward(
  p: SimPlayer,
  tx: number,
  ty: number,
  dt: number,
  speed: number,
  ballX: number,
  ballY: number,
): void {
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  const arrive = Math.max(1.1, speed * 0.38);
  const want = d < 0.35 ? 0 : d < arrive ? speed * (d / arrive) : speed;
  const wx = d > 0.02 ? (dx / d) * want : 0;
  const wy = d > 0.02 ? (dy / d) * want : 0;
  const acc = p.role === "gk" ? 16 : 22;
  p.vx += clamp(wx - p.vx, -acc * dt, acc * dt);
  p.vy += clamp(wy - p.vy, -acc * dt, acc * dt);
  p.x = clamp(p.x + p.vx * dt, 1.5, PITCH_L - 1.5);
  p.y = clamp(p.y + p.vy * dt, 1.2, PITCH_W - 1.2);
  const spd = Math.hypot(p.vx, p.vy);
  if (p.role === "gk" && spd < 1.6) {
    p.facing = Math.atan2(ballY - p.y, ballX - p.x);
  } else if (spd > 0.9) {
    p.facing = Math.atan2(p.vy, p.vx);
  }
}

function separate(state: SimState): void {
  for (let i = 0; i < 21; i++) {
    const a = state.players[i];
    if (a.off) continue;
    for (let j = i + 1; j < 22; j++) {
      const b = state.players[j];
      if (b.off) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.role === "gk" || b.role === "gk" ? 4.4 : 3.6;
      if (d < 0.05 || d >= min) continue;
      const push = ((min - d) * 0.46) / d;
      if (i !== state.carrier) {
        a.x -= dx * push;
        a.y -= dy * push;
      }
      if (j !== state.carrier) {
        b.x += dx * push;
        b.y += dy * push;
      }
    }
  }
}

function stepPlayers(state: SimState, dt: number, frozen: boolean): void {
  const pressN = 2;
  const supportN = 2;
  const oppStart = startOf(state.possession === 1 ? -1 : 1);
  const ownStart = startOf(state.possession);
  const press: number[] = [];
  const support: number[] = [];
  if (!frozen && state.mode !== "ht") {
    const rankedOpp: { i: number; d: number }[] = [];
    const rankedOwn: { i: number; d: number }[] = [];
    for (let i = 0; i < 22; i++) {
      const p = state.players[i];
      if (p.off) continue;
      const d = dist(p.x, p.y, state.ballX, state.ballY);
      if (i >= oppStart && i < oppStart + 11 && p.role !== "gk") {
        rankedOpp.push({ i, d });
      }
      if (
        i >= ownStart &&
        i < ownStart + 11 &&
        i !== state.carrier &&
        p.role !== "gk"
      ) {
        rankedOwn.push({ i, d });
      }
    }
    rankedOpp.sort((a, b) => a.d - b.d);
    rankedOwn.sort((a, b) => a.d - b.d);
    for (let k = 0; k < pressN && k < rankedOpp.length; k++) press.push(rankedOpp[k].i);
    for (let k = 0; k < supportN && k < rankedOwn.length; k++) {
      support.push(rankedOwn[k].i);
    }
  }

  const crossClaim =
    state.mode === "flight" &&
    (state.flight === "cross" || state.flight === "shot") &&
    (state.x1 > PITCH_L - 18 || state.x1 < 18);

  for (let i = 0; i < 22; i++) {
    const p = state.players[i];
    let { x: tx, y: ty } = shapeTarget(state, i);
    if (state.mode === "celebrate") {
      const scorerSide = state.ballX > PITCH_L / 2 ? 1 : -1;
      if (sideOf(i) === scorerSide && !p.off) {
        const flagY = state.ballY < PITCH_W / 2 ? 4 : PITCH_W - 4;
        const flagX = scorerSide === 1 ? PITCH_L - 4 : 4;
        const d = dist(p.x, p.y, flagX, flagY);
        if (p.role !== "gk" && d < 38) {
          tx = flagX + ((i % 5) - 2) * 1.5;
          ty = flagY + ((i % 3) - 1) * 1.8;
        }
        p.hop = Math.abs(Math.sin(state.time * 14 + i)) * 1.15;
      } else {
        p.hop *= Math.pow(0.2, dt);
      }
    } else if (state.mode === "ht") {
      tx = PITCH_L / 2 + (p.home ? -8 : 8) + (p.slot - 5) * 1.4;
      ty = PITCH_W / 2 + (p.slot % 3 - 1) * 6;
      p.hop *= Math.pow(0.15, dt);
    } else if (state.mode === "set") {
      const ball = { x: state.ballX, y: state.ballY };
      if (i === state.kicker) {
        if (state.set === "penalty") {
          tx = ball.x - state.possession * 4.5;
          ty = ball.y;
        } else if (state.set === "kickoff") {
          tx = ball.x - state.possession * 2.2;
          ty = ball.y;
        } else if (state.set === "goalkick") {
          tx = ball.x + (ball.x < PITCH_L / 2 ? 0.9 : -0.9);
          ty = ball.y + (ball.y < PITCH_W / 2 ? 1.5 : -1.5);
        } else if (state.set === "corner") {
          tx = ball.x + (ball.x < PITCH_L / 2 ? 0.15 : -0.15);
          ty = ball.y < PITCH_W / 2 ? 1.6 : PITCH_W - 1.6;
        } else if (state.set === "throw") {
          tx = ball.x;
          ty = ball.y < PITCH_W / 2 ? 1.5 : PITCH_W - 1.5;
        } else {
          tx = ball.x - state.possession * 2.8;
          ty = ball.y;
        }
      } else if (state.set === "kickoff") {
        const kicking = sideOf(i) === state.possession;
        if (p.home) {
          tx = clamp(tx, 3, PITCH_L / 2 - (kicking ? 1.2 : 0.4));
        } else {
          tx = clamp(tx, PITCH_L / 2 + (kicking ? 1.2 : 0.4), PITCH_L - 3);
        }
        if (!kicking) {
          const dx = tx - PITCH_L / 2;
          const dy = ty - PITCH_W / 2;
          const d = Math.hypot(dx, dy);
          if (d < 9.15) {
            const scale = 9.3 / Math.max(0.2, d);
            tx = PITCH_L / 2 + dx * scale;
            ty = PITCH_W / 2 + dy * scale;
          }
        }
      } else if (state.set === "goalkick" && sideOf(i) !== state.possession) {
        if (state.possession === 1 && tx < BOX + 1.2) tx = BOX + 1.8;
        if (state.possession === -1 && tx > PITCH_L - BOX - 1.2) {
          tx = PITCH_L - BOX - 1.8;
        }
      } else if (state.set === "throw" && sideOf(i) !== state.possession) {
        const d = dist(tx, ty, ball.x, ball.y);
        if (d < 2) {
          const dx = tx - ball.x;
          const dy = ty - ball.y;
          const scale = 2.2 / Math.max(0.2, d);
          tx = ball.x + dx * scale;
          ty = ball.y + dy * scale;
        }
      } else if (state.set === "penalty") {
        if (p.role === "gk" && sideOf(i) !== state.possession) {
          const line = state.possession === 1 ? PITCH_L - 0.35 : 0.35;
          const post = GOAL_H / 2 - 0.35;
          tx = line;
          ty = clamp(
            PITCH_W / 2 + Math.sin(state.time * 3) * 1.15,
            PITCH_W / 2 - post,
            PITCH_W / 2 + post,
          );
        } else if (p.role !== "gk") {
          const behind = state.possession === 1 ? ball.x - 9.4 : ball.x + 9.4;
          const boxLine = state.possession === 1 ? PITCH_L - BOX - 1.2 : BOX + 1.2;
          tx = state.possession === 1 ? Math.min(behind, boxLine) : Math.max(behind, boxLine);
          ty = 12 + (p.slot % 9) * 5;
        }
      } else if (state.set === "freekick") {
        const danger = dangerousFk(state);
        const def = sideOf(i) !== state.possession;
        if (def && p.role === "gk") {
          if (danger) {
            tx = state.possession === 1 ? PITCH_L - 1.4 : 1.4;
            ty = PITCH_W / 2 + (state.ballY - PITCH_W / 2) * 0.12;
          }
        } else if (def && danger && p.role !== "gk") {
          const wallSlots = [2, 3, 1, 4];
          const wallI = wallSlots.indexOf(p.slot);
          const nWall = fkWallCount(state);
          if (wallI >= 0 && wallI < nWall) {
            const goalX = state.possession === 1 ? PITCH_L : 0;
            const goalY = PITCH_W / 2;
            const dx = goalX - ball.x;
            const dy = goalY - ball.y;
            const len = Math.max(1, Math.hypot(dx, dy));
            const ux = dx / len;
            const uy = dy / len;
            const along = (wallI - (nWall - 1) / 2) * 1.65;
            tx = clamp(ball.x + ux * 9.15 - uy * along, 3, PITCH_L - 3);
            ty = clamp(ball.y + uy * 9.15 + ux * along, 3, PITCH_W - 3);
          }
        } else if (!def && danger && (p.role === "st" || p.role === "winger")) {
          const boxX = state.possession === 1 ? 96 : 9;
          tx = boxX + ((p.slot % 3) - 1) * 2.4;
          ty = 26 + (p.slot % 4) * 5;
        }
      } else if (state.set === "corner") {
        const boxX = state.possession === 1 ? 94 : 11;
        if (sideOf(i) === state.possession && (p.role === "st" || p.role === "mid")) {
          tx = boxX + ((p.slot % 3) - 1) * 3.2;
          ty = 28 + (p.slot % 5) * 3.5;
        } else if (sideOf(i) !== state.possession && p.role !== "gk") {
          tx = boxX + (state.possession === 1 ? -3 : 3);
          ty = 24 + (p.slot % 6) * 4;
        }
      }
      p.hop *= Math.pow(0.2, dt);
    } else {
      p.hop *= Math.pow(0.25, dt);
      if (crossClaim && p.role === "gk" && sideOf(i) !== state.possession) {
        tx = lerp(tx, state.x1, 0.62);
        ty = lerp(ty, state.y1, 0.62);
      } else if (i === state.carrier && state.mode === "hold") {
        if (p.role === "gk") {
          const goalX = p.home ? 0 : PITCH_L;
          const out = p.home ? 1 : -1;
          tx = goalX + out * 8.5;
          ty = lerp(p.y, PITCH_W / 2, 0.16);
        } else {
          const opp = nearest(
            state,
            sideOf(i) === 1 ? -1 : 1,
            p.x,
            p.y,
          );
          const o = state.players[opp];
          const pdx = p.x - o.x;
          const pdy = p.y - o.y;
          const pd = Math.max(0.45, Math.hypot(pdx, pdy));
          const dir = state.possession;
          const inFinal = dir === 1 ? p.x > 68 : p.x < 37;
          if (pd < 5.8) {
            tx = p.x + (pdx / pd) * 4.6 + dir * 2.4;
            ty = p.y + (pdy / pd) * 3.4;
          } else if (inFinal) {
            tx = p.x + dir * 9;
            ty = lerp(p.y, PITCH_W / 2, 0.24);
          } else {
            tx = p.x + dir * 11;
            ty = p.y + (PITCH_W / 2 - p.y) * 0.08;
          }
          tx = clamp(tx, 5, PITCH_L - 5);
          ty = clamp(ty, 5, PITCH_W - 5);
        }
      } else if (press.includes(i)) {
        const k = press.indexOf(i);
        const ang = Math.atan2(state.ballY - p.y, state.ballX - p.x);
        const gap = 2.5 + k * 0.55;
        const side = k === 0 ? 0.4 : k % 2 === 0 ? 1.9 : -1.9;
        tx = state.ballX - Math.cos(ang) * gap - Math.sin(ang) * side;
        ty = state.ballY - Math.sin(ang) * gap + Math.cos(ang) * side;
      } else if (support.includes(i)) {
        const k = support.indexOf(i);
        if (k === 0) {
          tx = state.ballX + state.possession * 12;
          ty = state.ballY + (p.y < PITCH_W / 2 ? -6 : 6);
        } else {
          tx = state.ballX - state.possession * 8;
          ty = state.ballY + (p.slot % 2 === 0 ? 9 : -9);
        }
      }
    }
    const gap = dist(p.x, p.y, tx, ty);
    let speed = 4.5;
    if (frozen) speed = 2.1;
    else if (p.role === "gk") speed = crossClaim ? 6.6 : 3.3;
    else if (i === state.carrier) speed = 6.4;
    else if (press.includes(i)) speed = 7.3;
    else if (support.includes(i)) speed = 6.5;
    else speed = gap > 18 ? 7.0 : gap > 8 ? 5.4 : 3.6;
    moveToward(p, tx, ty, dt, speed, state.ballX, state.ballY);
  }
  separate(state);
}

function decideHold(state: SimState, input: SimInput): void {
  const i = state.carrier;
  if (i < 0) {
    state.carrier = nearest(state, state.possession, state.ballX, state.ballY);
    glueBall(state, state.carrier);
    return;
  }
  const p = state.players[i];
  const dir = sideOf(i);
  const skill = edge(input, dir);
  const inFinal = dir === 1 ? p.x > 68 : p.x < 37;
  const boxed = inBox(p.x, p.y, dir);
  const nearWing = p.y < 12 || p.y > 56;
  const late = input.playSec >= 80 * 60;
  const added = input.phase === "added";
  const trail =
    (dir === 1 && state.homeGoals < state.awayGoals) ||
    (dir === -1 && state.awayGoals < state.homeGoals);
  const lead =
    (dir === 1 && state.homeGoals > state.awayGoals) ||
    (dir === -1 && state.awayGoals > state.homeGoals);
  const heat = (late && trail ? 0.1 : 0) + (added && trail ? 0.08 : 0);
  const r = rand(state);
  const presser = nearest(state, dir === 1 ? -1 : 1, p.x, p.y);
  const pressD = dist(p.x, p.y, state.players[presser].x, state.players[presser].y);

  if (state.pendingGoal === dir && (inFinal || boxed)) {
    beginShot(state, input, i, true);
    return;
  }
  if (p.role === "gk") {
    if (r < 0.28) {
      const clearTo = p.y < PITCH_W / 2 ? 10 : PITCH_W - 10;
      beginFlight(
        state,
        "clear",
        i,
        p.x + dir * (28 + rand(state) * 18),
        clearTo,
        -1,
        4.5,
      );
      setCaption(state, "play", `Clearance · ${club(input, dir)}`, 0.85, false);
      return;
    }
    beginPass(state, input, i, false);
    return;
  }
  if (pressD < 2.7 && r < 0.2 - skill * 0.06 + (late && lead ? 0.06 : 0)) {
    const foul = rand(state) < 0.18;
    if (foul) {
      const advantage = !boxed && inFinal && rand(state) < 0.32;
      if (advantage) {
        setCaption(state, "play", `Advantage · ${club(input, dir)}`, 0.9, false);
        beginPass(state, input, i, nearWing);
        return;
      }
      state.foulX = p.x;
      state.foulY = p.y;
      state.possession = dir;
      if (boxed) {
        if (rand(state) < 0.42) {
          beginDead(
            state,
            input,
            "var",
            2.1,
            `Possible penalty · ${club(input, dir)}`,
            "var",
            true,
          );
        } else {
          beginDead(
            state,
            input,
            "penalty",
            1.6,
            `Penalty · ${club(input, dir)}`,
            "set",
            true,
          );
        }
        return;
      }
      const cardRoll = rand(state);
      const already = state.players[presser].card;
      if (cardRoll < 0.004 && already < 2) {
        state.players[presser].card = 2;
        state.players[presser].off = true;
        beginDead(
          state,
          input,
          "card",
          2.4,
          `Red card · ${club(input, sideOf(presser))}`,
          "red",
          true,
        );
      } else if (cardRoll < 0.07 && already < 2) {
        const next: 1 | 2 = already === 1 ? 2 : 1;
        state.players[presser].card = next;
        if (next === 2) state.players[presser].off = true;
        beginDead(
          state,
          input,
          "card",
          2.05,
          next === 2
            ? `Second yellow · ${club(input, sideOf(presser))}`
            : `Yellow card · ${club(input, sideOf(presser))}`,
          next === 2 ? "red" : "card",
          true,
        );
      } else {
        beginDead(
          state,
          input,
          "foul",
          1.25,
          `Foul · free kick ${club(input, dir)}`,
          "stop",
          true,
        );
      }
      return;
    }
    state.possession = sideOf(presser);
    state.carrier = presser;
    glueBall(state, presser);
    state.holdT = 0.5 + rand(state) * 0.45;
    setCaption(state, "play", `Tackle · ${club(input, sideOf(presser))}`, 0.85, true);
    return;
  }
  if (state.pendingGoal === dir) {
    beginPass(state, input, i, nearWing && inFinal);
    return;
  }
  const inOwn = dir === 1 ? p.x < 42 : p.x > PITCH_L - 42;
  if (inOwn && r < 0.72) {
    beginPass(state, input, i, false);
    return;
  }
  if (
    (boxed && r < 0.12 + skill * 0.07 + heat) ||
    (inFinal && boxed && r < 0.08 + skill * 0.04 + heat * 0.5)
  ) {
    beginShot(state, input, i, false);
    return;
  }
  if (inFinal && nearWing && r < 0.34 + (late && trail ? 0.12 : 0)) {
    beginPass(state, input, i, true);
    return;
  }
  if (r < 0.07 && (p.role === "cb" || p.role === "fb") && !inFinal) {
    const clearTo = p.y < PITCH_W / 2 ? 8 : PITCH_W - 8;
    beginFlight(
      state,
      "clear",
      i,
      p.x + dir * (18 + rand(state) * 16),
      clearTo,
      -1,
      3,
    );
    setCaption(state, "play", `Clearance · ${club(input, dir)}`, 0.8, false);
    return;
  }
  beginPass(state, input, i, false);
}

function finishShot(state: SimState, input: SimInput): void {
  const last = state.lastTouch;
  const posts = GOAL_H / 2;
  const inGoal = Math.abs(state.ballY - PITCH_W / 2) < posts;
  const goalSide: 1 | -1 = state.ballX > PITCH_L / 2 ? 1 : -1;
  const must = state.shotMustScore || (state.pendingGoal === last && inGoal);
  state.shotMustScore = false;
  if (must) {
    const scored: 1 | -1 = last === goalSide ? last : goalSide;
    beginCelebrate(state, input, scored, last !== goalSide);
    return;
  }
  if (inGoal) {
    const gk = startOf(goalSide === 1 ? -1 : 1);
    state.possession = sideOf(gk);
    state.carrier = gk;
    glueBall(state, gk);
    state.mode = "hold";
    state.holdT = 0.7 + rand(state) * 0.5;
    setCaption(
      state,
      "save",
      "SAVE",
      1.5,
      true,
      club(input, state.possession),
      true,
    );
    recordDecision(
      state,
      input,
      "save",
      `Save · ${club(input, state.possession)}`,
    );
    return;
  }
  if (Math.abs(state.ballY - PITCH_W / 2) < posts + 2.2 && rand(state) < 0.58) {
    const gk = startOf(goalSide === 1 ? -1 : 1);
    state.possession = sideOf(gk);
    state.carrier = gk;
    glueBall(state, gk);
    state.mode = "hold";
    state.holdT = 0.7 + rand(state) * 0.5;
    setCaption(
      state,
      "save",
      "SAVE",
      1.5,
      true,
      club(input, state.possession),
      true,
    );
    recordDecision(
      state,
      input,
      "save",
      `Save · ${club(input, state.possession)}`,
    );
    return;
  }
  if (last === goalSide) {
    state.possession = goalSide === 1 ? -1 : 1;
    state.foulY = state.ballY;
    beginDead(
      state,
      input,
      "goalkick",
      0.9,
      `Goal kick · ${club(input, state.possession)}`,
      "out",
      false,
    );
    return;
  }
  state.possession = goalSide;
  state.foulY = state.ballY;
  beginDead(
    state,
    input,
    "corner",
    0.95,
    `Corner · ${club(input, state.possession)}`,
    "set",
    true,
  );
}

function finishFlight(state: SimState, input: SimInput): void {
  state.ballX = state.x1;
  state.ballY = state.y1;
  state.ballZ = 0.3;
  if (state.flight === "shot") {
    finishShot(state, input);
    return;
  }
  const defGk = startOf(state.lastTouch === 1 ? -1 : 1);
  const gk = state.players[defGk];
  if (
    (state.flight === "cross" || state.flight === "clear") &&
    dist(gk.x, gk.y, state.ballX, state.ballY) < 4.5 &&
    rand(state) < 0.42
  ) {
    state.possession = sideOf(defGk);
    state.carrier = defGk;
    glueBall(state, defGk);
    state.mode = "hold";
    state.holdT = 1.05 + rand(state) * 0.4;
    setCaption(state, "chance", `Claim · ${club(input, state.possession)}`, 1.15, true);
    return;
  }
  if (state.ballY < 0 || state.ballY > PITCH_W) {
    state.foulY = state.ballY;
    state.possession = state.lastTouch === 1 ? -1 : 1;
    state.ballY = clamp(state.ballY, 0.8, PITCH_W - 0.8);
    state.ballX = clamp(state.ballX, 4, PITCH_L - 4);
    beginDead(
      state,
      input,
      "throw",
      0.85,
      `Throw-in · ${club(input, state.possession)}`,
      "out",
      false,
    );
    return;
  }
  if (state.ballX < 0 || state.ballX > PITCH_L) {
    const attackEnd = state.ballX > PITCH_L / 2 ? 1 : -1;
    const last = state.lastTouch;
    if (last === attackEnd) {
      state.possession = attackEnd === 1 ? -1 : 1;
      beginDead(
        state,
        input,
        "goalkick",
        0.9,
        `Goal kick · ${club(input, state.possession)}`,
        "out",
        false,
      );
    } else {
      state.possession = attackEnd;
      state.foulY = state.ballY;
      beginDead(
        state,
        input,
        "corner",
        0.95,
        `Corner · ${club(input, state.possession)}`,
        "set",
        true,
      );
    }
    return;
  }
  if (state.to >= 0 && !state.players[state.to].off) {
    const interceptor = nearest(
      state,
      sideOf(state.to) === 1 ? -1 : 1,
      state.ballX,
      state.ballY,
    );
    const dInt = dist(
      state.players[interceptor].x,
      state.players[interceptor].y,
      state.ballX,
      state.ballY,
    );
    const dTo = dist(
      state.players[state.to].x,
      state.players[state.to].y,
      state.ballX,
      state.ballY,
    );
    if (dInt < 3.1 && dInt < dTo * 0.88 && rand(state) < 0.22 - edge(input, sideOf(state.to)) * 0.1) {
      state.carrier = interceptor;
      glueBall(state, interceptor);
      state.mode = "hold";
      state.holdT = 0.45 + rand(state) * 0.4;
      setCaption(
        state,
        "play",
        `Interception · ${club(input, sideOf(interceptor))}`,
        0.9,
        true,
      );
      return;
    }
    const recv = state.players[state.to];
    const att = sideOf(state.to);
    if (state.offsideArmed) {
      state.foulX = recv.x;
      state.foulY = recv.y;
      state.possession = att === 1 ? -1 : 1;
      state.offsideArmed = false;
      beginDead(
        state,
        input,
        "offside",
        1.85,
        `Offside · ${club(input, att)}`,
        "offside",
        true,
      );
      return;
    }
    state.carrier = state.to;
    glueBall(state, state.to);
    state.mode = "hold";
    state.holdT =
      recv.role === "gk"
        ? 1.05 + rand(state) * 0.4
        : recv.role === "cb"
          ? 0.72 + rand(state) * 0.35
          : recv.role === "st"
            ? 0.34 + rand(state) * 0.28
            : 0.5 + rand(state) * (state.flight === "cross" ? 0.35 : 0.48);
    return;
  }
  const claim = nearest(state, state.lastTouch, state.ballX, state.ballY);
  const other = nearest(
    state,
    state.lastTouch === 1 ? -1 : 1,
    state.ballX,
    state.ballY,
  );
  const dClaim = dist(state.players[claim].x, state.players[claim].y, state.ballX, state.ballY);
  const dOther = dist(state.players[other].x, state.players[other].y, state.ballX, state.ballY);
  const winner = dOther < dClaim * 0.7 ? other : claim;
  state.carrier = winner;
  glueBall(state, winner);
  state.mode = "hold";
  state.holdT = 0.4 + rand(state) * 0.5;
}

function takeSet(state: SimState, input: SimInput): void {
  const k = state.kicker;
  if (state.set === "kickoff") {
    state.noOffside = true;
    beginPass(state, input, k, false);
    return;
  }
  if (state.set === "penalty") {
    beginShot(
      state,
      input,
      k,
      state.pendingGoal === state.possession || rand(state) < 0.74,
    );
    return;
  }
  if (state.set === "throw") {
    state.noOffside = true;
    beginPass(state, input, k, false);
    return;
  }
  if (state.set === "corner") {
    state.noOffside = true;
    const boxX = state.possession === 1 ? 97 : 8;
    const target = nearest(state, state.possession, boxX, PITCH_W / 2, k);
    const p = state.players[target];
    beginFlight(state, "cross", k, p.x, p.y, target, 7.5);
    setCaption(state, "set", `Corner · ${club(input, state.possession)}`, 1.1, false);
    return;
  }
  if (state.set === "goalkick") {
    state.noOffside = true;
    const winger = startOf(state.possession) + (rand(state) < 0.5 ? 8 : 10);
    const p = state.players[winger];
    beginFlight(state, "clear", k, p.x, p.y, winger, 4);
    return;
  }
  const range = shotRange(state.ballX, state.possession);
  if (dangerousFk(state) && rand(state) < 0.62) {
    beginShot(state, input, k, state.pendingGoal === state.possession);
    return;
  }
  if (range < 36 && rand(state) < 0.22) {
    beginShot(state, input, k, false);
    return;
  }
  beginPass(state, input, k, false);
}

function afterDead(state: SimState, input: SimInput): void {
  if (state.dead === "foul" || state.dead === "card") {
    beginSet(state, input, "freekick");
    return;
  }
  if (state.dead === "var") {
    beginSet(state, input, "penalty");
    return;
  }
  if (state.dead === "offside") {
    beginSet(state, input, "freekick");
    return;
  }
  if (state.dead === "penalty") {
    beginSet(state, input, "penalty");
    return;
  }
  if (state.dead === "throw") {
    beginSet(state, input, "throw");
    return;
  }
  if (state.dead === "corner") {
    beginSet(state, input, "corner");
    return;
  }
  if (state.dead === "goalkick") {
    beginSet(state, input, "goalkick");
    return;
  }
  if (state.dead === "kickoff") {
    beginSet(state, input, "kickoff");
    return;
  }
  state.mode = "hold";
  state.carrier = nearest(state, state.possession, state.ballX, state.ballY);
  glueBall(state, state.carrier);
  state.holdT = 0.5;
}

export function stepSim(state: SimState, input: SimInput): void {
  const { dt, phase, reduced } = input;
  if (dt <= 0) return;
  state.time += dt;
  if (state.captionT > 0) state.captionT = Math.max(0, state.captionT - dt);

  if (input.homeScore > state.homeGoals) state.pendingGoal = 1;
  else if (input.awayScore > state.awayGoals) state.pendingGoal = -1;

  if (reduced) {
    state.ballX = PITCH_L / 2;
    state.ballY = PITCH_W / 2;
    state.ballZ = 0;
    state.mode = "hold";
    state.caption = "";
    state.captionSub = "";
    state.sting = false;
    for (let i = 0; i < 11; i++) {
      const [sx, sy] = slot(i);
      state.players[i].x = sx;
      state.players[i].y = sy;
      state.players[i].hop = 0;
      state.players[i + 11].x = PITCH_L - sx;
      state.players[i + 11].y = sy;
      state.players[i + 11].hop = 0;
    }
    return;
  }

  if (phase === "added") {
    const half: 1 | 2 = input.playSec >= 90 * 60 ? 2 : 1;
    if (state.addedArmed < half) {
      state.addedArmed = half;
      setCaption(
        state,
        "added",
        "ADDED TIME",
        2.5,
        true,
        half === 2 ? "SECOND HALF" : "FIRST HALF",
      );
      recordDecision(state, input, "added", "Added time");
    }
  }

  if (phase === "ft") {
    if (!state.ftArmed) {
      state.ftArmed = true;
      state.mode = "ht";
      setCaption(state, "stop", "FULL TIME", 4, true);
      recordDecision(state, input, "stop", "Full time");
    }
    state.ballX += (PITCH_L / 2 - state.ballX) * Math.min(1, 2.4 * dt);
    state.ballY += (PITCH_W / 2 - state.ballY) * Math.min(1, 2.4 * dt);
    state.ballZ *= Math.pow(0.2, dt);
    stepPlayers(state, dt, true);
    pushTrail(state);
    return;
  }

  if (phase === "ht") {
    if (!state.htArmed) {
      state.htArmed = true;
      state.mode = "ht";
      setCaption(state, "stop", "HALF-TIME", 3.2, true);
      recordDecision(state, input, "stop", "Half-time");
    }
    state.ballX += (PITCH_L / 2 - state.ballX) * Math.min(1, 2.4 * dt);
    state.ballY += (PITCH_W / 2 - state.ballY) * Math.min(1, 2.4 * dt);
    state.ballZ *= Math.pow(0.2, dt);
    stepPlayers(state, dt, true);
    pushTrail(state);
    return;
  }
  if (state.htArmed) {
    state.htArmed = false;
    beginKickoff(
      state,
      input,
      state.kickOffFirst === 1 ? -1 : 1,
      "Second-half kick-off",
    );
  }

  if (state.mode === "celebrate") {
    state.holdT -= dt;
    stepPlayers(state, dt, false);
    pushTrail(state);
    if (state.holdT <= 0) {
      beginKickoff(state, input, state.ballX > PITCH_L / 2 ? -1 : 1);
    }
    return;
  }

  if (state.mode === "dead") {
    state.deadT -= dt;
    stepPlayers(state, dt, true);
    pushTrail(state);
    if (state.deadT <= 0) afterDead(state, input);
    return;
  }

  if (state.mode === "set") {
    state.setT -= dt;
    state.carrier = state.kicker;
    stepPlayers(state, dt, false);
    pushTrail(state);
    if (state.setT <= 0) takeSet(state, input);
    return;
  }

  if (state.mode === "flight") {
    state.t += dt;
    const u = clamp(state.t / state.dur, 0, 1);
    const e = u * u * (3 - 2 * u);
    state.ballX = lerp(state.x0, state.x1, e);
    state.ballY = lerp(state.y0, state.y1, e) + Math.sin(u * Math.PI) * state.curve;
    state.ballZ =
      state.flight === "cross"
        ? Math.sin(u * Math.PI) * 7
        : state.flight === "shot"
          ? Math.sin(u * Math.PI) * 2.2
          : Math.sin(u * Math.PI) * 1.4;
    if (state.to >= 0 && u > 0.35) {
      const recv = state.players[state.to];
      recv.x += (state.x1 - recv.x) * Math.min(1, 6 * dt);
      recv.y += (state.y1 - recv.y) * Math.min(1, 6 * dt);
    }
    stepPlayers(state, dt, false);
    pushTrail(state);
    if (u >= 1) finishFlight(state, input);
    return;
  }

  // hold — dribble is steered in stepPlayers; keep the ball on the carrier
  if (
    state.pendingGoal !== 0 &&
    state.mode === "hold" &&
    state.time - state.chanceAt > 1.8
  ) {
    const side = state.pendingGoal;
    const carrier = state.carrier >= 0 ? state.players[state.carrier] : null;
    const inFinal =
      carrier != null && (side === 1 ? carrier.x > 68 : carrier.x < 37);
    const boxed = carrier != null && inBox(carrier.x, carrier.y, side);
    if (!(state.possession === side && (inFinal || boxed))) {
      buildChance(state, side);
    }
  }
  state.holdT -= dt;
  stepPlayers(state, dt, false);
  if (state.carrier >= 0) glueBall(state, state.carrier);
  pushTrail(state);
  if (state.holdT <= 0) decideHold(state, input);
}
