"use client";

import { useBank } from "@/components/BankProvider";
import { PageHead, Switch } from "@/components/ui";
import { fmt, shortDate } from "@/lib/format";
import { alertFeed } from "@/lib/logic";
import type { AlertPrefs } from "@/lib/types";

export default function AlertsPage() {
  const { state, update, toast } = useBank();
  const p = state.alerts;
  const feed = alertFeed(state);
  const setPrefs = (fn: (a: AlertPrefs) => AlertPrefs, msg = "Alert settings saved") => {
    update((s) => ({ ...s, alerts: fn(s.alerts) }));
    toast(msg);
  };

  const simple: [keyof Pick<AlertPrefs, "deposit" | "billDue" | "p2p">, string, string][] = [
    ["deposit", "Deposits", "When a direct deposit or check deposit reaches checking."],
    ["billDue", "Payments due", "Five days before a scheduled bill, and a week before your card payment is due."],
    ["p2p", "Send money", "When you send or receive money with an email or mobile number."],
  ];

  return (
    <>
      <PageHead title="Alerts" sub="Choose what we tell you about and how. Alerts help you spot mistakes and fraud early." />
      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2>Recent alerts</h2><span className="label">Last 14 days</span></div>
          {feed.length === 0 ? <p className="empty">Nothing to report. Turn on more alerts to hear about more activity.</p> : (
            <ul className="alert-list">
              {feed.slice(0, 14).map((a) => (
                <li key={a.id} className={a.tone}>
                  <b>{a.title}</b>
                  <span>{a.body}</span>
                  <span className="muted small">{shortDate(a.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="card-col">
          <section className="panel">
            <h2 style={{ marginBottom: 4 }}>Account alerts</h2>
            <div className="setting">
              <div>
                <b>Low balance</b>
                <p>When available checking money drops below</p>
                <div className="inline-amt"><span>$</span><input className="input" type="number" min={0} step={50} aria-label="Low balance threshold" value={p.lowBalance.threshold} onChange={(e) => setPrefs((a) => ({ ...a, lowBalance: { ...a.lowBalance, threshold: Number(e.target.value) || 0 } }), "Threshold updated")} /></div>
              </div>
              <Switch id="al-low" label="Low balance alerts" checked={p.lowBalance.on} onChange={(v) => setPrefs((a) => ({ ...a, lowBalance: { ...a.lowBalance, on: v } }))} />
            </div>
            <div className="setting">
              <div>
                <b>Large purchases</b>
                <p>Card purchases of at least</p>
                <div className="inline-amt"><span>$</span><input className="input" type="number" min={0} step={25} aria-label="Large purchase threshold" value={p.largePurchase.threshold} onChange={(e) => setPrefs((a) => ({ ...a, largePurchase: { ...a.largePurchase, threshold: Number(e.target.value) || 0 } }), "Threshold updated")} /></div>
              </div>
              <Switch id="al-large" label="Large purchase alerts" checked={p.largePurchase.on} onChange={(v) => setPrefs((a) => ({ ...a, largePurchase: { ...a.largePurchase, on: v } }))} />
            </div>
            {simple.map(([k, t, d]) => (
              <label className="setting" key={k}>
                <div><b>{t}</b><p>{d}</p></div>
                <Switch id={`al-${k}`} label={t} checked={p[k].on} onChange={(v) => setPrefs((a) => ({ ...a, [k]: { on: v } }))} />
              </label>
            ))}
          </section>

          <section className="panel">
            <h2 style={{ marginBottom: 4 }}>Where to send alerts</h2>
            {([["email", "Email", state.customer.email], ["text", "Text message", state.customer.phone], ["push", "App notifications", "Anchor mobile app"]] as const).map(([k, t, d]) => (
              <label className="setting" key={k}>
                <div><b>{t}</b><p>{d}</p></div>
                <Switch id={`ch-${k}`} label={t} checked={p.channels[k]} onChange={(v) => setPrefs((a) => ({ ...a, channels: { ...a.channels, [k]: v } }))} />
              </label>
            ))}
            {!p.channels.email && !p.channels.text && !p.channels.push && <p className="hint bad">Turn on at least one way to reach you, or you won't get any alerts.</p>}
            <p className="hint" style={{ marginTop: 10 }}>Security alerts, like a new device signing in, are always sent by email and text. Low balance is checked against {fmt(p.lowBalance.threshold)}.</p>
          </section>
        </div>
      </div>
    </>
  );
}
