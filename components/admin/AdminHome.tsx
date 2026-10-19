"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "../Avatar";
import { ICONS } from "../nav";
import { AuditList, StatusPill, adminRequest, day, when } from "./shared";
import type { AdminUserRow, AuditEntry, stats as statsFn } from "@/lib/server/admin";
import { fmt } from "@/lib/format";

type Stats = Awaited<ReturnType<typeof statsFn>>;

export function AdminHome({ base, initialUsers, stats, audit, setup }: { base: string; initialUsers: AdminUserRow[]; stats: Stats; audit: AuditEntry[]; setup?: React.ReactNode }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("new");
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const first = useRef(true);

  // Re-query the server when filters change (search waits for typing to pause).
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(async () => {
      const p = new URLSearchParams({ q, status, sort });
      const res = await fetch(`${base}/api/users?${p}`);
      if (res.ok) setUsers((await res.json()).users);
    }, 250);
    return () => clearTimeout(t);
  }, [q, status, sort, base]);

  async function quick(u: AdminUserRow, action: "suspend" | "activate") {
    setBusy(u.id); setMsg(null);
    try {
      await adminRequest(`${base}/api/users/${u.id}`, "PATCH", { action });
      setUsers((list) => list.map((x) => (x.id === u.id ? { ...x, status: action === "suspend" ? "suspended" : "active" } : x)));
      setMsg({ tone: "good", text: `${u.name} is ${action === "suspend" ? "suspended and signed out" : "active again"}.` });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "bad", text: (e as Error).message });
    } finally { setBusy(null); }
  }

  const peak = Math.max(1, ...stats.signupsByDay.map((d) => d.n));

  return (
    <div className="adm-wrap">
      <div className="adm-head">
        <div><h1>Customers</h1><p className="muted">Everyone with an Anchor Bank account, and every change staff have made.</p></div>
      </div>

      {setup}

      <div className="adm-stats">
        <div className="stat glass"><span className="stat-ico net">{ICONS.users}</span><span className="muted">Total users</span><b>{stats.total}</b></div>
        <div className="stat glass"><span className="stat-ico in">{ICONS.user}</span><span className="muted">Signed in today</span><b>{stats.activeToday}</b></div>
        <div className="stat glass"><span className="stat-ico save">{ICONS.request}</span><span className="muted">New this week</span><b>{stats.newThisWeek}</b></div>
        <div className="stat glass"><span className="stat-ico out">{ICONS.eyeOff}</span><span className="muted">Suspended</span><b>{stats.suspended}</b></div>
        <div className="stat glass"><span className="stat-ico net">{ICONS.transfer}</span><span className="muted">Transactions</span><b>{stats.transactions.toLocaleString("en-US")}</b></div>
        <div className="stat glass"><span className="stat-ico in">{ICONS.topup}</span><span className="muted">Deposits held</span><b>{fmt(stats.deposits)}</b></div>
      </div>

      <div className="adm-grid">
        <section className="panel glass adm-users">
          <div className="adm-toolbar">
            <label className="adm-search">
              {ICONS.search}
              <input className="input" type="search" placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
            </label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="">Any status</option><option value="active">Active</option><option value="suspended">Suspended</option>
            </select>
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              <option value="new">Newest first</option><option value="login">Last sign-in</option><option value="name">Name A–Z</option>
            </select>
          </div>
          {msg && <p className={`notice ${msg.tone === "bad" ? "warn" : ""}`} role="status">{msg.text}</p>}
          <div className="table-wrap">
            <table className="table adm-table">
              <thead><tr><th>Customer</th><th>Status</th><th className="r">Cash</th><th>Joined</th><th>Last sign-in</th><th className="r">Actions</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link className="adm-user" href={`${base}/users/${u.id}`}>
                        <Avatar name={u.name} />
                        <span><b>{u.name}</b><span className="muted block">{u.email}</span></span>
                      </Link>
                    </td>
                    <td><StatusPill status={u.status} /></td>
                    <td className="r num">{fmt(u.bank.cash)}</td>
                    <td>{day(u.createdAt)}</td>
                    <td>{when(u.lastLoginAt)}</td>
                    <td className="r">
                      <div className="row-actions">
                        <Link className="btn ghost small" href={`${base}/users/${u.id}`}>Manage</Link>
                        {(u.status === "active"
                          ? <button type="button" className="btn ghost small danger-text" disabled={busy === u.id} onClick={() => quick(u, "suspend")}>Suspend</button>
                          : <button type="button" className="btn ghost small" disabled={busy === u.id} onClick={() => quick(u, "activate")}>Reactivate</button>)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <p className="empty">No customers match those filters.</p>}
          </div>
        </section>

        <aside className="adm-side">
          <section className="panel glass">
            <div className="sec-head"><h2>Sign-ups</h2><span className="muted small">Last 14 days</span></div>
            <div className="spark-bars" role="img" aria-label={`Sign-ups per day over 14 days, peak ${peak}`}>
              {stats.signupsByDay.map((d) => (
                <span key={d.day} title={`${d.day}: ${d.n}`} style={{ height: `${Math.max(4, (d.n / peak) * 100)}%` }} className={d.n ? "" : "zero"} />
              ))}
            </div>
          </section>
          <section className="panel glass">
            <div className="sec-head"><h2>Recent activity</h2></div>
            <AuditList items={audit} />
          </section>
        </aside>
      </div>
    </div>
  );
}
