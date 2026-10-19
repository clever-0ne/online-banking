"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { useBank } from "@/components/BankProvider";
import { catIcon } from "@/components/catIcons";
import { BalanceLine, Donut, GroupedBars, Ring } from "@/components/charts";
import { ICONS, OPEN_MENU_EVENT } from "@/components/nav";
import { Progress } from "@/components/ui";
import { addMonths, daysUntil, fmt, fromISO, longDate, mask, monthKey, todayISO } from "@/lib/format";
import { acct, alertFeed, available, balanceSeries, bandOf, scheduledLabel, sortedTx, spendingInMonth } from "@/lib/logic";
import type { BankState, Card } from "@/lib/types";

/** Money in and out per calendar month, oldest first. */
function monthlyFlow(s: BankState, months = 4) {
  return Array.from({ length: months }, (_, k) => {
    const m = monthKey(addMonths(todayISO(), k - (months - 1)));
    const tx = s.tx.filter((t) => monthKey(t.date) === m && t.cat !== "Transfers");
    return {
      label: fromISO(m + "-01").toLocaleDateString("en-US", { month: "short" }),
      a: Math.round(tx.filter((t) => t.amount > 0).reduce((x, t) => x + t.amount, 0)),
      b: Math.round(tx.filter((t) => t.amount < 0).reduce((x, t) => x - t.amount, 0)),
    };
  });
}

