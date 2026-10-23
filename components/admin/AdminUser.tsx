"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "../Avatar";
import { ICONS } from "../nav";
import { StatusPill, adminRequest, day, when } from "./shared";
import type { AdminUserDetail } from "@/lib/server/admin";
import { fmt, mask, signed } from "@/lib/format";

type Confirm = null | "suspend" | "reset_password" | "reset_data" | "delete" | "sign_out" | "remove_passkeys";

export function AdminUser({ user, base, pageAccess }: { user: AdminUserDetail; base: string; pageAccess: React.ReactNode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [temp, setTemp] = useState<string | null>(null);
  const [form, setForm] = useState({ name: user.name, email: user.email, phone: user.phone, note: user.note });
  const dirty = form.name !== user.name || form.email !== user.email || form.phone !== user.phone || form.note !== user.note;

  async function act(body: object, done: string) {
    setBusy(true); setMsg(null);
    try {
      const data = await adminRequest(`${base}/api/users/${user.id}`, "PATCH", body);
      if (data.tempPassword) setTemp(data.tempPassword);
      setMsg({ tone: "good", text: done });
      setConfirm(null); setReason("");
      router.refresh();
    } catch (e) {
      setMsg({ tone: "bad", text: (e as Error).message });
    } finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true); setMsg(null);
    try {
      await adminRequest(`${base}/api/users/${user.id}`, "DELETE");
      router.push(base);
      router.refresh();
    } catch (e) {
      setMsg({ tone: "bad", text: (e as Error).message });
      setBusy(false);
    }
  }

  async function copyTemp() {
    if (!temp) return;
    try { await navigator.clipboard.writeText(temp); setMsg({ tone: "good", text: "Temporary password copied." }); } catch { setMsg({ tone: "bad", text: "Couldn't copy. Select the password and copy it instead." }); }
  }

  return (
    <div className="adm-wrap">
      <Link className="see-all" href={base}>← All customers</Link>

      <section className="panel glass adm-profile">
        <Avatar name={user.name} size="xl" />
        <div className="adm-id">
          <h1>{user.name}</h1>
          <span className="muted">{user.email} · {user.phone || "No phone"}</span>
          <div className="pill-row"><StatusPill status={user.status} /></div>
        </div>
        <dl className="adm-facts">
          <div><dt>Joined</dt><dd>{day(user.createdAt)}</dd></div>
          <div><dt>Last sign-in</dt><dd>{when(user.lastLoginAt)}</dd></div>
          <div><dt>Sign-ins</dt><dd>{user.loginCount}</dd></div>
          <div><dt>Passkeys</dt><dd>{user.passkeys || "None"}</dd></div>
          <div><dt>User ID</dt><dd className="num small">{user.id.slice(0, 13)}</dd></div>
        </dl>
      </section>

      {msg && <p className={`notice ${msg.tone === "bad" ? "warn" : ""}`} role="status">{msg.text}</p>}

      {temp && (
        <section className="panel glass temp-pw">
          <div>
            <b>Temporary password</b>
            <p className="muted small">Shown once. Give it to {user.name.split(" ")[0]} privately. They should change it in Profile → Security after signing in. Their other sessions were signed out.</p>
          </div>
          <code>{temp}</code>
          <div className="actions"><button type="button" className="btn small" onClick={copyTemp}>{ICONS.copy}Copy</button><button type="button" className="btn ghost small" onClick={() => setTemp(null)}>Done</button></div>
        </section>
      )}

      <div className="adm-detail">
        <div className="adm-col">
          <section className="panel glass">
            <div className="sec-head"><h2>Manage account</h2></div>
            <div className="adm-actions">
              {user.status === "active" ? (
                <button type="button" className="adm-act" disabled={busy} onClick={() => setConfirm("suspend")}>
                  <span className="row-ico" style={{ color: "var(--neg)" }}>{ICONS.eyeOff}</span>
                  <span><b>Suspend account</b><span className="muted">Blocks sign-in and ends all sessions</span></span>
                </button>
              ) : (
                <button type="button" className="adm-act" disabled={busy} onClick={() => act({ action: "activate" }, `${user.name} can sign in again.`)}>
                  <span className="row-ico" style={{ color: "var(--pos)" }}>{ICONS.eye}</span>
                  <span><b>Reactivate account</b><span className="muted">Lets them sign in again</span></span>
                </button>
              )}
              <button type="button" className="adm-act" disabled={busy} onClick={() => setConfirm("sign_out")}>
                <span className="row-ico">{ICONS.transfer}</span>
                <span><b>Sign out everywhere</b><span className="muted">Ends every session on every device</span></span>
              </button>
              <button type="button" className="adm-act" disabled={busy} onClick={() => setConfirm("reset_password")}>
                <span className="row-ico">{ICONS.copy}</span>
                <span><b>Reset password</b><span className="muted">Creates a one-time temporary password</span></span>
              </button>
              {user.passkeys > 0 && (
                <button type="button" className="adm-act" disabled={busy} onClick={() => setConfirm("remove_passkeys")}>
                  <span className="row-ico">{ICONS.shield}</span>
                  <span><b>Remove passkeys</b><span className="muted">For a lost device: they sign in with their password only</span></span>
                </button>
              )}
              <button type="button" className="adm-act" disabled={busy} onClick={() => setConfirm("reset_data")}>
                <span className="row-ico">{ICONS.history}</span>
                <span><b>Reset banking data</b><span className="muted">Sets balances to $0 and clears settings</span></span>
              </button>
              <button type="button" className="adm-act danger" disabled={busy} onClick={() => setConfirm("delete")}>
                <span className="row-ico">{ICONS.close}</span>
                <span><b>Delete account</b><span className="muted">Permanently removes the user and their data</span></span>
              </button>
            </div>

            {confirm && (
              <div className="adm-confirm">
                {confirm === "suspend" && (
                  <>
                    <b>Suspend {user.name}?</b>
                    <p className="muted small">They&apos;ll be signed out right away and can&apos;t sign in until reactivated.</p>
                    <input className="input" placeholder="Reason (kept in the activity log)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} aria-label="Reason" />
                    <div className="actions"><button type="button" className="btn danger small" disabled={busy} onClick={() => act({ action: "suspend", reason }, `${user.name} is suspended and signed out.`)}>Suspend</button><button type="button" className="btn ghost small" onClick={() => setConfirm(null)}>Cancel</button></div>
                  </>
                )}
                {confirm === "sign_out" && (
                  <>
                    <b>Sign {user.name} out everywhere?</b>
                    <p className="muted small">They can sign straight back in with their password.</p>
                    <div className="actions"><button type="button" className="btn small" disabled={busy} onClick={() => act({ action: "sign_out" }, "All sessions ended.")}>Sign out everywhere</button><button type="button" className="btn ghost small" onClick={() => setConfirm(null)}>Cancel</button></div>
                  </>
                )}
                {confirm === "reset_password" && (
                  <>
                    <b>Reset {user.name}&apos;s password?</b>
                    <p className="muted small">Their current password stops working and they&apos;re signed out everywhere. You&apos;ll see a temporary password once.</p>
                    <div className="actions"><button type="button" className="btn small" disabled={busy} onClick={() => act({ action: "reset_password" }, "Password reset.")}>Reset password</button><button type="button" className="btn ghost small" onClick={() => setConfirm(null)}>Cancel</button></div>
                  </>
                )}
                {confirm === "remove_passkeys" && (
                  <>
                    <b>Remove {user.name}&apos;s passkeys?</b>
                    <p className="muted small">Only do this after confirming who you&apos;re talking to. They&apos;ll be signed out and can sign back in with just their password, then add a new passkey in Profile.</p>
                    <div className="actions"><button type="button" className="btn danger small" disabled={busy} onClick={() => act({ action: "remove_passkeys" }, "Passkeys removed.")}>Remove passkeys</button><button type="button" className="btn ghost small" onClick={() => setConfirm(null)}>Cancel</button></div>
                  </>
                )}
                {confirm === "reset_data" && (
                  <>
                    <b>Reset {user.name}&apos;s banking data?</b>
                    <p className="muted small">Each balance is brought to $0 with an adjustment entry, scheduled payments are canceled and settings are cleared. Past transactions stay on record.</p>
                    <div className="actions"><button type="button" className="btn danger small" disabled={busy} onClick={() => act({ action: "reset_data" }, "Banking data reset.")}>Reset data</button><button type="button" className="btn ghost small" onClick={() => setConfirm(null)}>Cancel</button></div>
                  </>
                )}
                {confirm === "delete" && (
                  <>
                    <b>Delete {user.name} permanently?</b>
                    <p className="muted small">This removes the account and all of its banking data. It can&apos;t be undone. Type <code>{user.email}</code> to confirm.</p>
                    <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type the email to confirm" autoComplete="off" />
                    <div className="actions"><button type="button" className="btn danger small" disabled={busy || typed.trim().toLowerCase() !== user.email} onClick={remove}>Delete account</button><button type="button" className="btn ghost small" onClick={() => { setConfirm(null); setTyped(""); }}>Cancel</button></div>
                  </>
                )}
              </div>
            )}
          </section>

          {pageAccess}

          <section className="panel glass">
            <div className="sec-head"><h2>Details</h2></div>
            <form className="form" onSubmit={(e) => { e.preventDefault(); act({ action: "update", ...form }, "Details saved."); }} noValidate>
              <div className="row-2">
                <div className="field"><label htmlFor="au-name">Full name</label><input className="input" id="au-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="field"><label htmlFor="au-phone">Phone</label><input className="input" id="au-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div className="field"><label htmlFor="au-email">Email</label><input className="input" id="au-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="field"><label htmlFor="au-note">Admin note <span className="muted">(only staff see this)</span></label><textarea className="input" id="au-note" rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
              <div className="actions"><button className="btn" type="submit" disabled={!dirty || busy}>Save details</button>{dirty && <button type="button" className="btn ghost" onClick={() => setForm({ name: user.name, email: user.email, phone: user.phone, note: user.note })}>Undo</button>}</div>
            </form>
          </section>
        </div>

        <div className="adm-col">
          <section className="panel glass">
            <div className="sec-head"><h2>Accounts</h2>{user.bank.updatedAt && <span className="muted small">Updated {when(user.bank.updatedAt)}</span>}</div>
            {user.accounts.length === 0 ? <p className="empty">No accounts yet. They&apos;re opened the first time the customer signs in.</p> : (
              <ul className="plain-list">
                {user.accounts.map((a) => (
                  <li key={a.id}><div><b>{a.name}</b><span className="muted">{mask(a.last4)} · {a.kind}</span></div><span className="num">{fmt(a.kind === "credit" ? -a.balance : a.balance)}{a.kind === "credit" ? " owed" : ""}</span></li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel glass">
            <div className="sec-head"><h2>Recent transactions</h2><span className="muted small">{user.bank.txCount} total</span></div>
            {user.recentTx.length === 0 ? <p className="empty">No transactions.</p> : (
              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    {user.recentTx.map((t) => (
                      <tr key={t.id}><td className="num small">{t.date}</td><td>{t.payee}<span className="muted block small">{t.cat}{t.status === "pending" ? " · pending" : ""}</span></td><td className={`r num${t.amount > 0 ? " pos" : ""}`}>{signed(t.amount)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
