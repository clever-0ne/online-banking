"use client";

// Account summary in the retail-bank pattern: a greeting band, one tile per account (small uppercase label,
// large balance, caption), quick actions, recent activity, and upcoming payments down the side.
import Link from "next/link";
import { useBank } from "@/components/BankProvider";
import { Ring } from "@/components/charts";
import { ICONS } from "@/components/nav";
import { daysUntil, fmt, fromISO, longDate, mask } from "@/lib/format";
import { acct, alertFeed, available, bandOf, scheduledLabel, sortedTx } from "@/lib/logic";

const shortDate = (iso: string) => fromISO(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" });

export default function DashboardPage() {
  const { state, can } = useBank();
  const first = state.profile.preferredName || state.customer.name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const cash = state.accounts.filter((a) => a.kind !== "credit");
  const cashTotal = cash.reduce((s, a) => s + available(state, a.id), 0);
  const cc = acct(state, "cc");
  const owed = Math.max(0, -cc.balance);
  const recent = sortedTx(state.tx).slice(0, 6);
  const warnings = alertFeed(state).filter((a) => a.tone === "warn");
  const upcoming = [...state.scheduled].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const score = state.credit.score;
  const name = (id: string) => state.accounts.find((a) => a.id === id)?.name ?? "";
  const go = (href: string) => (can(href) ? href : "/dashboard");

  const actions = [
    ["/transfer", "Transfer", ICONS.transfer, "violet"],
    ["/send", "Send money", ICONS.send, "blue"],
    ["/bills", "Pay bills", ICONS.bill, "amber"],
    ["/deposit", "Deposit", ICONS.topup, "green"],
    ["/withdraw", "Withdraw", ICONS.request, "pink"],
    ["/statements", "Statements", ICONS.note, "teal"],
  ].filter(([href]) => can(href as string)) as [string, string, React.ReactNode, string][];

  return (
    <div className="summary">
      <section className="greet-band">
        <div>
          <h1>{greeting}, {first}</h1>
          <p>{today}</p>
        </div>
        <div className="greet-total">
          <span>Total available</span>
          <b className="num">{fmt(cashTotal)}</b>
        </div>
      </section>

      {warnings.length > 0 && (
        <Link href={go("/alerts")} className="notice warn"><b>{warnings[0].title}.</b> {warnings[0].body}</Link>
      )}

      <div className="summary-grid">
        <div className="summary-main">
          <h2 className="sec-title">Accounts</h2>
          {/* All balances in one card: a row per account, the total at the top, card payment at the bottom. */}
          <section className="acct-card">
            <div className="acct-card-head">
              <h2>Accounts</h2>
              <span className="acct-total"><span>Total available</span><b className="num">{fmt(cashTotal)}</b></span>
            </div>
            <div className="acct-rows">
              {cash.map((a) => (
                <Link key={a.id} href={go("/activity")} className="acct-row">
                  <span className="acct-label" translate="no">{a.name.toUpperCase()} {mask(a.last4)}</span>
                  <span className="acct-amount num">{fmt(available(state, a.id))}</span>
                  <span className="acct-cap">Available balance{a.apy ? ` · ${a.apy}% APY` : ""}{a.held ? ` · ${fmt(a.held)} on hold` : ""}</span>
                </Link>
              ))}
              <Link href={go("/cards")} className="acct-row">
                <span className="acct-label" translate="no">{cc.name.toUpperCase()} {mask(cc.last4)}</span>
                <span className={`acct-amount num${owed > 0 ? " owed" : ""}`}>{fmt(owed)}</span>
                <span className="acct-cap">Current balance · {fmt(available(state, "cc"))} available credit</span>
              </Link>
            </div>
            <Link href={go("/cards")} className="acct-strip">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></svg>
              <span>{owed > 0 && cc.dueDate ? <>Card payment: <b className="num">{fmt(cc.minDue ?? 0)}</b> minimum due {fromISO(cc.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</> : <>Card: <b className="num">{fmt(available(state, "cc"))}</b> available to spend</>}</span>
              <span className="acct-chev" aria-hidden="true">›</span>
            </Link>
          </section>

          {can("/deposit") && <Link href="/deposit" className="add-link">{ICONS.plusCircle}<span>Make a deposit</span></Link>}

          {can("/credit") && (
            <Link href="/credit" className="score-card">
              <Ring value={score === null ? 0 : score - 300} max={550} size={56} color="var(--pos)"><b className="num">{score ?? "—"}</b></Ring>
              <span><b>{score === null ? "Your credit score will appear here" : `Your credit score is ${bandOf(score).toLowerCase()}`}</b><span className="muted small block">{score === null ? "Usually within one statement cycle" : "Updated monthly"}</span></span>
            </Link>
          )}

          {actions.length > 0 && (
            <section className="act-card">
              <div className="side-head"><h2 className="side-title">Move money</h2>{can("/explore") && <Link className="more-link" href="/explore">Explore all</Link>}</div>
              <div className="act-grid">
                {actions.map(([href, label, icon, tone]) => (
                  <Link key={href} href={href} className={`act-item tone-${tone}`}><span className="act-ico">{icon}</span><span>{label}</span></Link>
                ))}
              </div>
            </section>
          )}

          <div className="sec-row">
            <h2 className="sec-title">Recent activity</h2>
            {can("/activity") && <Link className="more-link" href="/activity">View all activity</Link>}
          </div>
          <section className="panel flush">
            {recent.length === 0 ? (
              <p className="empty">No activity yet. Make a deposit to get started.</p>
            ) : (
              <table className="summary-tx">
                <thead><tr><th>Date</th><th>Description</th><th className="r">Amount</th></tr></thead>
                <tbody>
                  {recent.map((t) => (
                    <tr key={t.id}>
                      <td className="tx-date">{shortDate(t.date)}</td>
                      <td>
                        <b>{t.payee}</b>
                        <span className="muted small block">{name(t.acct)}{t.status === "pending" ? " · Pending" : ""}</span>
                      </td>
                      <td className={`r num ${t.amount > 0 ? "pos" : "neg"}`}>{t.amount > 0 ? "+" : "−"}{fmt(Math.abs(t.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <aside className="summary-side">
          <section className="panel">
            <div className="side-head"><h2 className="side-title">Upcoming payments</h2>{can("/bills") && <Link className="more-link" href="/bills">Bill pay</Link>}</div>
            {upcoming.length === 0 ? <p className="muted small">Nothing scheduled.</p> : (
              <ul className="side-list">
                {upcoming.map((s) => {
                  const d = daysUntil(s.date);
                  return (
                    <li key={s.id}>
                      <span><b>{scheduledLabel(state, s)}</b><span className="muted small block">{d === 0 ? "Today" : `${longDate(s.date)} · in ${d} day${d === 1 ? "" : "s"}`}</span></span>
                      <span className="num">{fmt(s.amount)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {can("/goals") && (
            <section className="panel">
              <div className="side-head"><h2 className="side-title">Savings goals</h2><Link className="more-link" href="/goals">Manage</Link></div>
              {state.goals.length === 0 ? <p className="muted small">No goals yet. <Link className="more-link" href="/goals">Set one up</Link></p> : (
                <ul className="side-list">
                  {state.goals.slice(0, 3).map((g) => (
                    <li key={g.id} className="goal-line">
                      <span><b>{g.name}</b><span className="muted small block">{fmt(g.saved)} of {fmt(g.target)}</span></span>
                      <span className="goal-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, (g.saved / g.target) * 100)}%` }} /></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {can("/credit") && (
            <section className="panel">
              <div className="side-head"><h2 className="side-title">Credit score</h2><Link className="more-link" href="/credit">Details</Link></div>
              <p className="score-line"><b className="num">{score ?? "—"}</b><span className="muted small">{score === null ? "Not available yet" : bandOf(score)}</span></p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
