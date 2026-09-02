"use client";

import { useAppState } from "@/components/AppState";
import { ClubCrest } from "@/components/ClubCrest";
import { liveMatchClock, type LivePhase } from "@/lib/live-clock";
import {
  createSim,
  PITCH_L,
  PITCH_W,
  stepSim,
  type SimPlayer,
  type SimState,
} from "@/lib/live-sim";
import type { MatchPitchPlayer, MatchView } from "@/lib/matches";
import { useEffect, useRef } from "react";

type TickFn = (now: number, dt: number) => void;

const ticks = new Set<TickFn>();
let raf = 0;
let interval = 0;
let lastNow = 0;
let leftover = 0;

function pump(now: number): void {
  if (ticks.size === 0) return;
  const raw = lastNow ? (now - lastNow) / 1000 : 1 / 30;
  lastNow = now;
  leftover += Math.min(0.5, Math.max(0, raw));
  while (leftover >= 1 / 60) {
    const dt = Math.min(leftover, 1 / 30);
    leftover -= dt;
    for (const tick of ticks) tick(now, dt);
  }
}

function loop(now: number) {
  pump(now);
  if (ticks.size === 0) {
    raf = 0;
    return;
  }
  raf = window.requestAnimationFrame(loop);
}

function subscribeTick(fn: TickFn): () => void {
  ticks.add(fn);
  if (!raf) {
    leftover = 0;
    raf = window.requestAnimationFrame(loop);
  }
  if (!interval) {
    interval = window.setInterval(() => {
      const now = performance.now();
      if (lastNow && now - lastNow < 20) return;
      pump(now);
    }, 33);
  }
  return () => {
    ticks.delete(fn);
    if (ticks.size > 0) return;
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
    if (interval) window.clearInterval(interval);
    interval = 0;
    lastNow = 0;
    leftover = 0;
  };
}

const RUN = 2.45;
const BOX = 16.5;
const SIX = 5.5;
const GOAL_H = 7.32;
const GOAL_D = 1.95;
const PEN_SPOT = 11;
const CIRCLE = 9.15;
const CORNER = 1;
const BOX_H = 40.32;
const SIX_H = 18.32;

type Kit = { fill: string; stroke: string; ink: string; gk: string };

const KITS: Record<number, Kit> = {
  1: { fill: "#da291c", stroke: "#111", ink: "#fff", gk: "#1f7a4d" },
  3: { fill: "#ef0107", stroke: "#fff", ink: "#fff", gk: "#0b3d2e" },
  4: { fill: "#241f20", stroke: "#fff", ink: "#fff", gk: "#c5a572" },
  6: { fill: "#f5f5f5", stroke: "#132257", ink: "#132257", gk: "#1c7c4a" },
  7: { fill: "#670e36", stroke: "#95bfe5", ink: "#fff", gk: "#1a6b4a" },
  8: { fill: "#034694", stroke: "#fff", ink: "#fff", gk: "#f0c14b" },
  11: { fill: "#003399", stroke: "#fff", ink: "#fff", gk: "#e87722" },
  14: { fill: "#c8102e", stroke: "#fff", ink: "#fff", gk: "#1d4e89" },
  17: { fill: "#e53233", stroke: "#fff", ink: "#fff", gk: "#111" },
  21: { fill: "#7a263a", stroke: "#1bb1e7", ink: "#fff", gk: "#111" },
  31: { fill: "#1b458f", stroke: "#c4122e", ink: "#fff", gk: "#f0c14b" },
  36: { fill: "#0057b8", stroke: "#fff", ink: "#fff", gk: "#111" },
  39: { fill: "#fdb913", stroke: "#111", ink: "#111", gk: "#1b458f" },
  40: { fill: "#0033a1", stroke: "#fff", ink: "#fff", gk: "#e31837" },
  43: { fill: "#6cabdd", stroke: "#fff", ink: "#1c2c5b", gk: "#111" },
  54: { fill: "#f5f5f5", stroke: "#111", ink: "#111", gk: "#1b458f" },
  91: { fill: "#da291c", stroke: "#111", ink: "#fff", gk: "#1a6b4a" },
  94: { fill: "#e30613", stroke: "#fff", ink: "#fff", gk: "#111" },
};

