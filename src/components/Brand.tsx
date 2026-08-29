import { useId } from "react";

export function BrandMark({ className }: { className?: string }) {
  const gid = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={gid} x1="16" y1="0" x2="16" y2="32">
          <stop offset="0%" stopColor="#24924f" />
          <stop offset="100%" stopColor="#145530" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${gid})`} />
      <rect
        x="5"
        y="5"
        width="22"
        height="22"
        rx="1.6"
        fill="none"
        stroke="white"
        strokeOpacity="0.5"
        strokeWidth="1.15"
      />
      <line
        x1="5"
        y1="16"
        x2="27"
        y2="16"
        stroke="white"
        strokeOpacity="0.42"
        strokeWidth="1"
      />
      <rect
        x="12.2"
        y="5"
        width="7.6"
        height="2.6"
        fill="none"
        stroke="white"
        strokeOpacity="0.42"
        strokeWidth="0.9"
      />
      <rect
        x="12.2"
        y="24.4"
        width="7.6"
        height="2.6"
        fill="none"
        stroke="white"
        strokeOpacity="0.42"
        strokeWidth="0.9"
      />
      <circle
        cx="16"
        cy="16"
        r="4.35"
        fill="none"
        stroke="white"
        strokeOpacity="0.5"
        strokeWidth="1.1"
      />
      <circle cx="16" cy="16" r="1.2" fill="white" />
    </svg>
  );
}

export function BrandLockup() {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark className="h-8 w-8 shrink-0" />
      <span className="flex items-baseline gap-2">
        <span className="text-base font-semibold tracking-tight sm:text-lg">
          Pitch
        </span>
        <span className="hidden text-[11px] font-medium uppercase tracking-[0.2em] text-muted sm:inline">
          FPL
        </span>
      </span>
    </span>
  );
}