export default function DashboardPage() {
  const { state, can } = useBank();
  const [cardId, setCardId] = useState<Card["id"]>("debit");
  const [hidden, setHidden] = useState(false);
  const card = state.cards.find((c) => c.id === cardId)!;
  const linked = acct(state, card.linked);
  const balance = card.id === "credit" ? available(state, "cc") : available(state, linked.id);
  const recent = sortedTx(state.tx).slice(0, 5);
  const warnings = alertFeed(state).filter((a) => a.tone === "warn");
  const first = state.profile.preferredName || state.customer.name.split(" ")[0];
  const money = (n: number) => (hidden ? "••••" : fmt(n));

  const flow = useMemo(() => monthlyFlow(state), [state]);
  const thisMonth = flow[flow.length - 1];
  const spend = useMemo(() => spendingInMonth(state), [state]);
  const spendTop = [...spend.slice(0, 5), ...(spend.length > 5 ? [["Other", spend.slice(5).reduce((a, [, v]) => a + v, 0)] as [string, number]] : [])];
  const spendTotal = spend.reduce((a, [, v]) => a + v, 0);
  const saved = state.tx.filter((t) => t.acct === "sav" && t.amount > 0 && monthKey(t.date) === monthKey(todayISO())).reduce((a, t) => a + t.amount, 0);
  const budgets = Object.entries(state.budgets).map(([c, b]) => ({ c, b, s: spend.find(([k]) => k === c)?.[1] ?? 0 })).sort((x, y) => y.s / y.b - x.s / x.b).slice(0, 4);
  const upcoming = [...state.scheduled].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const score = state.credit.score;

  return (
    <div className="bento">
      {/* Wallet: greeting, card, actions, quick transfer */}
      <section className="panel glass t-wallet">
        <div className="home-hello">
          <Avatar name={state.customer.name} photo={state.profile.photo} />
          <div><span className="muted">Welcome back,</span><b>{first}</b></div>
        </div>

        <div className={`balance-card${card.locked ? " locked" : ""}`} role="group" aria-label={`${card.name} ending ${card.last4}`}>
          <div className="bal-top">
            <span className="bal-label">{card.id === "credit" ? "Available credit" : "Current balance"}</span>
            <span className="bal-logo" aria-hidden="true"><i /><i /></span>
          </div>
          <div className="bal-row">
            <span className="bal-amount">{hidden ? "$ ••••••" : fmt(balance)}</span>
            <button type="button" className="bal-eye" onClick={() => setHidden((h) => !h)} aria-label={hidden ? "Show amounts" : "Hide amounts"} aria-pressed={hidden}>
              {hidden ? ICONS.eyeOff : ICONS.eye}
            </button>
          </div>
          <div className="bal-pan">•••• •••• •••• {card.last4}</div>
          <div className="bal-foot">
            <span>{card.id === "debit" ? "Debit card" : "Cash Back Visa"}{card.locked ? " · Turned off" : ""}</span>
            <span>{card.exp}</span>
          </div>
        </div>
        <div className="card-switch" role="group" aria-label="Choose card">
          {state.cards.map((c) => (
            <button key={c.id} type="button" aria-pressed={c.id === cardId} aria-label={c.id === "debit" ? "Debit card" : "Credit card"} onClick={() => setCardId(c.id)} />
          ))}
        </div>

        <div className="actions-4">
          {can("/deposit") && <Link href="/deposit" className="act"><span>{ICONS.topup}</span>Deposit</Link>}
          {can("/send") && <Link href="/send" className="act"><span>{ICONS.send}</span>Send</Link>}
          {can("/send") && <Link href="/send?mode=request" className="act"><span>{ICONS.request}</span>Request</Link>}
          <button type="button" className="act" onClick={() => window.dispatchEvent(new Event(OPEN_MENU_EVENT))}><span>{ICONS.more}</span>More</button>
        </div>

        {can("/send") && <div>
          <div className="sec-head"><h2>Quick Transfer</h2><Link className="see-all" href="/send">See all</Link></div>
          <div className="quick-row">
            <Link href="/send?new=1" className="quick-person add"><span className="avatar">+</span><span>Add</span></Link>
            {state.contacts.map((c) => (
              <Link key={c.id} href={`/send?to=${c.id}`} className="quick-person"><Avatar name={c.name} /><span>{c.name.split(" ")[0]}</span></Link>
            ))}
          </div>
        </div>}

        {warnings.length > 0 && <Link href="/alerts" className="notice warn"><b>{warnings[0].title}.</b> {warnings[0].body}</Link>}
      </section>

      {/* This month */}
      <div className="t-stats stat-tiles">
        <div className="stat glass"><span className="stat-ico in">{ICONS.request}</span><span className="muted">Income this month</span><b>{money(thisMonth.a)}</b></div>
        <div className="stat glass"><span className="stat-ico out">{ICONS.send}</span><span className="muted">Spent this month</span><b>{money(thisMonth.b)}</b></div>
        <div className="stat glass"><span className="stat-ico save">{ICONS.topup}</span><span className="muted">Saved this month</span><b>{money(saved)}</b></div>
        <div className="stat glass"><span className="stat-ico net">{ICONS.transfer}</span><span className="muted">Net this month</span><b className={thisMonth.a - thisMonth.b >= 0 ? "pos" : "bad-text"}>{hidden ? "••••" : (thisMonth.a - thisMonth.b >= 0 ? "+" : "−") + fmt(Math.abs(thisMonth.a - thisMonth.b))}</b></div>
      </div>

      <section className="panel glass t-balance">
        <div className="sec-head"><h2>Checking balance</h2><span className="muted small">Last 30 days</span></div>
        <BalanceLine points={balanceSeries(state, "chk", 30)} label="Checking balance, last 30 days" height={230} />
      </section>

      <section className="panel glass t-flow">
        <div className="sec-head"><h2>Income vs spending</h2><span className="muted small">Last 4 months</span></div>
        <GroupedBars data={flow} label="Income and spending per month, last 4 months" />
      </section>

      <section className="panel glass t-donut">
        <div className="sec-head"><h2>Spending by category</h2>{can("/budget") && <Link className="see-all" href="/budget">Budget</Link>}</div>
        {spendTop.length ? <Donut data={spendTop} total={spendTotal} label="Spending by category this month" /> : <p className="empty">No spending yet this month.</p>}
      </section>

      <section className="panel glass t-tx">
        <div className="sec-head"><h2>Recent Transaction</h2>{can("/activity") && <Link className="see-all" href="/activity">See all</Link>}</div>
        <div className="tx-cards">
          {recent.length === 0 && <p className="empty">No transactions yet. Add money to get started.</p>}
          {recent.map((t) => (
            <Link href="/activity" className="tx-card" key={t.id}>
              <span className="row-ico">{catIcon(t.cat)}</span>
              <div><b>{t.payee}</b><span className="muted">{fromISO(t.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })} · {t.cat}</span></div>
              <span className={`amt${t.amount > 0 ? " pos" : ""}`}>
                {hidden ? "••••" : `${t.amount > 0 ? "+" : "−"}${fmt(Math.abs(t.amount))}`}
                {t.status === "pending" && <small>Pending</small>}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel glass t-up">
        <div className="sec-head"><h2>Upcoming</h2>{can("/bills") && <Link className="see-all" href="/bills">Bill pay</Link>}</div>
        <div className="upcoming-list">
          {upcoming.length === 0 && <p className="empty">Nothing scheduled.</p>}
          {upcoming.map((s) => {
            const d = daysUntil(s.date);
            return (
              <div key={s.id} className="up-row">
                <span className="date-chip"><b>{fromISO(s.date).getDate()}</b><span>{fromISO(s.date).toLocaleDateString("en-US", { month: "short" })}</span></span>
                <div><b>{scheduledLabel(state, s)}</b><span className="muted">{d === 0 ? "Today" : `In ${d} day${d === 1 ? "" : "s"}`}{s.repeat !== "once" ? ` · ${s.repeat}` : ""}</span></div>
                <span className="num">{money(s.amount)}</span>
              </div>
            );
          })}
        </div>
        <p className="hint tile-foot">{acct(state, "cc").balance < 0 && acct(state, "cc").dueDate ? `Card payment due ${longDate(acct(state, "cc").dueDate!)}` : "No card balance due"}</p>
      </section>

      <section className="panel glass t-bud">
        <div className="sec-head"><h2>Budgets</h2>{can("/budget") && <Link className="see-all" href="/budget">Manage</Link>}</div>
        <div className="budget-mini">
          {budgets.length === 0 && <p className="empty">No budgets set. <Link href="/budget">Create one</Link></p>}
          {budgets.map(({ c, b, s }) => (
            <div key={c}>
              <div className="bm-top"><span className="row-ico sm">{catIcon(c)}</span><b>{c}</b><span className="muted">{money(s)} / {fmt(b)}</span></div>
              <Progress value={s} max={b} tone={s > b ? "bad" : s / b > 0.85 ? "warn" : undefined} />
            </div>
          ))}
        </div>
      </section>

      <section className="panel glass t-goals">
        <div className="sec-head"><h2>Savings goals</h2>{can("/goals") && <Link className="see-all" href="/goals">All goals</Link>}</div>
        <div className="goal-rings">
          {state.goals.length === 0 && <p className="empty">No goals yet. <Link href="/goals">Start saving</Link></p>}
          {state.goals.slice(0, 3).map((g, i) => (
            <Link href="/goals" key={g.id} className="goal-ring">
              <Ring value={g.saved} max={g.target} color={["var(--accent)", "var(--mauve-strong)", "var(--teal-strong)"][i]}><b>{Math.round((g.saved / g.target) * 100)}%</b></Ring>
              <span>{g.name}</span>
              <span className="muted small">{money(g.saved)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel glass t-credit credit-mini">
        <div className="sec-head"><h2>Credit score</h2>{can("/credit") && <Link className="see-all" href="/credit">Details</Link>}</div>
        <div className="cm-body">
          <Ring value={score === null ? 0 : score - 300} max={550} size={96} color="var(--teal-strong)"><b className="cm-score">{score ?? "—"}</b></Ring>
          <div>
            <b>{score === null ? "Not available yet" : bandOf(score)}</b>
            {score !== null && state.credit.history.length > 1 && <span className="muted">{score >= state.credit.history[0].score ? "Up" : "Down"} {Math.abs(score - state.credit.history[0].score)} points in {state.credit.history.length} months</span>}
            <span className="muted">Card use {Math.round(((acct(state, "cc").limit ?? 0) - available(state, "cc")) / (acct(state, "cc").limit ?? 1) * 100)}% · {mask(acct(state, "cc").last4)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