function bugClock(
  playSec: number,
  phase: LivePhase,
): { time: string; added: number | null } {
  if (phase === "ht") return { time: "HT", added: null };
  if (phase === "ft") return { time: "FT", added: null };
  const m = Math.max(0, Math.floor(playSec / 60));
  const s = String(Math.floor(playSec % 60)).padStart(2, "0");
  if (phase === "added") {
    if (playSec >= 90 * 60) {
      return { time: "90:00", added: Math.max(1, m - 90) };
    }
    return { time: "45:00", added: Math.max(1, m - 45) };
  }
  return { time: `${String(m).padStart(2, "0")}:${s}`, added: null };
}

function bugName(short: string): string {
  return short.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || short.slice(0, 3);
}

function kitFor(code: number): Kit {
  const known = KITS[code];
  if (known) return known;
  const hue = (code * 47) % 360;
  return {
    fill: `hsl(${hue} 62% 38%)`,
    stroke: "#fff",
    ink: "#fff",
    gk: "hsl(150 45% 28%)",
  };
}

function tokenR(s: number, gk: boolean): number {
  const r = Math.max(14, Math.min(26, 4.2 * s));
  return gk ? r * 1.18 : r;
}

function drawNamePlate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  pr: number,
): void {
  const label = name.length > 9 ? `${name.slice(0, 8)}.` : name;
  if (!label) return;
  const fs = Math.max(11, Math.min(15, pr * 0.56));
  ctx.font = `700 ${fs}px ui-sans-serif, system-ui`;
  ctx.textBaseline = "top";
  const nameW = ctx.measureText(label).width + 8;
  ctx.fillStyle = "rgba(8,10,14,0.78)";
  ctx.beginPath();
  ctx.roundRect(x - nameW / 2, y, nameW, fs + 4.2, 3);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y + 2);
}

