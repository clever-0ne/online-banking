"use client";

// Staff: deposit addresses customers see, and deposits and withdrawals waiting for approval.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PushToggle } from "../PushToggle";
import { DepositAddresses } from "./DepositAddresses";
import { when } from "./shared";
import type { DepositAddress } from "@/lib/funding";
import type { QueueItem } from "@/lib/server/funding";
import { fmt } from "@/lib/format";

type Data = { addresses: DepositAddress[]; pending: QueueItem[]; recent: QueueItem[] };

async function send(url: string, method: "PUT" | "PATCH", body: object) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
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

      <DepositAddresses base={base} initial={data.addresses} onChange={(addresses) => setData((x) => ({ ...x, addresses }))} />

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
