"use client";

import { Icon } from "@/components/Icon";
import { applyTheme, readThemePref, THEME_PREFS, type ThemePref } from "@/lib/theme";
import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const LABEL: Record<ThemePref, string> = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
};

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>("system");

  useEffect(() => {
    setPref(readThemePref());
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readThemePref() === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function cycle() {
    const next = THEME_PREFS[(THEME_PREFS.indexOf(pref) + 1) % THEME_PREFS.length];
    setPref(next);
    applyTheme(next);
  }

  const glyph = pref === "light" ? Sun : pref === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={cycle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-panel text-foreground hover:bg-panel-2"
      aria-label={`${LABEL[pref]}. Switch theme`}
      title={LABEL[pref]}
    >
      <Icon icon={glyph} size="md" />
    </button>
  );
}