function drawKeeper(
  ctx: CanvasRenderingContext2D,
  p: SimPlayer,
  who: MatchPitchPlayer | undefined,
  kit: Kit,
  s: number,
  x: number,
  y: number,
  mine: boolean,
): void {
  const pr = tokenR(s, true);
  const bw = pr * 1.78;
  const bh = pr * 2.2;
  const fill = kit.gk;
  const num = who?.number ?? 1;
  const name = who?.name ?? "";

  ctx.globalAlpha = p.off ? 0.4 : mine ? 1 : 0.62;
  ctx.beginPath();
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.ellipse(x + 0.8, y + bh * 0.42, bw * 0.48, pr * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x - bw / 2, y - bh * 0.4, bw, bh, pr * 0.3);
  ctx.fill();
  ctx.lineWidth = Math.max(1.6, pr * 0.14);
  ctx.strokeStyle = "#f4efe4";
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.roundRect(x - bw * 0.24, y - bh * 0.4, bw * 0.48, bh * 0.15, 2);
  ctx.fill();

  const gw = pr * 0.48;
  const gh = pr * 0.82;
  ctx.fillStyle = "#141414";
  ctx.beginPath();
  ctx.roundRect(x - bw / 2 - gw * 0.58, y - gh * 0.12, gw, gh, 2.6);
  ctx.roundRect(x + bw / 2 - gw * 0.42, y - gh * 0.12, gw, gh, 2.6);
  ctx.fill();
  ctx.fillStyle = "#ececec";
  ctx.fillRect(x - bw / 2 - gw * 0.58, y + gh * 0.22, gw, Math.max(1.5, pr * 0.08));
  ctx.fillRect(x + bw / 2 - gw * 0.42, y + gh * 0.22, gw, Math.max(1.5, pr * 0.08));

  const fx = x + Math.cos(p.facing) * bw * 0.4;
  const fy = y + Math.sin(p.facing) * bh * 0.26;
  ctx.beginPath();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.arc(fx, fy, Math.max(1.5, pr * 0.16), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = `800 ${Math.max(11, pr * 0.7)}px ui-sans-serif, system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(num), x, y + 1.2);
  if (mine && name) drawNamePlate(ctx, x, y + bh * 0.62, name, pr);

  if (p.card > 0) {
    const cw = pr * 0.5;
    const ch = pr * 0.72;
    ctx.fillStyle = p.card === 2 ? "#ef4444" : "#f5d042";
    ctx.fillRect(x + bw * 0.42, y - bh * 0.55, cw, ch);
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 0.7;
    ctx.strokeRect(x + bw * 0.42, y - bh * 0.55, cw, ch);
  }
  ctx.globalAlpha = 1;
}

function drawPerson(
  ctx: CanvasRenderingContext2D,
  p: SimPlayer,
  who: MatchPitchPlayer | undefined,
  kit: Kit,
  s: number,
  x: number,
  y: number,
  mine: boolean,
): void {
  if (p.role === "gk") {
    drawKeeper(ctx, p, who, kit, s, x, y, mine);
    return;
  }
  const pr = tokenR(s, false);
  const num = who?.number ?? (p.slot === 0 ? 1 : p.slot + 1);
  const name = who?.name ?? "";

  ctx.globalAlpha = p.off ? 0.4 : mine ? 1 : 0.62;
  ctx.beginPath();
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.ellipse(x + 0.7, y + 1.15, pr * 0.92, pr * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = kit.fill;
  ctx.arc(x, y, pr, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(1, pr * 0.18);
  ctx.strokeStyle = kit.stroke;
  ctx.stroke();
  const fx = x + Math.cos(p.facing) * pr * 0.92;
  const fy = y + Math.sin(p.facing) * pr * 0.92;
  ctx.beginPath();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.arc(fx, fy, Math.max(1.2, pr * 0.2), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = kit.ink;
  ctx.font = `800 ${Math.max(10, pr * 0.78)}px ui-sans-serif, system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(num), x, y + 0.4);
  if (mine && name) drawNamePlate(ctx, x, y + pr + 1.6, name, pr);

  if (p.card > 0) {
    const cw = pr * 0.55;
    const ch = pr * 0.8;
    ctx.fillStyle = p.card === 2 ? "#ef4444" : "#f5d042";
    ctx.fillRect(x + pr * 0.45, y - pr * 1.55, cw, ch);
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 0.7;
    ctx.strokeRect(x + pr * 0.45, y - pr * 1.55, cw, ch);
  }
  ctx.globalAlpha = 1;
}

type PitchLayout = { s: number; ox: number; oy: number };

function pitchLayout(w: number, h: number): PitchLayout {
  const s = Math.min(w / (PITCH_L + RUN * 2), h / (PITCH_W + RUN * 2));
  return {
    s,
    ox: (w - s * PITCH_L) / 2,
    oy: (h - s * PITCH_W) / 2,
  };
}

function px(layout: PitchLayout, x: number, y: number): [number, number] {
  return [layout.ox + x * layout.s, layout.oy + y * layout.s];
}

