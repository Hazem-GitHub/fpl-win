"use client";

import { IconLabel } from "@/components/Icon";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function Jump({
  href,
  icon,
  children,
  onClick,
  tone = "muted",
}: {
  href: string;
  icon: LucideIcon;
  children: ReactNode;
  onClick?: () => void;
  tone?: "muted" | "accent";
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`inline-flex max-w-full min-w-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        tone === "accent"
          ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15"
          : "border-line text-muted hover:border-accent/30 hover:text-foreground"
      }`}
    >
      <IconLabel icon={icon} size="xs">
        {children}
      </IconLabel>
    </Link>
  );
}
