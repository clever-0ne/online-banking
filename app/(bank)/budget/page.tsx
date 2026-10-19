"use client";

import { useState } from "react";
import { useBank } from "@/components/BankProvider";
import { PageHead, Progress } from "@/components/ui";
import { addMonths, fmt, fromISO, monthKey, monthLabel, todayISO } from "@/lib/format";
import { setBudget, spendingInMonth } from "@/lib/logic";

export default function BudgetPage() {
  const { state, update, toast } = useBank();
  const thisMonth = monthKey(todayISO());
  const months = [0, -1, -2].map((n) => monthKey(addMonths(todayISO(), n)));
  const [month, setMonth] = useState(thisMonth);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const spent = Object.fromEntries(spendingInMonth(state, month));
  const cats = Object.keys(state.budgets);
  const unbudgeted = Object.entries(spent).filter(([c]) => !(c in state.budgets)).sort((a, b) => b[1] - a[1]);
  const totalBudget = cats.reduce((a, c) => a + state.budgets[c], 0);
  const totalSpent = cats.reduce((a, c) => a + (spent[c] ?? 0), 0);

  const t = fromISO(todayISO());
  const daysInMonth = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
  const elapsed = month === thisMonth ? t.getDate() / daysInMonth : 1;

  function save(cat: string) {
    const v = Number(draft);
    if (!Number.isFinite(v) || v < 0) return;
    update((s) => setBudget(s, cat, Math.round(v)));
    setEditing(null);
    toast(`${cat} budget set to ${fmt(Math.round(v))}`);
  }

  return (
    <>
      <PageHead title="Budget" sub="See where your money goes each month across checking and your credit card.">
        <select className="input" aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>
          {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </PageHead>

      <div className="tiles">
        <div className="panel tile"><span className="label">Spent on budgeted categories</span><span className="num big">{fmt(totalSpent)}</span><Progress value={totalSpent} max={totalBudget} tone={totalSpent > totalBudget ? "bad" : undefined} /></div>
        <div className="panel tile"><span className="label">{totalSpent > totalBudget ? "Over budget by" : "Left to spend"}</span><span className={`num big${totalSpent > totalBudget ? " bad-text" : ""}`}>{fmt(Math.abs(totalBudget - totalSpent))}</span></div>
        {month === thisMonth && <div className="panel tile"><span className="label">Month elapsed</span><span className="num big">{Math.round(elapsed * 100)}%</span><span className="hint">Day {t.getDate()} of {daysInMonth}</span></div>}
      </div>

      <section className="panel">
        <div className="panel-head"><h2>By category</h2><span className="label">Spent · Budget</span></div>
        <div className="budget-list">
          {cats.map((c) => {
            const s = spent[c] ?? 0, b = state.budgets[c];
            const over = s > b;
            const ahead = !over && month === thisMonth && b > 0 && s / b > elapsed + 0.15;
            return (
              <div className="budget-row" key={c}>
                <div className="budget-top">
                  <b>{c}</b>
                  {over && <span className="pill bad">Over by {fmt(s - b)}</span>}
                  {ahead && <span className="pill pending">Spending fast</span>}
                  <span className="budget-figs">
                    <span className="num">{fmt(s)}</span>
                    <span className="muted"> of </span>
                    {editing === c ? (
                      <span className="inline-amt">
                        <span>$</span>
                        <input className="input" type="number" min={0} step={10} autoFocus aria-label={`${c} budget`} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(c); if (e.key === "Escape") setEditing(null); }} />
                        <button className="linkbtn" type="button" onClick={() => save(c)}>Save</button>
                      </span>
                    ) : (
                      <button className="linkbtn num" type="button" onClick={() => { setEditing(c); setDraft(String(b)); }} aria-label={`Edit ${c} budget`}>{fmt(b)}</button>
                    )}
                  </span>
                </div>
                <Progress value={s} max={b} tone={over ? "bad" : ahead ? "warn" : undefined} />
              </div>
            );
          })}
        </div>
      </section>

      {unbudgeted.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>Other spending</h2><span className="label">No budget set</span></div>
          <ul className="plain-list">
            {unbudgeted.map(([c, v]) => (
              <li key={c}>
                <b>{c}</b>
                <div className="row-end"><span className="num">{fmt(v)}</span><button className="linkbtn" type="button" onClick={() => { update((s) => setBudget(s, c, Math.ceil(v / 50) * 50)); toast(`Added a ${c} budget`); }}>Set a budget</button></div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
