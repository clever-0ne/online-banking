"use client";

// Staff switch individual customer pages on or off. Changes apply on the customer's next request.
import { useState } from "react";
import { Switch } from "../ui";
import { when } from "./shared";
import type { PageAccess as Page } from "@/lib/server/permissions";

export function PageAccess({ userId, base, initial }: { userId: string; base: string; initial: Page[] }) {
  const [pages, setPages] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const off = pages.filter((p) => !p.enabled).length;

  async function set(changes: Record<string, boolean>, key: string) {
    setBusy(key); setErr(null);
    try {
      const res = await fetch(`${base}/api/users/${userId}/pages`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pages: changes }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save that change.");
      setPages(data.pages);
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(null); }
  }

  const groups = [...new Set(pages.map((p) => p.group))];
  return (
    <section className="panel glass">
      <div className="sec-head">
        <h2>Page access</h2>
        <span className="muted small">{off ? `${off} page${off > 1 ? "s" : ""} off` : "All pages on"}</span>
      </div>
      <p className="muted small">Switched-off pages disappear from the customer&apos;s menu, and opening them directly shows &ldquo;Access denied&rdquo;.</p>
      {err && <p className="notice warn" role="status">{err}</p>}
      {groups.map((g) => (
        <div key={g}>
          <span className="nav-title">{g}</span>
          <ul className="plain-list">
            {pages.filter((p) => p.group === g).map((p) => (
              <li key={p.slug}>
                <div>
                  <b>{p.label}</b>
                  <span className="muted small">{p.locked ? "Always on" : p.changedAt ? `${p.enabled ? "Turned on" : "Turned off"} by ${p.changedBy} · ${when(p.changedAt)}` : "On by default"}</span>
                </div>
                <Switch id={`pa-${p.slug}`} label={`${p.label} access`} checked={p.enabled} disabled={p.locked || busy !== null} onChange={(v) => set({ [p.slug]: v }, p.slug)} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="actions">
        <button type="button" className="btn ghost small" disabled={busy !== null || off === 0} onClick={() => set(Object.fromEntries(pages.filter((p) => !p.locked).map((p) => [p.slug, true])), "all")}>Turn all on</button>
      </div>
    </section>
  );
}
