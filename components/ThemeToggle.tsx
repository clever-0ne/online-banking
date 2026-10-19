"use client";

import { useEffect, useState } from "react";
import { ICONS } from "./nav";

export const THEME_KEY = "anchor-theme";
const THEME_EVENT = "anchor-theme-change";

export type ThemeChoice = "system" | "light" | "dark";

/**
 * Runs before first paint (inlined in <head>) so the theme never flashes.
 * Dark is the default; "light" or "system" are only used when the person chose them.
 */
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_KEY}"),r=document.documentElement;if(t==="system")r.removeAttribute("data-theme");else r.dataset.theme=t==="light"?"light":"dark"}catch(e){}`;

function effectiveTheme(): "light" | "dark" {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getThemeChoice(): ThemeChoice {
  const set = document.documentElement.dataset.theme;
  return set === "light" || set === "dark" ? set : "system";
}

/** Applies a theme choice, remembers it, and tells every toggle on the page. */
export function setThemeChoice(choice: ThemeChoice) {
  if (choice === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {}
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Current effective theme, kept in sync with the OS setting and other toggles. */
export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => {
    const sync = () => { setTheme(effectiveTheme()); setChoice(getThemeChoice()); };
    sync();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync);
    window.addEventListener(THEME_EVENT, sync);
    return () => { mq.removeEventListener("change", sync); window.removeEventListener(THEME_EVENT, sync); };
  }, []);
  return { theme, choice };
}

export function ThemeToggle() {
  const { theme } = useTheme();
  const toggle = () => setThemeChoice(effectiveTheme() === "dark" ? "light" : "dark");
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button type="button" className="icon-btn" onClick={toggle} aria-label={label} title={label}>
      {theme === "dark" ? ICONS.sun : ICONS.moon}
    </button>
  );
}