function drawMarkings(
  ctx: CanvasRenderingContext2D,
  lw: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.lineJoin = "miter";
  ctx.miterLimit = 2.4;
  ctx.lineCap = "butt";

  ctx.beginPath();
  ctx.rect(0, 0, PITCH_L, PITCH_W);
  ctx.moveTo(PITCH_L / 2, 0);
  ctx.lineTo(PITCH_L / 2, PITCH_W);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(PITCH_L / 2, PITCH_W / 2, CIRCLE, 0, Math.PI * 2);
  ctx.stroke();

  const boxY = (PITCH_W - BOX_H) / 2;
  const sixY = (PITCH_W - SIX_H) / 2;
  ctx.beginPath();
  ctx.moveTo(0, boxY);
  ctx.lineTo(BOX, boxY);
  ctx.lineTo(BOX, boxY + BOX_H);
  ctx.lineTo(0, boxY + BOX_H);
  ctx.moveTo(PITCH_L, boxY);
  ctx.lineTo(PITCH_L - BOX, boxY);
  ctx.lineTo(PITCH_L - BOX, boxY + BOX_H);
  ctx.lineTo(PITCH_L, boxY + BOX_H);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, sixY);
  ctx.lineTo(SIX, sixY);
  ctx.lineTo(SIX, sixY + SIX_H);
  ctx.lineTo(0, sixY + SIX_H);
  ctx.moveTo(PITCH_L, sixY);
  ctx.lineTo(PITCH_L - SIX, sixY);
  ctx.lineTo(PITCH_L - SIX, sixY + SIX_H);
  ctx.lineTo(PITCH_L, sixY + SIX_H);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, CORNER, 0, Math.PI / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(PITCH_L, 0, CORNER, Math.PI / 2, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(PITCH_L, PITCH_W, CORNER, Math.PI, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, PITCH_W, CORNER, -Math.PI / 2, 0);
  ctx.stroke();

  const gy = (PITCH_W - GOAL_H) / 2;
  ctx.beginPath();
  ctx.moveTo(0, gy);
  ctx.lineTo(-GOAL_D, gy);
  ctx.lineTo(-GOAL_D, gy + GOAL_H);
  ctx.lineTo(0, gy + GOAL_H);
  ctx.moveTo(PITCH_L, gy);
  ctx.lineTo(PITCH_L + GOAL_D, gy);
  ctx.lineTo(PITCH_L + GOAL_D, gy + GOAL_H);
  ctx.lineTo(PITCH_L, gy + GOAL_H);
  ctx.stroke();

  const arcA = Math.acos((BOX - PEN_SPOT) / CIRCLE);
  ctx.beginPath();
  ctx.arc(PEN_SPOT, PITCH_W / 2, CIRCLE, -arcA, arcA);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(
    PITCH_L - PEN_SPOT,
    PITCH_W / 2,
    CIRCLE,
    Math.PI - arcA,
    Math.PI + arcA,
  );
  ctx.stroke();

  const spotR = Math.max(0.34, lw * 1.9);
  for (const [x, y] of [
    [PITCH_L / 2, PITCH_W / 2],
    [PEN_SPOT, PITCH_W / 2],
    [PITCH_L - PEN_SPOT, PITCH_W / 2],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, spotR, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGround(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  const { s, ox, oy } = pitchLayout(w, h);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const bowl = ctx.createRadialGradient(w * 0.5, h * 0.52, h * 0.12, w * 0.5, h * 0.5, h * 0.78);
  bowl.addColorStop(0, "#0f4a2c");
  bowl.addColorStop(0.55, "#0a3520");
  bowl.addColorStop(1, "#071c12");
  ctx.fillStyle = bowl;
  ctx.fillRect(0, 0, w, h);

  const pw = PITCH_L * s;
  const ph = PITCH_W * s;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ox - 2, oy - 2, pw + 4, ph + 4);
  ctx.clip();
  const bands = 13;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#1fa056" : "#178a48";
    ctx.fillRect(ox + (i * pw) / bands, oy, pw / bands + 1, ph);
  }
  const sheen = ctx.createLinearGradient(ox, oy, ox + pw, oy + ph);
  sheen.addColorStop(0, "rgba(255,255,255,0.08)");
  sheen.addColorStop(0.35, "rgba(255,255,255,0)");
  sheen.addColorStop(0.7, "rgba(0,20,8,0.04)");
  sheen.addColorStop(1, "rgba(0,10,4,0.18)");
  ctx.fillStyle = sheen;
  ctx.fillRect(ox, oy, pw, ph);
  ctx.restore();

  const lamps = [
    [ox, oy],
    [ox + pw, oy],
    [ox, oy + ph],
    [ox + pw, oy + ph],
  ] as const;
  for (const [lx, ly] of lamps) {
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, Math.max(pw, ph) * 0.42);
    g.addColorStop(0, "rgba(255,244,210,0.1)");
    g.addColorStop(1, "rgba(255,244,210,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  const gy = (PITCH_W - GOAL_H) / 2;
  ctx.save();
  ctx.setTransform(s, 0, 0, s, ox, oy);
  ctx.fillStyle = "rgba(220,230,220,0.08)";
  ctx.fillRect(-GOAL_D, gy, GOAL_D, GOAL_H);
  ctx.fillRect(PITCH_L, gy, GOAL_D, GOAL_H);
  ctx.strokeStyle = "rgba(230,240,230,0.22)";
  ctx.lineWidth = Math.max(0.08, 0.9 / s);
  for (let n = 1; n <= 4; n++) {
    ctx.beginPath();
    ctx.moveTo(-GOAL_D, gy + (GOAL_H * n) / 5);
    ctx.lineTo(0, gy + (GOAL_H * n) / 5);
    ctx.moveTo(PITCH_L, gy + (GOAL_H * n) / 5);
    ctx.lineTo(PITCH_L + GOAL_D, gy + (GOAL_H * n) / 5);
    ctx.stroke();
  }
  const lw = Math.max(0.12, 1.55 / s);
  drawMarkings(ctx, lw * 2.05, "rgba(8,28,14,0.34)");
  drawMarkings(ctx, lw, "rgba(255,255,255,0.94)");
  ctx.restore();
}

function paint(
  ctx: CanvasRenderingContext2D,
  ground: HTMLCanvasElement,
  sim: SimState,
  w: number,
  h: number,
  homeKit: Kit,
  awayKit: Kit,
  homeXi: MatchPitchPlayer[],
  awayXi: MatchPitchPlayer[],
  squadIds: Set<number>,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(ground, 0, 0);
  const layout = pitchLayout(w, h);
  const { s } = layout;
  const r = Math.max(5.5, 1.85 * s);

  if (sim.mode === "celebrate") {
    ctx.fillStyle = `rgba(255,255,255,${0.08 + 0.08 * Math.sin(sim.time * 16)})`;
    ctx.fillRect(0, 0, w, h);
  } else if (sim.mode === "dead") {
    ctx.fillStyle = "rgba(4,10,8,0.18)";
    ctx.fillRect(0, 0, w, h);
  }

  if (
    sim.mode === "flight" &&
    (sim.flight === "pass" || sim.flight === "cross" || sim.flight === "clear")
  ) {
    const [x0, y0] = px(layout, sim.x0, sim.y0);
    const [x1, y1] = px(layout, sim.x1, sim.y1);
    const [cx, cy] = px(
      layout,
      (sim.x0 + sim.x1) / 2,
      (sim.y0 + sim.y1) / 2 + sim.curve,
    );
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,220,0.62)";
    ctx.lineWidth = Math.max(1.4, 0.24 * s);
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.stroke();
    ctx.restore();
  }

  if (sim.mode === "set") {
    const shotFk =
      sim.set === "freekick" &&
      (sim.possession === 1 ? sim.ballX > PITCH_L - 28 : sim.ballX < 28) &&
      Math.abs(sim.ballY - PITCH_W / 2) < 22;
    if (sim.set === "penalty" || shotFk) {
      const [bx, by] = px(layout, sim.ballX, sim.ballY);
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.38)";
      ctx.lineWidth = Math.max(1, 0.16 * s);
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(bx, by, CIRCLE * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  for (let i = 0; i < sim.trail.length; i += 2) {
    const u = i / Math.max(2, sim.trail.length - 2);
    const tr = Math.max(1, 0.24 * s * (0.35 + u));
    const [tx, ty] = px(layout, sim.trail[i], sim.trail[i + 1]);
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${0.04 + u * 0.18})`;
    ctx.arc(tx, ty, tr, 0, Math.PI * 2);
    ctx.fill();
  }

  if (sim.carrier >= 0 && sim.mode !== "dead") {
    const c = sim.players[sim.carrier];
    if (c) {
      const [cx, cy] = px(layout, c.x, c.y - c.hop);
      const cr = tokenR(s, c.role === "gk");
      ctx.beginPath();
      ctx.strokeStyle = "rgba(190,255,180,0.9)";
      ctx.lineWidth = Math.max(1.4, cr * 0.14);
      if (c.role === "gk") {
        ctx.ellipse(cx, cy, cr * 1.22, cr * 1.55, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(cx, cy, cr * 1.38, 0, Math.PI * 2);
      }
      ctx.stroke();
    }
  }

  for (const p of sim.players) {
    const kit = p.home ? homeKit : awayKit;
    const who = p.home ? homeXi[p.slot] : awayXi[p.slot];
    const mine = squadIds.size > 0 && who != null && squadIds.has(who.id);
    const [x, y] = px(layout, p.x, p.y - p.hop);
    drawPerson(ctx, p, who, kit, s, x, y, mine);
  }

  const [bx, by] = px(layout, sim.ballX, sim.ballY);
  const lift = sim.ballZ * s * 0.35;
  const br = Math.max(r * 0.42, 3.6 + sim.ballZ * 0.32);
  ctx.beginPath();
  ctx.fillStyle = `rgba(0,0,0,${0.28 - Math.min(0.16, sim.ballZ * 0.03)})`;
  ctx.ellipse(bx + 0.7, by + 1.15, br * 0.95, br * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = "#f4e14c";
  ctx.arc(bx, by - lift, br, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2a2410";
  ctx.lineWidth = Math.max(1, br * 0.18);
  ctx.stroke();
  ctx.beginPath();
  ctx.strokeStyle = "rgba(40,32,8,0.5)";
  ctx.lineWidth = Math.max(0.7, br * 0.1);
  ctx.arc(bx, by - lift, br * 0.42, 0.2, Math.PI + 0.4);
  ctx.stroke();
}

export function LivePitch({ match }: { match: MatchView }) {
  const { squadPlayerIds } = useAppState();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const addedRef = useRef<HTMLSpanElement>(null);
  const homeScoreRef = useRef<HTMLSpanElement>(null);
  const awayScoreRef = useRef<HTMLSpanElement>(null);
  const stingRef = useRef<HTMLDivElement>(null);
  const stingTitleRef = useRef<HTMLSpanElement>(null);
  const stingSubRef = useRef<HTMLSpanElement>(null);
  const simRef = useRef<SimState | null>(null);
  const groundRef = useRef<HTMLCanvasElement | null>(null);
  const squadRef = useRef<Set<number>>(new Set());
  squadRef.current = new Set(squadPlayerIds);
  const matchRef = useRef(match);
  matchRef.current = match;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d", {
      alpha: false,
      desynchronized: true,
    });
    if (!ctx) return;

    const clock0 = liveMatchClock(match);
    simRef.current = createSim(
      match.id,
      match.home.score ?? 0,
      match.away.score ?? 0,
      { playSec: clock0.playSec, phase: clock0.phase },
    );

    let inView = true;
    let reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cssW = 0;
    let cssH = 0;
    let pixelW = 0;
    let pixelH = 0;

    const resize = () => {
      const nextW = Math.max(1, wrap.clientWidth);
      const nextH = Math.max(1, wrap.clientHeight);
      const n = Math.max(1, document.querySelectorAll("[data-live-pitch]").length);
      const cap = n <= 2 ? 3 : 2;
      const dpr = Math.min(window.devicePixelRatio || 1, cap);
      cssW = nextW;
      cssH = nextH;
      pixelW = Math.round(nextW * dpr);
      pixelH = Math.round(nextH * dpr);
      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW;
        canvas.height = pixelH;
        const ground = document.createElement("canvas");
        ground.width = pixelW;
        ground.height = pixelH;
        const gctx = ground.getContext("2d", { alpha: false });
        if (gctx) drawGround(gctx, pixelW, pixelH);
        groundRef.current = ground;
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry?.isIntersecting ?? true;
      },
      { threshold: 0.05 },
    );
    io.observe(wrap);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      reduced = mq.matches;
    };
    mq.addEventListener("change", onMotion);

    let lastSting = "";

    const tick = (_now: number, dt: number) => {
      if (document.visibilityState === "hidden") return;
      const current = matchRef.current;
      const clock = liveMatchClock(current, Date.now());
      const shown = bugClock(clock.playSec, clock.phase);
      if (clockRef.current && clockRef.current.textContent !== shown.time) {
        clockRef.current.textContent = shown.time;
      }
      if (addedRef.current) {
        const on = shown.added != null;
        addedRef.current.dataset.on = on ? "1" : "0";
        if (on) addedRef.current.textContent = `+${shown.added}`;
      }
      const targetHome = current.home.score ?? 0;
      const targetAway = current.away.score ?? 0;
      const sim = simRef.current;
      const ground = groundRef.current;
      if (!sim || !ground) return;
      stepSim(sim, {
        dt,
        phase: clock.phase,
        homeScore: targetHome,
        awayScore: targetAway,
        homeRating: current.home.rating,
        awayRating: current.away.rating,
        homeShort: current.home.short,
        awayShort: current.away.short,
        reduced,
        playSec: clock.playSec,
      });
      const homeScore = targetHome;
      const awayScore = targetAway;
      if (homeScoreRef.current) {
        homeScoreRef.current.textContent = String(homeScore);
      }
      if (awayScoreRef.current) {
        awayScoreRef.current.textContent = String(awayScore);
      }
      const showSting = sim.sting && sim.captionT > 0.04 && sim.caption;
      if (stingRef.current) {
        const el = stingRef.current;
        if (showSting) {
          const stamp = `${sim.captionKind}:${sim.caption}:${sim.captionSub}`;
          if (stamp !== lastSting) {
            lastSting = stamp;
            el.dataset.on = "0";
            void el.offsetWidth;
            if (stingTitleRef.current) stingTitleRef.current.textContent = sim.caption;
            if (stingSubRef.current) stingSubRef.current.textContent = sim.captionSub;
          }
          el.dataset.kind = sim.captionKind;
          el.dataset.on = "1";
        } else {
          lastSting = "";
          el.dataset.on = "0";
        }
      }
      if (!reduced && !inView) return;
      paint(
        ctx,
        ground,
        sim,
        pixelW,
        pixelH,
        kitFor(current.home.code),
        kitFor(current.away.code),
        current.xi.home,
        current.xi.away,
        squadRef.current,
      );
    };

    const stop = subscribeTick(tick);
    tick(performance.now(), 0);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      mq.removeEventListener("change", onMotion);
    };
  }, [match.id]);

  const homeKit = kitFor(match.home.code);
  const awayKit = kitFor(match.away.code);

  return (
    <div className="live-stage">
      <div className="pl-hud">
        <div className="pl-bug">
          <div className="pl-bug-teams">
            <div className="pl-bug-row">
              <span className="pl-bug-kit" style={{ background: homeKit.fill }} />
              <ClubCrest
                code={match.home.code}
                name={match.home.short}
                className="pl-bug-crest"
              />
              <span className="pl-bug-name">{bugName(match.home.short)}</span>
              <span ref={homeScoreRef} className="pl-bug-score">
                {match.home.score ?? 0}
              </span>
            </div>
            <div className="pl-bug-row">
              <span className="pl-bug-kit" style={{ background: awayKit.fill }} />
              <ClubCrest
                code={match.away.code}
                name={match.away.short}
                className="pl-bug-crest"
              />
              <span className="pl-bug-name">{bugName(match.away.short)}</span>
              <span ref={awayScoreRef} className="pl-bug-score">
                {match.away.score ?? 0}
              </span>
            </div>
          </div>
          <span ref={clockRef} className="pl-bug-clock">
            00:00
          </span>
          <span ref={addedRef} className="pl-bug-added" data-on="0">
            +4
          </span>
        </div>
        <div
          ref={stingRef}
          className="pl-sting"
          data-kind="play"
          data-on="0"
          aria-live="polite"
        >
          <span className="pl-sting-bar" />
          <span className="pl-sting-copy">
            <span ref={stingTitleRef} className="pl-sting-title" />
            <span ref={stingSubRef} className="pl-sting-sub" />
          </span>
        </div>
      </div>
      <div
        ref={wrapRef}
        data-live-pitch=""
        className="live-pitch relative overflow-hidden rounded-xl ring-1 ring-black/20"
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          aria-hidden
        />
      </div>
    </div>
  );
}
