"use client";

import Link from "next/link";
import { useState } from "react";
import { useBank } from "@/components/BankProvider";
import { AmountInput, PageHead, Success, Tabs } from "@/components/ui";
import { addBusinessDays, fmt, longDate, mask, parseAmount, todayISO } from "@/lib/format";
import { acct, addExternal, available, routingValid, scheduledLabel } from "@/lib/logic";
import type { AccountId, Repeat } from "@/lib/types";

type Mode = "internal" | "ach";
type CardAmount = "min" | "statement" | "current" | "other";

interface Draft {
  mode: Mode;
  from: AccountId;
  to: string;
  amount: string;
  cardAmount: CardAmount;
  date: string;
  repeat: Repeat;
  memo: string;
}

export function Transfer({ initialTo }: { initialTo?: string }) {
  const { state, update, act, toast } = useBank();
  const [busy, setBusy] = useState(false);
  const blank = (): Draft => ({
    mode: "internal",
    from: "chk",
    to: initialTo === "cc" || initialTo === "sav" ? initialTo : "sav",
    amount: "",
    cardAmount: "min",
    date: todayISO(),
    repeat: "once",
    memo: "",
  });
  const [d, setD] = useState<Draft>(blank);
  const [step, setStep] = useState<"form" | "review" | "done">("form");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [ext, setExt] = useState({ nickname: "", bank: "", routing: "", account: "", confirm: "", type: "checking" as "checking" | "savings" });
  const [extError, setExtError] = useState("");
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  const cc = acct(state, "cc");
  const toCard = d.mode === "internal" && d.to === "cc";
  const cardAmounts: [CardAmount, string, number][] = [
    ["min", "Minimum payment", cc.minDue ?? 0],
    ["statement", "Statement balance", cc.statementBalance ?? 0],
    ["current", "Current balance", -cc.balance],
  ];
  const amountValue = toCard && d.cardAmount !== "other" ? cardAmounts.find((c) => c[0] === d.cardAmount)![2] : parseAmount(d.amount);
  const fromOptions = state.accounts.filter((a) => a.kind !== "credit");
  const toOptions = state.accounts.filter((a) => a.id !== d.from);
  const toName = d.mode === "internal" ? (() => { const a = acct(state, d.to as AccountId); return `${a.name} ${mask(a.last4)}`; })() : (() => { const e = state.external.find((x) => x.id === d.to); return e ? `${e.nickname} ${mask(e.last4)}` : ""; })();
  const eta = d.mode === "ach" ? addBusinessDays(d.date, 3) : d.date;

  function switchMode(mode: Mode) {
    set({ mode, from: "chk", to: mode === "internal" ? "sav" : state.external[0]?.id ?? "", repeat: "once" });
    setError("");
  }

  function review(e: React.FormEvent) {
    e.preventDefault();
    let err = "";
    if (!d.to) err = "Choose where the money should go.";
    else if (!Number.isFinite(amountValue) || amountValue <= 0) err = toCard ? "There's nothing to pay on this choice. Pick another amount." : "Enter an amount in dollars, such as 50 or 50.25.";
    else if (d.date === todayISO() && amountValue > available(state, d.from)) err = `That's more than the ${fmt(available(state, d.from))} available in ${acct(state, d.from).name}.`;
    else if (d.mode === "ach" && amountValue > 10000) err = "Transfers to other banks are limited to $10,000 per day.";
    else if (d.date < todayISO()) err = "Pick today or a future date.";
    setError(err);
    if (!err) setStep("review");
  }

  async function confirm() {
    setBusy(true);
    try {
      await act("/api/bank/transfers", { type: d.mode === "ach" ? "ach" : "transfer", from: d.from, to: d.to, amount: amountValue, date: d.date, repeat: d.repeat, memo: d.memo.trim() });
    } catch (e) {
      setError((e as Error).message);
      setStep("form");
      return;
    } finally {
      setBusy(false);
    }
    // Freeze the amount: paying the card changes the minimum and statement figures it was picked from.
    set({ cardAmount: "other", amount: amountValue.toFixed(2) });
    setStep("done");
    toast(d.date === todayISO() ? "Transfer sent" : "Transfer scheduled");
  }

  function saveExternal(e: React.FormEvent) {
    e.preventDefault();
    let err = "";
    if (!ext.nickname.trim() || !ext.bank.trim()) err = "Add a nickname and the bank's name.";
    else if (!routingValid(ext.routing)) err = "That routing number isn't valid. It's the 9-digit number at the bottom left of a check.";
    else if (!/^\d{4,17}$/.test(ext.account)) err = "Account numbers are 4 to 17 digits.";
    else if (ext.account !== ext.confirm) err = "The account numbers don't match.";
    setExtError(err);
    if (err) return;
    update((s) => addExternal(s, ext));
    setAdding(false);
    setExt({ nickname: "", bank: "", routing: "", account: "", confirm: "", type: "checking" });
    toast("External account added");
  }

  const pendingTransfers = [...state.scheduled].filter((s) => s.type !== "bill").sort((a, b) => a.date.localeCompare(b.date));

  if (step === "done") {
    return (
      <>
        <PageHead title="Transfer" />
        <section className="panel">
          <Success
            title={`${d.date === todayISO() ? "Sent" : "Scheduled"}: ${fmt(amountValue)} to ${toName}`}
            body={d.mode === "ach" ? `Transfers to other banks take 1–3 business days. Expect it by ${longDate(eta)}.` : d.date === todayISO() ? "Moved between your Anchor accounts. Both balances are updated." : `It will go on ${longDate(d.date)}${d.repeat !== "once" ? ` and repeat ${d.repeat}` : ""}.`}
          >
            <button className="btn" type="button" onClick={() => { setD(blank()); setStep("form"); }}>Make another transfer</button>
            <Link className="btn ghost" href="/dashboard">Back to dashboard</Link>
          </Success>
        </section>
      </>
    );
  }

  if (step === "review") {
    const from = acct(state, d.from);
    return (
      <>
        <PageHead title="Review your transfer" />
        <section className="panel">
          <div className="form">
            <dl className="review">
              <div><dt>From</dt><dd>{from.name} {mask(from.last4)}</dd></div>
              <div><dt>To</dt><dd>{toName}</dd></div>
              <div><dt>Amount</dt><dd className="num"><b>{fmt(amountValue)}</b></dd></div>
              <div><dt>Date</dt><dd>{longDate(d.date)}{d.repeat !== "once" ? `, then ${d.repeat}` : ""}</dd></div>
              {d.mode === "ach" && <div><dt>Delivery</dt><dd>Standard ACH, by {longDate(eta)}</dd></div>}
              {d.memo && <div><dt>Memo</dt><dd>{d.memo}</dd></div>}
              <div><dt>Fee</dt><dd className="num">{fmt(0)}</dd></div>
            </dl>
            <div className="actions">
              <button className="btn" type="button" onClick={confirm} disabled={busy}>{d.date === todayISO() ? "Send now" : "Schedule transfer"}</button>
              <button className="btn ghost" type="button" onClick={() => setStep("form")}>Edit</button>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHead title="Transfer" sub="Move money between your Anchor accounts, pay your card, or send to an account at another bank." />
      <section className="panel">
        <form className="form" onSubmit={review} noValidate>
          <Tabs<Mode> label="Transfer type" value={d.mode} onChange={switchMode} options={[["internal", "My Anchor accounts"], ["ach", "Another bank"]]} />

          <div className="row-2">
            <div className="field">
              <label htmlFor="t-from">From</label>
              <select className="input" id="t-from" value={d.from} onChange={(e) => { const from = e.target.value as AccountId; set({ from, to: d.mode === "internal" && d.to === from ? toOptions.find((a) => a.id !== from)!.id : d.to }); }}>
                {fromOptions.map((a) => <option key={a.id} value={a.id}>{a.name} {mask(a.last4)} · {fmt(available(state, a.id))}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="t-to">To</label>
              {d.mode === "internal" ? (
                <select className="input" id="t-to" value={d.to} onChange={(e) => set({ to: e.target.value })}>
                  {toOptions.map((a) => <option key={a.id} value={a.id}>{a.name} {mask(a.last4)}</option>)}
                </select>
              ) : (
                <select className="input" id="t-to" value={d.to} onChange={(e) => set({ to: e.target.value })}>
                  {state.external.length === 0 && <option value="">No linked accounts yet</option>}
                  {state.external.map((x) => <option key={x.id} value={x.id}>{x.nickname} · {x.bank} {mask(x.last4)}</option>)}
                </select>
              )}
            </div>
          </div>

          {d.mode === "ach" && !adding && (
            <button type="button" className="linkbtn" onClick={() => setAdding(true)}>+ Link an account at another bank</button>
          )}

          {toCard ? (
            <fieldset className="radio-list">
              <legend className="field-legend">Payment amount</legend>
              {cardAmounts.map(([k, label, v]) => (
                <label key={k} className="radio-row">
                  <input type="radio" name="cardAmount" checked={d.cardAmount === k} onChange={() => set({ cardAmount: k })} />
                  <span>{label}</span><span className="num">{fmt(v)}</span>
                </label>
              ))}
              <label className="radio-row">
                <input type="radio" name="cardAmount" checked={d.cardAmount === "other"} onChange={() => set({ cardAmount: "other" })} />
                <span>Other amount</span>
              </label>
              {d.cardAmount === "other" && <AmountInput id="t-amount" value={d.amount} onChange={(v) => set({ amount: v })} />}
              {cc.dueDate && <p className="hint">Payment due {longDate(cc.dueDate)}.</p>}
            </fieldset>
          ) : (
            <div className="field">
              <label htmlFor="t-amount">Amount</label>
              <AmountInput id="t-amount" value={d.amount} onChange={(v) => set({ amount: v })} />
              <span className="hint">Available: {fmt(available(state, d.from))}</span>
            </div>
          )}

          <div className="row-2">
            <div className="field">
              <label htmlFor="t-date">Send on</label>
              <input className="input" type="date" id="t-date" min={todayISO()} value={d.date} onChange={(e) => set({ date: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="t-repeat">Frequency</label>
              <select className="input" id="t-repeat" value={d.repeat} onChange={(e) => set({ repeat: e.target.value as Repeat })}>
                <option value="once">One time</option>
                <option value="weekly">Every week</option>
                <option value="monthly">Every month</option>
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="t-memo">Memo <span className="muted">(optional)</span></label>
            <input className="input" id="t-memo" maxLength={60} value={d.memo} onChange={(e) => set({ memo: e.target.value })} placeholder="What it's for" />
          </div>

          {error && <p className="hint bad" role="alert">{error}</p>}
          <div className="actions"><button className="btn" type="submit" disabled={d.mode === "ach" && !d.to}>Continue</button></div>
        </form>
      </section>

      {adding && (
        <section className="panel">
          <form className="form" onSubmit={saveExternal} noValidate>
            <h2>Link an account at another bank</h2>
            <p className="hint">Use the routing and account numbers printed at the bottom of a check from that account.</p>
            <div className="row-2">
              <div className="field"><label htmlFor="x-nick">Nickname</label><input className="input" id="x-nick" value={ext.nickname} onChange={(e) => setExt({ ...ext, nickname: e.target.value })} placeholder="e.g. Joint savings" /></div>
              <div className="field"><label htmlFor="x-bank">Bank name</label><input className="input" id="x-bank" value={ext.bank} onChange={(e) => setExt({ ...ext, bank: e.target.value })} /></div>
            </div>
            <div className="row-2">
              <div className="field">
                <label htmlFor="x-routing">Routing number</label>
                <input className="input mono" id="x-routing" inputMode="numeric" maxLength={9} value={ext.routing} onChange={(e) => setExt({ ...ext, routing: e.target.value.replace(/\D/g, "") })} />
                {ext.routing.length === 9 && <span className={`hint ${routingValid(ext.routing) ? "good" : "bad"}`}>{routingValid(ext.routing) ? "Valid routing number" : "Check digit doesn't match"}</span>}
              </div>
              <div className="field">
                <label htmlFor="x-type">Account type</label>
                <select className="input" id="x-type" value={ext.type} onChange={(e) => setExt({ ...ext, type: e.target.value as "checking" | "savings" })}>
                  <option value="checking">Checking</option><option value="savings">Savings</option>
                </select>
              </div>
            </div>
            <div className="row-2">
              <div className="field"><label htmlFor="x-acct">Account number</label><input className="input mono" id="x-acct" inputMode="numeric" value={ext.account} onChange={(e) => setExt({ ...ext, account: e.target.value.replace(/\D/g, "") })} /></div>
              <div className="field"><label htmlFor="x-acct2">Confirm account number</label><input className="input mono" id="x-acct2" inputMode="numeric" value={ext.confirm} onChange={(e) => setExt({ ...ext, confirm: e.target.value.replace(/\D/g, "") })} /></div>
            </div>
            {extError && <p className="hint bad" role="alert">{extError}</p>}
            <div className="actions"><button className="btn" type="submit">Link account</button><button className="btn ghost" type="button" onClick={() => setAdding(false)}>Cancel</button></div>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="panel-head"><h2>Scheduled transfers</h2><span className="label">{pendingTransfers.length}</span></div>
        {pendingTransfers.length === 0 ? <p className="empty">No transfers scheduled.</p> : (
          <ul className="plain-list">
            {pendingTransfers.map((s) => (
              <li key={s.id}>
                <div><b>{scheduledLabel(state, s)}</b><span className="muted">{longDate(s.date)}{s.repeat !== "once" ? ` · repeats ${s.repeat}` : ""} · from {acct(state, s.from).name}</span></div>
                <div className="row-end"><span className="num">{fmt(s.amount)}</span><button className="linkbtn" type="button" onClick={() => act(`/api/bank/scheduled/${s.id}`, undefined, "DELETE").then(() => toast("Transfer canceled"), (e: Error) => toast(e.message))}>Cancel</button></div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
