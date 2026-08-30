"use client";

import { ClubCrest } from "@/components/ClubCrest";
import { liveMatchClock } from "@/lib/live-clock";
import {
  createSim,
  PITCH_L,
  PITCH_W,
  stepSim,
  type SimState,
} from "@/lib/live-sim";
import { abbr } from "@/lib/abbr";
import type { MatchView } from "@/lib/matches";
import { useEffect, useRef } from "react";

type TickFn = (now: number, dt: number) => void;

const ticks = new Set<TickFn>();
let raf = 0;
let lastNow = 0;
let leftover = 0;

function targetFrameSec(): number {
  const n = ticks.size;
  if (n > 8) return 1 / 30;
  if (n > 4) return 1 / 45;
  return 1 / 60;
}

function loop(now: number) {
  if (ticks.size === 0) {
    raf = 0;
    lastNow = 0;
    leftover = 0;
    return;
  }
  const raw = lastNow ? (now - lastNow) / 1000 : targetFrameSec();
  lastNow = now;
  leftover += Math.min(0.05, raw);
  const step = targetFrameSec();
  while (leftover >= step) {
    leftover -= step;
    for (const tick of ticks) tick(now, step);
  }
  raf = window.requestAnimationFrame(loop);
}

function subscribeTick(fn: TickFn): () => void {
  ticks.add(fn);
  if (!raf) {
    lastNow = 0;
    raf = window.requestAnimationFrame(loop);
  }
  return () => {
    ticks.delete(fn);
  };
}

function drawGround(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  const sx = w / PITCH_L;
  const sy = h / PITCH_W;
  const stripes = 10;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#1a8f4c" : "#148044";
    ctx.fillRect((i * w) / stripes, 0, w / stripes + 1, h);
  }
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, 0, w, h * 0.08);
  ctx.fillStyle = "rgba(0,12,6,0.22)";
  ctx.fillRect(0, h * 0.86, w, h * 0.14);

  const line = (stroke: string, width: number) => {
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.lineJoin = "miter";
    ctx.beginPath();
    ctx.rect(2, 2, w - 4, h - 4);
    ctx.moveTo(w / 2, 2);
    ctx.lineTo(w / 2, h - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 9.15 * sx, 0, Math.PI * 2);
    ctx.stroke();

    const boxW = 16.5 * sx;
    const boxH = 40.32 * sy;
    const sixW = 5.5 * sx;
    const sixH = 18.32 * sy;
    const boxY = (h - boxH) / 2;
    const sixY = (h - sixH) / 2;
    ctx.strokeRect(2, boxY, boxW, boxH);
    ctx.strokeRect(w - 2 - boxW, boxY, boxW, boxH);
    ctx.strokeRect(2, sixY, sixW, sixH);
    ctx.strokeRect(w - 2 - sixW, sixY, sixW, sixH);

    const goalW = 2.4 * sx;
    const goalH = 7.32 * sy;
    const goalY = (h - goalH) / 2;
    ctx.strokeRect(2 - goalW, goalY, goalW, goalH);
    ctx.strokeRect(w - 2, goalY, goalW, goalH);

    const spot = 11 * sx;
    ctx.beginPath();
    ctx.arc(2 + spot, h / 2, 1.15 * sx, 0, Math.PI * 2);
    ctx.fillStyle = stroke;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w - 2 - spot, h / 2, 1.15 * sx, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 1.35 * sx, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(2 + spot, h / 2, 9.15 * sx, -1.05, 1.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w - 2 - spot, h / 2, 9.15 * sx, Math.PI - 1.05, Math.PI + 1.05);
    ctx.stroke();
    ctx.restore();
  };

  line("rgba(255,255,255,0.28)", 4.2);
  line("rgba(255,255,255,0.86)", 1.35);
}

