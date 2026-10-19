"use client";

// Staff: deposit addresses customers see, and deposits and withdrawals waiting for approval.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PushToggle } from "../PushToggle";
import { when } from "./shared";
import { addressProblem, ASSETS, type Asset, type DepositAddress } from "@/lib/funding";
import type { QueueItem } from "@/lib/server/funding";
import { fmt } from "@/lib/format";

type Data = { addresses: DepositAddress[]; pending: QueueItem[]; recent: QueueItem[] };

async function send(url: string, method: "PUT" | "PATCH", body: object) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function AddressRow({ asset, network, current, base, onSaved }: { asset: Asset; network: string; current?: DepositAddress; base: string; onSaved: (a: DepositAddress[]) => void }) {
  const [value, setValue] = useState(current?.address ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ bad: boolean; text: string } | null>(null);
  useEffect(() => setValue(current?.address ?? ""), [current?.address]);
  const dirty = value.trim() !== (current?.address ?? "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const problem = value.trim() ? addressProblem(asset, value) : "";
    if (problem) { setMsg({ bad: true, text: problem }); return; }
    setBusy(true); setMsg(null);
    try {
      const d = await send(`${base}/api/funding`, "PUT", { asset, address: value.trim() });
      onSaved(d.addresses);
      setMsg({ bad: false, text: value.trim() ? "Saved. Customers see it now." : `${asset} deposits turned off.` });
    } catch (err) {
      setMsg({ bad: true, text: (err as Error).message });
    } finally { setBusy(false); }
  }

  return (
    <form className="adm-addr" onSubmit={save} noValidate>
      <div className="adm-addr-head">
        <b>{asset}</b><span className="muted small">{network}</span>
        <span className={`pill ${current ? "good" : ""}`}>{current ? "Live" : "Off"}</span>
      </div>
      <div className="adm-addr-row">
        <input className="input mono" value={value} onChange={(e) => setValue(e.target.value)} placeholder={asset === "BTC" ? "bc1… (leave empty to turn off)" : "0x… (leave empty to turn off)"} aria-label={`${asset} deposit address`} spellCheck={false} autoComplete="off" />
        <button className="btn small" type="submit" disabled={busy || !dirty}>{busy ? "Saving…" : "Save"}</button>
      </div>
      {current && <span className="muted small">Updated {when(current.updatedAt)}</span>}
      {msg && <span className={`hint ${msg.bad ? "bad" : ""}`} role="status">{msg.text}</span>}
    </form>
  );
}

function Item({ r, base, onDone, readOnly }: { r: QueueItem; base: string; onDone: (d: Data) => void; readOnly?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  async function decide(decision: "approve" | "decline") {
    if (decision === "decline" && !confirm(`Decline this ${fmt(r.amount)} ${r.type}?`)) return;
    setBusy(true); setErr("");
    try {
      const d = await send(`${base}/api/funding/${r.type}/${r.id}`, "PATCH", { decision, reference: ref });
      onDone(d);
    } catch (e) {
      setErr((e as Error).message); setBusy(false);
    }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(r.address); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }

  return (
    <li className="adm-req">
      <div className="adm-req-main">
        <div>
          <span className={`pill ${r.type === "deposit" ? "good" : "pending"}`}>{r.type === "deposit" ? "Deposit" : "Withdrawal"}</span>
          <b className="num">{fmt(r.amount)}</b> <span className="muted">in {r.asset} · {r.account === "sav" ? "Savings" : "Checking"}</span>
        </div>
        <Link href={`${base}/users/${r.userId}`} className="muted small">{r.customer} · {r.email}</Link>
        <span className="muted small">{r.type === "deposit" ? "Sent to" : "Send to"} <code className="adm-code">{r.address}</code>
          {r.type === "withdrawal" && <button type="button" className="link-btn" onClick={copy}>{copied ? "Copied" : "Copy"}</button>}
        </span>
        {r.type === "deposit" && <span className="muted small">Transaction ID: {r.reference ? <code className="adm-code">{r.reference}</code> : "not given"}</span>}
        {r.type === "withdrawal" && r.reference && <span className="muted small">Sent as <code className="adm-code">{r.reference}</code></span>}
        <span className="muted small">Asked {when(r.createdAt)}{r.reviewedAt ? ` · ${r.status === "approved" ? "Approved" : "Declined"} ${when(r.reviewedAt)}` : ""}</span>
      </div>
      {!readOnly && (
        <div className="adm-req-act">
          {r.type === "withdrawal" && <input className="input mono" placeholder="Transaction ID once sent (optional)" value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Transaction ID" />}
          <div className="actions">
            <button type="button" className="btn small" disabled={busy} onClick={() => decide("approve")}>{r.type === "deposit" ? "Approve and credit" : "Approve: I've sent it"}</button>
            <button type="button" className="btn ghost small" disabled={busy} onClick={() => decide("decline")}>Decline</button>
          </div>
          {err && <span className="hint bad" role="alert">{err}</span>}
        </div>
      )}
      {readOnly && <span className={`pill ${r.status === "approved" ? "good" : "bad"}`}>{r.status === "approved" ? "Approved" : "Declined"}</span>}
    </li>
  );
}

export function AdminFunding({ base, initial }: { base: string; initial: Data }) {
  const [data, setData] = useState(initial);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${base}/api/funding`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {}
  }, [base]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  const onDone = (d: Omit<Data, "addresses">) => setData((x) => ({ ...x, ...d }));

  return (
    <div className="adm-wrap">
      <div className="adm-head">
        <div><h1>Deposits &amp; withdrawals</h1><p className="muted">Nothing reaches or leaves a customer&apos;s balance until you approve it.</p></div>
      </div>

      <section className="panel glass">
        <PushToggle base={`${base}/api/push`} label="Notify me on this device" on="You'll get a notification for every new deposit and withdrawal" off="Get a notification for every new deposit and withdrawal" />
      </section>

      <section className="panel glass">
        <div className="sec-head"><h2>Deposit addresses</h2><span className="muted small">Customers see changes within seconds</span></div>
        <div className="adm-addrs">
          {ASSETS.map((a) => (
            <AddressRow key={a.asset} asset={a.asset} network={a.network} current={data.addresses.find((x) => x.asset === a.asset)} base={base} onSaved={(addresses) => setData((x) => ({ ...x, addresses }))} />
          ))}
        </div>
      </section>

      <section className="panel glass">
        <div className="sec-head"><h2>Waiting for approval</h2><span className="pill pending">{data.pending.length}</span></div>
        {data.pending.length === 0 ? <p className="empty">Nothing waiting.</p> : (
          <ul className="adm-reqs">{data.pending.map((r) => <Item key={r.id} r={r} base={base} onDone={onDone} />)}</ul>
        )}
      </section>

      <section className="panel glass">
        <div className="sec-head"><h2>Recently reviewed</h2></div>
        {data.recent.length === 0 ? <p className="empty">Nothing reviewed yet.</p> : (
          <ul className="adm-reqs">{data.recent.map((r) => <Item key={r.id} r={r} base={base} onDone={onDone} readOnly />)}</ul>
        )}
      </section>
    </div>
  );
}
