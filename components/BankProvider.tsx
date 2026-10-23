"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { BankState } from "@/lib/types";
import { Splash } from "./Splash";
import { pageOf } from "@/lib/pages";
import { disablePush } from "./pwa";
import { currencyChoice, visitorLocale } from "./visitorLocale";
import { setDisplayCurrency } from "@/lib/format";

const SAVE_DELAY_MS = 500;
const MIN_SPLASH_MS = 900;

/** The parts of the state a customer may change directly. Everything else comes from the server's ledger. */
const SETTINGS_KEYS = ["customer", "profile", "external", "contacts", "p2p", "billers", "cards", "travel", "goals", "alerts", "budgets"] as const;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
}

interface BankContext {
  state: BankState;
  user: SessionUser;
  /** Changes settings with one of the pure actions from lib/logic.ts. Saved to the server shortly after. */
  update: (fn: (s: BankState) => BankState) => void;
  /** Moves money through a server endpoint and shows the result. Throws an Error with a readable message if refused. */
  act: (path: string, body?: Record<string, unknown>, method?: "POST" | "DELETE") => Promise<void>;
  toast: (msg: string) => void;
  signOut: () => Promise<void>;
  /** Loads balances and transactions again, e.g. after staff approve a deposit. */
  reload: () => Promise<void>;
  /** False for a page staff have switched off for this customer, so links to it can be hidden. */
  can: (href: string) => boolean;
}

const Ctx = createContext<BankContext | null>(null);

export function useBank() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBank must be used inside <BankProvider>");
  return ctx;
}

/** Loads this person's accounts and settings; the server opens their accounts on the first visit. */
async function load(): Promise<BankState | null> {
  const res = await fetch("/api/bank", { cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("load failed");
  return ((await res.json()) as { state: BankState }).state;
}

function saveSettings(state: BankState) {
  const settings = Object.fromEntries(SETTINGS_KEYS.map((k) => [k, state[k]]));
  return fetch("/api/bank", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings }), keepalive: true });
}

export function BankProvider({ user, blocked: initialBlocked, children }: { user: SessionUser; blocked: string[]; children: React.ReactNode }) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [state, setState] = useState<BankState | null>(null);
  const [ready, setReady] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastOn, setToastOn] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [loadError, setLoadError] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The last state the server sent. It doesn't need saving back.
  const fromServer = useRef<BankState | null>(null);
  const latest = useRef<BankState | null>(null);
  latest.current = state;

  // Each person's data lives on the server. The splash shows at least briefly.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => setReady(true), MIN_SPLASH_MS);
    // Amounts are shown in the visitor's local currency (or US dollars if they chose that in Profile).
    Promise.all([load(), visitorLocale().catch(() => null)])
      .then(([s, loc]) => {
        if (cancelled) return;
        if (loc && currencyChoice() !== "USD") setDisplayCurrency(loc.currency, loc.rate, navigator.language);
        else setDisplayCurrency("USD", 1);
        if (!s) { window.location.href = "/login"; return; }
        fromServer.current = s;
        setState(s);
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => { cancelled = true; clearTimeout(t); };
  }, [user]);

  // Save settings changes shortly after they happen.
  useEffect(() => {
    if (!state || state === fromServer.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = undefined;
      saveSettings(state).then((res) => { if (res.status === 401) window.location.href = "/login"; }).catch(() => {});
    }, SAVE_DELAY_MS);
  }, [state]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastOn(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastOn(false), 2600);
  }, []);

  const update = useCallback((fn: (s: BankState) => BankState) => setState((s) => (s ? fn(s) : s)), []);

  const act = useCallback(async (path: string, body?: Record<string, unknown>, method: "POST" | "DELETE" = "POST") => {
    // Settings waiting to be saved go first, so the server checks against the payees and goals on screen.
    if (saveTimer.current && latest.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = undefined;
      await saveSettings(latest.current);
    }
    let res: Response;
    try {
      res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    } catch {
      throw new Error("Couldn’t reach Anchor Bank. Check your connection and try again.");
    }
    if (res.status === 401) { window.location.href = "/login"; throw new Error("Sign in to continue."); }
    const data = (await res.json().catch(() => ({}))) as { state?: BankState; error?: string };
    if (!res.ok || !data.state) throw new Error(data.error ?? "That didn’t go through. Try again.");
    fromServer.current = data.state;
    setState(data.state);
  }, []);

  // Staff can switch pages off at any time; pick that up when the tab comes back into view and every minute.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/auth/me", { cache: "no-store" })
        .then((r) => {
          if (r.status === 401) { window.location.href = "/login"; return null; }
          return r.ok ? (r.json() as Promise<{ blocked?: string[] }>) : null;
        })
        .then((d) => { if (d?.blocked) setBlocked((b) => (b.join() === d.blocked!.join() ? b : d.blocked!)); })
        .catch(() => {});
    };
    const t = setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  const reload = useCallback(async () => {
    try {
      const s = await load();
      if (!s) { window.location.href = "/login"; return; }
      fromServer.current = s;
      setState(s);
    } catch {}
  }, []);

  const can = useCallback((href: string) => {
    const p = pageOf(href.split("?")[0]);
    return !p || !blocked.includes(p);
  }, [blocked]);

  const signOut = useCallback(async () => {
    try { await Promise.race([disablePush("/api/push"), new Promise((r) => setTimeout(r, 1500))]); } catch {}
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    window.location.href = "/login";
  }, []);

  if (loadError) return <Splash label="Couldn’t reach Anchor Bank. Refresh to try again." />;
  if (!state || !ready) return <Splash />;

  return (
    <>
      <Ctx.Provider value={{ state, user, update, act, toast, signOut, can, reload }}>{children}</Ctx.Provider>
      <div className={`toast${toastOn ? " show" : ""}`} role="status" aria-live="polite">
        {toastMsg}
      </div>
    </>
  );
}
