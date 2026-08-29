"use client";

import { useState, useSyncExternalStore } from "react";
import { clubBadgeUrls } from "@/lib/format";

function subscribe() {
  return () => {};
}

export function ClubCrest({
  code,
  name,
  className,
}: {
  code: number;
  name: string;
  className?: string;
}) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  const urls = clubBadgeUrls(code);
  const [index, setIndex] = useState(0);
  const classes =
    className ?? "h-8 w-8 object-contain";
  const src = isClient && index < urls.length ? urls[index] : null;
  const initials = name.slice(0, 2).toUpperCase();

  if (!src) {
    return (
      <span
        className={`${classes} flex items-center justify-center rounded-full bg-panel-2 text-[9px] font-bold text-muted`}
        aria-hidden
      >
        {initials}
      </span>
    );
  }

  return (
    // Native img: PL CDNs 403 some badge sizes; next/image would cache that as broken.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={40}
      height={40}
      className={classes}
      referrerPolicy="no-referrer"
      onError={() => setIndex((current) => current + 1)}
    />
  );
}
