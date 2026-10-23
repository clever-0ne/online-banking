"use client";

// The visitor's location-based language and currency, looked up once per browser session, plus the choices
// a customer can make by hand in Profile (kept on this device only).
import { CURRENCY_KEY, DEFAULT_LOCALE, LANG_KEY, type VisitorLocale } from "@/lib/locale";

const CACHE_KEY = "anchor-locale";
let pending: Promise<VisitorLocale> | null = null;

export function visitorLocale(): Promise<VisitorLocale> {
  if (pending) return pending;
  pending = (async () => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached) as VisitorLocale;
    } catch {}
    try {
      const res = await fetch("/api/locale", { cache: "no-store" });
      const loc = (await res.json()) as VisitorLocale;
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(loc)); } catch {}
      return loc;
    } catch {
      return DEFAULT_LOCALE;
    }
  })();
  return pending;
}

const read = (key: string, fallback: string) => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch {} };

/** "auto" (follow location) or a language code. */
export const languageChoice = () => read(LANG_KEY, "auto");
export const setLanguageChoice = (v: string) => write(LANG_KEY, v);
/** "auto" (local currency) or "USD". */
export const currencyChoice = () => read(CURRENCY_KEY, "auto");
export const setCurrencyChoice = (v: string) => write(CURRENCY_KEY, v);

/** The language to show: the customer's choice, or their location's. */
export async function targetLanguage(): Promise<string> {
  const choice = languageChoice();
  return choice !== "auto" ? choice : (await visitorLocale()).language;
}