function paint(
  ctx: CanvasRenderingContext2D,
  ground: HTMLCanvasElement,
  sim: SimState,
  w: number,
  h: number,
): void {
  ctx.drawImage(ground, 0, 0);
  const sx = w / PITCH_L;
  const sy = h / PITCH_W;
  const r = Math.max(3.2, 1.15 * Math.min(sx, sy));

  if (sim.goalFlash > 1.05) {
    ctx.fillStyle = `rgba(255,255,255,${0.08 + 0.1 * Math.sin(sim.goalFlash * 18)})`;
    ctx.fillRect(0, 0, w, h);
  }

  for (const p of sim.players) {
    const x = p.x * sx;
    const y = p.y * sy;
    ctx.beginPath();
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.arc(x + 0.6, y + 0.9, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = p.home ? "#f7f7f7" : "#1c2430";
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.strokeStyle = p.home ? "rgba(20,24,28,0.55)" : "rgba(239,68,68,0.95)";
    ctx.stroke();
  }

  const bx = sim.ballX * sx;
  const by = sim.ballY * sy;
  const br = Math.max(2.6, 0.55 * Math.min(sx, sy));
  ctx.beginPath();
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.arc(bx + 0.7, by + 1.1, br, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = "#f4f4f4";
  ctx.arc(bx, by, br, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(20,20,20,0.55)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
}

export function LivePitch({
  match,
}: {
  match: MatchView;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const simRef = useRef<SimState | null>(null);
  const groundRef = useRef<HTMLCanvasElement | null>(null);
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

    if (!simRef.current) {
      simRef.current = createSim(
        match.id,
        match.home.score ?? 0,
        match.away.score ?? 0,
      );
    }

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

    const tick = (_now: number, dt: number) => {
      if (!reduced && (!inView || document.visibilityState === "hidden")) return;
      const current = matchRef.current;
      const clock = liveMatchClock(current, Date.now());
      if (clockRef.current && clockRef.current.textContent !== clock.label) {
        clockRef.current.textContent = clock.label;
      }
      const sim = simRef.current;
      const ground = groundRef.current;
      if (!sim || !ground) return;
      stepSim(sim, {
        dt,
        phase: clock.phase,
        homeScore: current.home.score ?? 0,
        awayScore: current.away.score ?? 0,
        homeRating: current.home.rating,
        awayRating: current.away.rating,
        reduced,
      });
      paint(ctx, ground, sim, pixelW, pixelH);
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

  const homeWin = (match.home.score ?? 0) > (match.away.score ?? 0);
  const awayWin = (match.away.score ?? 0) > (match.home.score ?? 0);

  return (
    <div
      ref={wrapRef}
      data-live-pitch=""
      className="live-pitch relative overflow-hidden rounded-lg"
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-2.5 pt-1.5 text-[10px] font-semibold uppercase tracking-widest text-white">
        <span
          ref={clockRef}
          className="flex items-center gap-1.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
        >
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" />
          Live
        </span>
        <span className="text-white/75 drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]">
          {match.eventName.replace("Gameweek", abbr("gw"))}
        </span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-linear-to-t from-black/55 to-transparent px-2.5 pb-2 pt-8">
        <div className="flex min-w-0 items-center gap-1.5">
          <ClubCrest
            code={match.home.code}
            name={match.home.short}
            className="h-6 w-6 object-contain sm:h-7 sm:w-7"
          />
          <span
            className={`truncate text-xs font-semibold text-white ${
              awayWin ? "opacity-55" : ""
            }`}
          >
            {match.home.short}
          </span>
        </div>
        <p className="tabular text-lg font-semibold leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
          <span className={homeWin ? "text-mint" : ""}>
            {match.home.score ?? 0}
          </span>
          <span className="mx-1 text-white/55">–</span>
          <span className={awayWin ? "text-mint" : ""}>
            {match.away.score ?? 0}
          </span>
        </p>
        <div className="flex min-w-0 items-center justify-end gap-1.5">
          <span
            className={`truncate text-xs font-semibold text-white ${
              homeWin ? "opacity-55" : ""
            }`}
          >
            {match.away.short}
          </span>
          <ClubCrest
            code={match.away.code}
            name={match.away.short}
            className="h-6 w-6 object-contain sm:h-7 sm:w-7"
          />
        </div>
      </div>
    </div>
  );
}
