"use client";

// A gentle reminder, shortly after sign-in, to turn on notifications on this device. Shown only when notifications
// can be turned on here and aren't yet; "Not now" waits three days before asking again.
import { useEffect, useState } from "react";
import { useBank } from "./BankProvider";
import { enablePush, isIos, isStandalone, pushStatus, pushSupported } from "./pwa";

const SNOOZE_KEY = "anchor-push-reminder";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
const DELAY_MS = 4000;

export function PushReminder() {
  const { toast } = useBank();
  const [mode, setMode] = useState<null | "ask" | "install">(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        if (Number(localStorage.getItem(SNOOZE_KEY) ?? 0) > Date.now()) return;
      } catch {}
      // iPhone only allows notifications once Anchor is on the Home Screen.
      if (isIos() && !isStandalone()) { if (!cancelled) setMode("install"); return; }
      if (!pushSupported() || Notification.permission === "denied") return;
      const state = await pushStatus("/api/push").catch(() => "unavailable" as const);
      if (!cancelled && state === "off") setMode("ask");
    }, DELAY_MS);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  function later() {
    try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS)); } catch {}
    setMode(null);
  }

  async function turnOn() {
    setBusy(true); setError("");
    try {
      const state = await enablePush("/api/push");
      if (state === "on") { toast("Notifications turned on"); setMode(null); }
      else if (state === "blocked") { setError("Notifications are blocked for this site. Allow them in your browser's site settings."); }
      else later();
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  if (!mode) return null;
  return (
    <div className="reminder" role="dialog" aria-modal="false" aria-labelledby="rem-title">
      <span className="reminder-ico" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
      </span>
      <div className="reminder-body">
        <b id="rem-title">Turn on notifications</b>
        {mode === "ask" ? (
          <p>Know the moment a deposit or withdrawal is approved, and hear about every new sign-in to your account.</p>
        ) : (
          <p>To get notifications on iPhone, add Anchor to your Home Screen: tap <b>Share</b>, then <b>Add to Home Screen</b>, and open it from there.</p>
        )}
        {error && <p className="hint bad" role="alert">{error}</p>}
        <div className="reminder-actions">
          {mode === "ask" && <button type="button" className="btn small" onClick={turnOn} disabled={busy}>{busy ? "Turning on…" : "Turn on"}</button>}
          <button type="button" className="btn ghost small" onClick={later} disabled={busy}>{mode === "ask" ? "Not now" : "Got it"}</button>
        </div>
      </div>
    </div>
  );
}
