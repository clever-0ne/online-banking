"use client";

import { useState } from "react";
import { useBank } from "@/components/BankProvider";
import { PageHead, Tabs } from "@/components/ui";
import { fmt, mask, monthLabel, shortDate, signed } from "@/lib/format";
import { acct, statements, type Statement } from "@/lib/logic";
import type { AccountId } from "@/lib/types";

function downloadCsv(name: string, st: Statement) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = ["Date,Description,Memo,Category,Amount", ...st.tx.map((t) => [t.date, esc(t.payee), esc(t.memo), esc(t.cat), t.amount.toFixed(2)].join(","))];
  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `anchor-${name}-${st.month}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function StatementsPage() {
  const { state } = useBank();
  const [acctId, setAcctId] = useState<AccountId>("chk");
  const list = statements(state, acctId);
  const [open, setOpen] = useState<string | null>(null);
  const account = state.accounts.find((a) => a.id === acctId)!;
  const st = list.find((s) => s.month === open) ?? list[0];
  const credit = account.kind === "credit";

  return (
    <>
      <PageHead title="Statements & documents" sub="Monthly statements for each account. A statement appears after the month closes." />
      <Tabs<AccountId> label="Account" value={acctId} onChange={(v) => { setAcctId(v); setOpen(null); }} options={state.accounts.map((a) => [a.id, `${a.name} ${mask(a.last4)}`])} />

      {list.length === 0 || !st ? (
        <section className="panel"><p className="empty">No statements yet for this account.</p></section>
      ) : (
        <div className="split">
          <section className="panel flush">
            <div className="panel-head pad"><h2>Statements</h2></div>
            {list.map((s) => (
              <button key={s.month} type="button" className={`acct-row stmt${s.month === st.month ? " on" : ""}`} onClick={() => setOpen(s.month)}>
                <b>{monthLabel(s.month)}</b>
                <span className="num muted">{fmt(credit ? -s.closing : s.closing)}</span>
              </button>
            ))}
          </section>

          <section className="panel">
            <div className="panel-head">
              <div><h2>{monthLabel(st.month)}</h2><span className="hint">{account.name} {mask(account.last4)}</span></div>
              <button className="btn ghost small" type="button" onClick={() => downloadCsv(acctId, st)}>Download CSV</button>
            </div>
            <dl className="review">
              <div><dt>{credit ? "Previous balance owed" : "Beginning balance"}</dt><dd className="num">{fmt(credit ? -st.opening : st.opening)}</dd></div>
              <div><dt>{credit ? "Payments and credits" : "Deposits and additions"}</dt><dd className="num pos">+{fmt(st.credits)}</dd></div>
              <div><dt>{credit ? "Purchases" : "Withdrawals and payments"}</dt><dd className="num">−{fmt(st.debits)}</dd></div>
              <div><dt><b>{credit ? "New balance owed" : "Ending balance"}</b></dt><dd className="num"><b>{fmt(credit ? -st.closing : st.closing)}</b></dd></div>
            </dl>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Date</th><th>Description</th><th className="r">Amount</th></tr></thead>
                <tbody>
                  {st.tx.map((t) => (
                    <tr key={t.id}><td className="num">{shortDate(t.date)}</td><td>{t.payee}<span className="muted"> · {t.memo}</span></td><td className={`r num${t.amount > 0 ? " pos" : ""}`}>{signed(t.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      <section className="panel">
        <div className="panel-head"><h2>Tax documents</h2></div>
        <ul className="plain-list">
          {state.customer.since >= new Date().getFullYear() ? <li><div><b>No tax documents yet</b><span className="muted">Your first 1099-INT will be ready after the year you earn interest.</span></div></li> : <li><div><b>Form 1099-INT · {new Date().getFullYear() - 1}</b><span className="muted">High-Yield Savings ••{acct(state, "sav").last4} · interest income</span></div><span className="pill">Available Jan 31</span></li>}
        </ul>
      </section>
    </>
  );
}
