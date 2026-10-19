"use client";

// "Notifications on this device", for customers (/api/push) and staff (their own endpoint).
import { useEffect, useState } from "react";
import { disablePush, enablePush, pushStatus, type PushState } from "./pwa";
import { Switch } from "./ui";

const HELP: Record<PushState, string> = {
  loading: "Checking this device…",
  unsupported: "This browser can't show notifications. Try Chrome, Edge, Firefox or Safari.",
  "needs-install": "On iPhone, first add Anchor Bank to your Home Screen (Share → Add to Home Screen), then open it from there.",
  unavailable: "Notifications aren't available right now.",
  blocked: "Notifications are blocked for this site. Allow them in your browser's site settings, then come back.",
  off: "",
  on: "",
};

export function PushToggle({ base, label, on, off, onToast }: { base: string; label: string; on: string; off: string; onToast?: (m: string) => void }) {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { pushStatus(base).then(setState).catch(() => setState("unavailable")); }, [base]);

  async function toggle(v: boolean) {
    setBusy(true); setError("");
    try {
      const next = v ? await enablePush(base) : await disablePush(base);
      setState(next);
      if (next === "on") onToast?.("Notifications turned on");
      else if (!v) onToast?.("Notifications turned off");
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  const ready = state === "on" || state === "off";
  return (
    <>
      <label className="tk-row">
        <span className="row-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /><path d="M19 3l2 2" /></svg>
        </span>
        <div className="tk-row-main"><b>{label}</b><span>{state === "on" ? on : ready ? off : HELP[state]}</span></div>
        <Switch id={`push-${base.replace(/\W/g, "")}`} label={label} checked={state === "on"} disabled={!ready || busy} onChange={toggle} />
      </label>
      {error && <p className="hint bad tk-sub" role="alert">{error}</p>}
    </>
  );
}
