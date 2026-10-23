"use client";

// Account summary: every account in rows with its balance, the card with what's due, recent activity and
// quick links, the way a retail bank lays out its first page after sign-on.
import Link from "next/link";
import { useBank } from "@/components/BankProvider";
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

  const actions = [
    ["/transfer", "Transfer money", ICONS.transfer],
    ["/send", "Send money", ICONS.send],
    ["/bills", "Pay a bill", ICONS.bill],
    ["/deposit", "Deposit", ICONS.topup],
    ["/withdraw", "Withdraw", ICONS.request],
    ["/statements", "Statements", ICONS.note],
  ].filter(([href]) => can(href as string)) as [string, string, React.ReactNode][];

  return (
    <div className="summary">
      <div className="summary-head">
        <div>
          <h1>{greeting}, {first}</h1>
          <p className="muted">{today}</p>
        </div>
        <div className="actions">
          {can("/transfer") && <Link className="btn" href="/transfer">Transfer &amp; pay</Link>}
          {can("/deposit") && <Link className="btn ghost" href="/deposit">Deposit</Link>}
        </div>
      </div>

      {warnings.length > 0 && (
        <Link href={can("/alerts") ? "/alerts" : "/dashboard"} className="notice warn"><b>{warnings[0].title}.</b> {warnings[0].body}</Link>
      )}

      <div className="summary-grid">
        <div className="summary-main">
          {/* Cash accounts */}
          <section className="panel flush">
            <div className="acct-head"><h2>Cash accounts</h2><span className="muted small">Available balance</span></div>
            <ul className="acct-list">
              {cash.map((a) => (
                <li key={a.id}>
                  <Link href={can("/activity") ? "/activity" : "/dashboard"} className="acct-row">
                    <span className="acct-name"><b translate="no">{a.name}</b><span className="muted">{mask(a.last4)}{a.apy ? ` · ${a.apy}% APY` : ""}{a.held ? ` · ${fmt(a.held)} on hold` : ""}</span></span>
                    <span className="acct-bal num">{fmt(available(state, a.id))}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="acct-total"><span>Total available</span><b className="num">{fmt(cashTotal)}</b></div>
          </section>

          {/* Credit card */}
          <section className="panel flush">
            <div className="acct-head"><h2>Credit cards</h2><span className="muted small">Current balance</span></div>
            <ul className="acct-list">
              <li>
                <Link href={can("/cards") ? "/cards" : "/dashboard"} className="acct-row">
                  <span className="acct-name"><b translate="no">{cc.name}</b><span className="muted">{mask(cc.last4)} · {fmt(available(state, "cc"))} available of {fmt(cc.limit ?? 0)}</span></span>
                  <span className="acct-bal num">{fmt(owed)}</span>
                </Link>
              </li>
            </ul>
            <div className="acct-total">
              <span>{owed > 0 && cc.dueDate ? <>Minimum payment {fmt(cc.minDue ?? 0)} due {longDate(cc.dueDate)}</> : "No payment due"}</span>
              {owed > 0 && can("/transfer") && <Link className="see-all" href="/transfer">Make a payment</Link>}
            </div>
          </section>

          {/* Recent activity */}
          <section className="panel flush">
            <div className="acct-head"><h2>Recent activity</h2>{can("/activity") && <Link className="see-all" href="/activity">View all activity</Link>}</div>
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
                      <td className={`r num${t.amount > 0 ? " pos" : ""}`}>{t.amount > 0 ? "+" : "−"}{fmt(Math.abs(t.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <aside className="summary-side">
          <section className="panel">
            <h2 className="side-title">I want to…</h2>
            <ul className="quick-list">
              {actions.map(([href, label, icon]) => (
                <li key={href}><Link href={href}><span className="quick-ico">{icon}</span>{label}<span className="quick-chev">{ICONS.arrow}</span></Link></li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <div className="side-head"><h2 className="side-title">Upcoming payments</h2>{can("/bills") && <Link className="see-all" href="/bills">Bill pay</Link>}</div>
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
              <div className="side-head"><h2 className="side-title">Savings goals</h2><Link className="see-all" href="/goals">Manage</Link></div>
              {state.goals.length === 0 ? <p className="muted small">No goals yet. <Link href="/goals">Set one up</Link>.</p> : (
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
              <div className="side-head"><h2 className="side-title">Credit score</h2><Link className="see-all" href="/credit">Details</Link></div>
              <p className="score-line"><b className="num">{score ?? "—"}</b><span className="muted small">{score === null ? "Not available yet" : bandOf(score)}</span></p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
