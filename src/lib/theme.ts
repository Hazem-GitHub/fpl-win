export const THEME_KEY = "fpl-win-theme";

export type ThemePref = "light" | "dark" | "system";

export const THEME_PREFS: ThemePref[] = ["system", "light", "dark"];

export const THEME_BOOTSTRAP = `(function(){
  try {
    var key = ${JSON.stringify(THEME_KEY)};
    var stored = localStorage.getItem(key);
    var pref = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    var dark = pref === "dark" || (pref !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.classList.toggle("light", !dark);
    root.style.colorScheme = dark ? "dark" : "light";
    root.dataset.theme = pref;
  } catch (e) {}
})();`;

export function applyTheme(pref: ThemePref) {
  const dark =
    pref === "dark" ||
    (pref !== "light" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
  root.style.colorScheme = dark ? "dark" : "light";
  root.dataset.theme = pref;
  window.localStorage.setItem(THEME_KEY, pref);
}

export function readThemePref(): ThemePref {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    /* private mode */
  }
  return "system";
}
