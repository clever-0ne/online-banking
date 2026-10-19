"use client";

import { useState } from "react";
import { useBank } from "@/components/BankProvider";
import { AmountInput, PageHead, Switch } from "@/components/ui";
import { addBusinessDays, fmt, longDate, mask, parseAmount, shortDate, todayISO } from "@/lib/format";
import { acct, addBiller, available, sortedTx, toggleAutopay } from "@/lib/logic";
import type { Repeat } from "@/lib/types";

interface Row {
  amount: string;
  date: string;
  repeat: Repeat;
}

export default function BillsPage() {
  const { state, update, act, toast } = useBank();
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [nb, setNb] = useState({ name: "", cat: "Utilities", account: "" });
  const [nbError, setNbError] = useState("");

  const row = (id: string): Row => rows[id] ?? { amount: "", date: addBusinessDays(todayISO(), 0), repeat: "once" };
  const setRow = (id: string, p: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...row(id), ...p } }));

  const scheduled = state.scheduled.filter((s) => s.type === "bill").sort((a, b) => a.date.localeCompare(b.date));
  const history = sortedTx(state.tx).filter((t) => t.kind === "bill").slice(0, 8);
  const lastPaid = (name: string) => sortedTx(state.tx).find((t) => t.kind === "bill" && t.payee === name);

  async function pay(id: string) {
    const r = row(id);
    const v = parseAmount(r.amount);
    let err = "";
    if (!Number.isFinite(v) || v <= 0) err = "Enter an amount.";
    else if (r.date < todayISO()) err = "Pick today or later.";
    else if (r.date === todayISO() && v > available(state, "chk")) err = `Only ${fmt(available(state, "chk"))} available.`;
    setErrors((e) => ({ ...e, [id]: err }));
    if (err) return;
    const b = state.billers.find((x) => x.id === id)!;
    try {
      await act("/api/bank/bill-payments", { billerId: id, amount: v, date: r.date, repeat: r.repeat });
    } catch (e) {
      setErrors((x) => ({ ...x, [id]: (e as Error).message }));
      return;
    }
    setRows((x) => { const n = { ...x }; delete n[id]; return n; });
    toast(r.date === todayISO() ? `Paid ${fmt(v)} to ${b.name}` : `Payment to ${b.name} scheduled`);
  }

  function saveBiller(e: React.FormEvent) {
    e.preventDefault();
    const err = !nb.name.trim() ? "Add the company's name." : !/^[A-Za-z0-9-]{4,24}$/.test(nb.account) ? "Enter the account number from your bill (4–24 letters or digits)." : "";
    setNbError(err);
    if (err) return;
    update((s) => addBiller(s, nb));
    setNb({ name: "", cat: "Utilities", account: "" });
    setAdding(false);
    toast("Payee added");
  }

  return (
    <>
      <PageHead title="Bill pay" sub="Pay any company from your checking account. Payments made by 8 p.m. ET go out the same business day.">
        <button className="btn ghost" type="button" onClick={() => setAdding((a) => !a)}>{adding ? "Close" : "Add a payee"}</button>
      </PageHead>

      {adding && (
        <section className="panel">
          <form className="form" onSubmit={saveBiller} noValidate>
            <h2>Add a payee</h2>
            <div className="row-2">
              <div className="field"><label htmlFor="nb-name">Company name</label><input className="input" id="nb-name" value={nb.name} onChange={(e) => setNb({ ...nb, name: e.target.value })} placeholder="e.g. City Water Dept." /></div>
              <div className="field">
                <label htmlFor="nb-cat">Category</label>
                <select className="input" id="nb-cat" value={nb.cat} onChange={(e) => setNb({ ...nb, cat: e.target.value })}>
                  {["Utilities", "Housing", "Insurance", "Loans", "Medical", "Other"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label htmlFor="nb-acct">Account number on your bill</label><input className="input mono" id="nb-acct" value={nb.account} onChange={(e) => setNb({ ...nb, account: e.target.value.trim() })} /></div>
            {nbError && <p className="hint bad" role="alert">{nbError}</p>}
            <div className="actions"><button className="btn" type="submit">Add payee</button></div>
          </form>
        </section>
      )}

      <section className="panel flush">
        <div className="panel-head pad"><h2>Pay bills</h2><span className="label">From Checking ••{acct(state, "chk").last4} · {fmt(available(state, "chk"))} available</span></div>
        {state.billers.map((b) => {
          const r = row(b.id);
          const last = lastPaid(b.name);
          return (
            <div className="bill-row" key={b.id}>
              <div className="bill-who">
                <b>{b.name}</b>
                <span className="muted">{b.cat} · acct {mask(b.last4)}{last ? ` · last paid ${fmt(-last.amount)} on ${shortDate(last.date)}` : ""}</span>
                <label className="autopay"><Switch id={`ap-${b.id}`} checked={b.autopay} onChange={() => { update((s) => toggleAutopay(s, b.id)); toast(b.autopay ? "Autopay turned off" : "Autopay turned on"); }} label={`Autopay for ${b.name}`} /> Autopay</label>
              </div>
              <div className="bill-form">
                <AmountInput id={`amt-${b.id}`} label={`Amount to pay ${b.name}`} value={r.amount} onChange={(v) => setRow(b.id, { amount: v })} />
                <input className="input" type="date" aria-label={`Payment date for ${b.name}`} min={todayISO()} value={r.date} onChange={(e) => setRow(b.id, { date: e.target.value })} />
                <select className="input" aria-label={`Frequency for ${b.name}`} value={r.repeat} onChange={(e) => setRow(b.id, { repeat: e.target.value as Repeat })}>
                  <option value="once">One time</option><option value="monthly">Monthly</option>
                </select>
                <button className="btn" type="button" onClick={() => pay(b.id)}>Pay</button>
              </div>
              {errors[b.id] && <p className="hint bad bill-err">{errors[b.id]}</p>}
            </div>
          );
        })}
      </section>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h2>Scheduled payments</h2><span className="label">{scheduled.length}</span></div>
          {scheduled.length === 0 ? <p className="empty">No bill payments scheduled.</p> : (
            <ul className="plain-list">
              {scheduled.map((s) => {
                const b = state.billers.find((x) => x.id === s.to);
                return (
                  <li key={s.id}>
                    <div><b>{b?.name}</b><span className="muted">{longDate(s.date)}{s.repeat !== "once" ? ` · ${s.repeat}` : ""}{b?.autopay ? " · autopay" : ""}</span></div>
                    <div className="row-end"><span className="num">{fmt(s.amount)}</span><button className="linkbtn" type="button" onClick={() => act(`/api/bank/scheduled/${s.id}`, undefined, "DELETE").then(() => toast("Payment canceled"), (e: Error) => toast(e.message))}>Cancel</button></div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Recent payments</h2></div>
          <ul className="plain-list">
            {history.map((t) => (
              <li key={t.id}><div><b>{t.payee}</b><span className="muted">{longDate(t.date)}</span></div><span className="num">{fmt(-t.amount)}</span></li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
