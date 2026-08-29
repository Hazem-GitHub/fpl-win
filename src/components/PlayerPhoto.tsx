"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { playerPhoto, shirtPhoto } from "@/lib/format";
import type { RankedPlayer } from "@/lib/xp/model";

function subscribe() {
  return () => {};
}

export function PlayerPhoto({
  player,
  className,
}: {
  player: RankedPlayer;
  className?: string;
}) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  const face = playerPhoto(player.code);
  const shirt = shirtPhoto(player.teamCode, player.position === 1);
  const [stage, setStage] = useState<"face" | "shirt" | "none">("face");
  const classes =
    className ??
    "h-14 w-11 rounded-sm bg-panel object-cover sm:h-16 sm:w-12";

  useEffect(() => {
    setStage("face");
  }, [player.code]);

  const src = stage === "face" ? face : stage === "shirt" ? shirt : null;

  if (!isClient || !src) {
    return (
      <div
        className={`${classes} flex items-center justify-center text-[10px] font-semibold text-muted`}
        aria-hidden
      >
        {src ? "" : player.webName.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    // Native img: missing PL headshots 403, and next/image would
    // proxy that as a broken /_next/image request.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={110}
      height={140}
      className={classes}
      referrerPolicy="no-referrer"
      onError={() => {
        setStage((current) => (current === "face" ? "shirt" : "none"));
      }}
    />
  );
}
