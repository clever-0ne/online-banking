"use client";

import { useState } from "react";
import { useBank } from "@/components/BankProvider";
import { AmountInput, PageHead, Progress } from "@/components/ui";
import { fmt, fromISO, longDate, parseAmount, todayISO } from "@/lib/format";
import { addGoal, available, removeGoal } from "@/lib/logic";

function monthsUntil(iso: string) {
  const a = fromISO(todayISO()), b = fromISO(iso);
  return Math.max(1, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth());
}

export default function GoalsPage() {
  const { state, update, act, toast } = useBank();
  const [adding, setAdding] = useState<Record<string, string>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [ng, setNg] = useState({ name: "", target: "", by: "" });
  const [ngError, setNgError] = useState("");

  const totalSaved = state.goals.reduce((a, g) => a + g.saved, 0);
  const sav = state.accounts.find((a) => a.id === "sav")!;

  async function contribute(id: string) {
    const v = parseAmount(adding[id] ?? "");
    const err = !Number.isFinite(v) || v <= 0 ? "Enter an amount." : v > available(state, "chk") ? `Only ${fmt(available(state, "chk"))} available in checking.` : "";
    setErrs((e) => ({ ...e, [id]: err }));
    if (err) return;
    try {
      await act("/api/bank/goal-contributions", { goalId: id, amount: v });
    } catch (e) {
      setErrs((x) => ({ ...x, [id]: (e as Error).message }));
      return;
    }
    setAdding((a) => ({ ...a, [id]: "" }));
    toast(`Moved ${fmt(v)} to savings`);
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    const t = parseAmount(ng.target);
    const err = !ng.name.trim() ? "Name your goal." : !Number.isFinite(t) || t <= 0 ? "Set a target amount." : ng.by && ng.by <= todayISO() ? "Pick a date in the future." : "";
    setNgError(err);
    if (err) return;
    update((s) => addGoal(s, { name: ng.name.trim(), target: t, by: ng.by }));
    setNg({ name: "", target: "", by: "" });
    toast("Goal created");
  }

  return (
    <>
      <PageHead title="Savings goals" sub={`Set money aside for what matters. Goals live in your High-Yield Savings, earning ${sav.apy?.toFixed(2)}% APY.`} />
      <div className="tiles">
        <div className="panel tile"><span className="label">Saved toward goals</span><span className="num big">{fmt(totalSaved)}</span></div>
        <div className="panel tile"><span className="label">Savings balance</span><span className="num big">{fmt(sav.balance)}</span></div>
        <div className="panel tile"><span className="label">Not assigned to a goal</span><span className="num big">{fmt(Math.max(0, sav.balance - totalSaved))}</span></div>
      </div>

      <div className="goals">
        {state.goals.map((g) => {
          const left = Math.max(0, g.target - g.saved);
          const perMonth = g.by && left > 0 ? left / monthsUntil(g.by) : 0;
          const done = left === 0;
          return (
            <section className="panel goal" key={g.id}>
              <div className="panel-head">
                <h2>{g.name}</h2>
                {done ? <span className="pill good">Reached</span> : <span className="label">{Math.round((g.saved / g.target) * 100)}%</span>}
              </div>
              <span className="num big">{fmt(g.saved)} <span className="muted small">of {fmt(g.target)}</span></span>
              <Progress value={g.saved} max={g.target} />
              <p className="hint">
                {done ? "You hit your target." : g.by ? `Save ${fmt(perMonth)} a month to reach it by ${longDate(g.by)}.` : `${fmt(left)} to go.`}
              </p>
              {!done && (
                <div className="goal-add">
                  <AmountInput id={`g-${g.id}`} label={`Amount to add to ${g.name}`} value={adding[g.id] ?? ""} onChange={(v) => setAdding((a) => ({ ...a, [g.id]: v }))} />
                  <button className="btn" type="button" onClick={() => contribute(g.id)}>Add money</button>
                </div>
              )}
              {errs[g.id] && <p className="hint bad">{errs[g.id]}</p>}
              <button className="linkbtn" type="button" onClick={() => { update((s) => removeGoal(s, g.id)); toast("Goal removed. Your money stays in savings"); }}>Remove goal</button>
            </section>
          );
        })}
      </div>

      <section className="panel">
        <form className="form" onSubmit={create} noValidate>
          <h2>New goal</h2>
          <div className="row-2">
            <div className="field"><label htmlFor="ng-name">What are you saving for?</label><input className="input" id="ng-name" value={ng.name} onChange={(e) => setNg({ ...ng, name: e.target.value })} placeholder="e.g. Down payment" /></div>
            <div className="field"><label htmlFor="ng-target">Target</label><AmountInput id="ng-target" value={ng.target} onChange={(v) => setNg({ ...ng, target: v })} /></div>
          </div>
          <div className="field"><label htmlFor="ng-by">Target date <span className="muted">(optional)</span></label><input className="input" type="date" id="ng-by" min={todayISO()} value={ng.by} onChange={(e) => setNg({ ...ng, by: e.target.value })} /></div>
          {ngError && <p className="hint bad" role="alert">{ngError}</p>}
          <div className="actions"><button className="btn" type="submit">Create goal</button></div>
        </form>
      </section>
    </>
  );
}
