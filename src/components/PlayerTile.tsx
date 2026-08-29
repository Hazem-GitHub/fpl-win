"use client";

import { posLong } from "@/lib/abbr";
import { ClubCrest } from "@/components/ClubCrest";
import { PlayerPhoto } from "@/components/PlayerPhoto";
import type { RankedPlayer } from "@/lib/xp/model";

export const POS_TONE: Record<number, string> = {
  1: "bg-violet-500 text-white",
  2: "bg-sky-500 text-white",
  3: "bg-amber-400 text-zinc-900",
  4: "bg-rose-500 text-white",
};

const SIZE = {
  xs: { wrap: "h-8 w-6", photo: "h-8 w-6 rounded object-cover bg-panel-2" },
  sm: { wrap: "h-10 w-8", photo: "h-10 w-8 rounded-md object-cover bg-panel-2" },
  md: { wrap: "h-14 w-11", photo: "h-14 w-11 rounded-md object-cover bg-panel-2" },
  lg: { wrap: "h-[4.5rem] w-14", photo: "h-[4.5rem] w-14 rounded-lg object-cover bg-panel-2" },
  xl: {
    wrap: "h-[3.75rem] w-[2.85rem]",
    photo: "h-[3.75rem] w-[2.85rem] rounded-lg object-cover bg-panel-2",
  },
} as const;

export function PlayerTile({
  player,
  size = "md",
  badge,
}: {
  player: RankedPlayer;
  size?: keyof typeof SIZE;
  badge?: string;
}) {
  const box = SIZE[size];
  const crest =
    size === "xs" ? "h-3.5 w-3.5" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span className={`relative inline-block shrink-0 ${box.wrap}`}>
      <PlayerPhoto player={player} className={box.photo} />
      <ClubCrest
        code={player.teamCode}
        name={player.teamShort}
        className={`absolute -bottom-0.5 -right-0.5 ${crest} rounded-full bg-background object-contain p-px shadow-sm ring-1 ring-line`}
      />
      {badge ? (
        <span
          title={badge === "V" ? "vice-captain" : badge === "C" ? "captain" : undefined}
          className={`absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
            badge === "V" ? "bg-foreground text-background" : "bg-warn text-background"
          }`}
        >
          {badge}
        </span>
      ) : null}
    </span>
  );
}

export function PosChip({ player }: { player: RankedPlayer }) {
  const label = player.positionShort === "GKP" ? "GK" : player.positionShort;
  return (
    <span
      title={posLong(label)}
      className={`rounded px-1 py-px text-[9px] font-bold uppercase leading-none ${POS_TONE[player.position]}`}
    >
      {label}
    </span>
  );
}
