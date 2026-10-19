// Admin features: audit trail, user search, stats and account actions. Server only.
import { ledgerCount, resetToZero, staffAccounts, staffRecentTx, summary, type BankSummary } from "./bank";
import { all, one, run } from "./db";
import { findById, fromRow, hashPassword, temporaryPassword, toPublic, type PublicUser, type UserRow } from "./users";
import type { Account, Tx } from "@/lib/types";

/** Who performed an action: a customer (their id and email) or staff ("admin" and the admin username). */
export type Actor = { id: string; email: string };

// ---------- Audit log ----------
export interface AuditEntry {
  id: number;
  at: string;
  actorEmail: string | null;
  action: string;
  targetId: string | null;
  targetEmail: string | null;
  detail: string;
}

export async function audit(actor: Actor | null, action: string, target: Actor | null, detail = "") {
  await run("INSERT INTO audit_log (at, actor_id, actor_email, action, target_id, target_email, detail) VALUES (?, ?, ?, ?, ?, ?, ?)",
    new Date().toISOString(), actor?.id ?? null, actor?.email ?? null, action, target?.id ?? null, target?.email ?? null, detail);
}

type AuditRow = { id: number; at: string; actor_email: string | null; action: string; target_id: string | null; target_email: string | null; detail: string };

export async function recentAudit(limit = 30, targetId?: string): Promise<AuditEntry[]> {
  const rows = targetId
    ? await all<AuditRow>("SELECT * FROM audit_log WHERE target_id = ? ORDER BY id DESC LIMIT ?", targetId, limit)
    : await all<AuditRow>("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", limit);
  return rows.map((r) => ({ id: r.id, at: r.at, actorEmail: r.actor_email, action: r.action, targetId: r.target_id, targetEmail: r.target_email, detail: r.detail }));
}

// ---------- Banking summaries (from the ledger) ----------
export type { BankSummary };

export interface AdminUserRow extends PublicUser {
  bank: BankSummary;
}

export async function listUsers(f: { q?: string; status?: string; sort?: string }): Promise<AdminUserRow[]> {
  const where: string[] = [];
  const args: unknown[] = [];
  if (f.q) { where.push("(u.name ILIKE ? OR u.email ILIKE ? OR u.phone ILIKE ?)"); const like = `%${f.q.replace(/[\\%_]/g, "\\$&")}%`; args.push(like, like, like); }
  if (f.status === "active" || f.status === "suspended") { where.push("u.status = ?"); args.push(f.status); }
  const order = f.sort === "name" ? "LOWER(u.name) ASC" : f.sort === "login" ? "u.last_login_at DESC NULLS LAST" : "u.created_at DESC";
  const today = new Date().toISOString().slice(0, 10);
  const rows = await all<UserRow & { cash: number; cc: number; n: number; last: string | null; updated: string | null }>(
    `SELECT u.*,
            COALESCE(SUM(CASE WHEN l.acct != 'cc' AND l.available_on <= ? THEN l.amount_cents END), 0) AS cash,
            COALESCE(SUM(CASE WHEN l.acct = 'cc' AND l.available_on <= ? THEN l.amount_cents END), 0) AS cc,
            COUNT(l.seq) AS n, MAX(l.date) AS last, MAX(l.created_at) AS updated
       FROM users u LEFT JOIN ledger l ON l.user_id = u.id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
      GROUP BY u.id ORDER BY ${order} LIMIT 500`,
    today, today, ...args,
  );
  return rows.map((r) => ({
    ...toPublic(fromRow(r)),
    bank: { cash: r.cash / 100, owed: Math.max(0, -r.cc) / 100, txCount: r.n, lastActivity: r.last, updatedAt: r.updated },
  }));
}

export interface AdminUserDetail extends AdminUserRow {
  accounts: Account[];
  recentTx: Tx[];
  audit: AuditEntry[];
  passkeys: number;
}

export async function userDetail(id: string): Promise<AdminUserDetail | null> {
  const u = await findById(id);
  if (!u) return null;
  const passkeys = (await one<{ n: number }>("SELECT COUNT(*) AS n FROM passkeys WHERE user_id = ?", id))!.n;
  return { ...toPublic(u), bank: await summary(id), accounts: await staffAccounts(id), recentTx: await staffRecentTx(id), audit: await recentAudit(25, id), passkeys };
}

export async function stats() {
  const count = async (sql: string, ...a: unknown[]) => (await one<{ n: number }>(sql, ...a))!.n;
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  const deposits = (await one<{ n: number }>(`SELECT COALESCE(SUM(amount_cents), 0) AS n FROM ledger WHERE acct != 'cc' AND available_on <= ?`, new Date().toISOString().slice(0, 10)))!.n;
  const firstDay = new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10);
  const byDay = new Map((await all<{ day: string; n: number }>(
    "SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n FROM users WHERE created_at >= ? GROUP BY 1", firstDay,
  )).map((r) => [r.day, r.n]));
  return {
    total: await count("SELECT COUNT(*) AS n FROM users"),
    active: await count("SELECT COUNT(*) AS n FROM users WHERE status = 'active'"),
    suspended: await count("SELECT COUNT(*) AS n FROM users WHERE status = 'suspended'"),
    transactions: await ledgerCount(),
    newThisWeek: await count("SELECT COUNT(*) AS n FROM users WHERE created_at >= ?", weekAgo),
    activeToday: await count("SELECT COUNT(*) AS n FROM users WHERE last_login_at >= ?", dayAgo),
    deposits: deposits / 100,
    signupsByDay: Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10);
      return { day: d, n: byDay.get(d) ?? 0 };
    }),
  };
}

// ---------- Actions ----------
export type AdminAction =
  | { action: "suspend"; reason?: string }
  | { action: "activate" }
  | { action: "sign_out" }
  | { action: "reset_password" }
  | { action: "remove_passkeys" }
  | { action: "update"; name?: string; email?: string; phone?: string; note?: string }
  | { action: "reset_data" };

export class AdminError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Applies one admin action to a customer. Returns a one-time temporary password for resets. */
export async function applyAction(actor: Actor, targetId: string, a: AdminAction): Promise<{ user: PublicUser; tempPassword?: string }> {
  const t = await findById(targetId);
  if (!t) throw new AdminError("That customer no longer exists.", 404);
  const bump = "session_version = session_version + 1";

  switch (a.action) {
    case "suspend":
      await run(`UPDATE users SET status = 'suspended', ${bump} WHERE id = ?`, t.id);
      await audit(actor, "suspend", t, a.reason?.slice(0, 200) ?? "");
      break;
    case "activate":
      await run("UPDATE users SET status = 'active' WHERE id = ?", t.id);
      await audit(actor, "activate", t);
      break;
    case "sign_out":
      await run(`UPDATE users SET ${bump} WHERE id = ?`, t.id);
      await audit(actor, "sign_out_everywhere", t);
      break;
    case "reset_password": {
      const temp = temporaryPassword();
      await run(`UPDATE users SET password_hash = ?, ${bump} WHERE id = ?`, hashPassword(temp), t.id);
      await audit(actor, "reset_password", t);
      return { user: toPublic((await findById(t.id))!), tempPassword: temp };
    }
    case "remove_passkeys": {
      // For a customer who lost their device: they can sign in with their password and add a new passkey.
      const n = await run("DELETE FROM passkeys WHERE user_id = ?", t.id);
      await run(`UPDATE users SET ${bump} WHERE id = ?`, t.id);
      await audit(actor, "remove_passkeys", t, `${n} removed`);
      break;
    }
    case "update": {
      const name = a.name?.trim() ?? t.name;
      const email = (a.email?.trim() ?? t.email).toLowerCase();
      const phone = a.phone?.trim() ?? t.phone;
      const note = (a.note ?? t.note).slice(0, 1000);
      if (name.length < 2) throw new AdminError("Enter the customer's full name.");
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) throw new AdminError("Enter a valid email address.");
      if (email !== t.email && (await one("SELECT 1 FROM users WHERE email = ?", email))) throw new AdminError("Another account already uses that email.");
      await run("UPDATE users SET name = ?, email = ?, phone = ?, note = ? WHERE id = ?", name, email, phone, note, t.id);
      const changed = [name !== t.name && "name", email !== t.email && "email", phone !== t.phone && "phone", note !== t.note && "note"].filter(Boolean).join(", ");
      await audit(actor, "update_profile", { id: t.id, email }, changed ? `Changed ${changed}` : "No changes");
      break;
    }
    case "reset_data":
      await resetToZero(t.id, actor.email);
      await audit(actor, "reset_bank_data", t, "Balances set to $0 with adjustment entries; scheduled payments canceled");
      break;
    default:
      throw new AdminError("Unknown action.");
  }
  return { user: toPublic((await findById(t.id))!) };
}

export async function deleteUser(actor: Actor, targetId: string) {
  const t = await findById(targetId);
  if (!t) throw new AdminError("That customer no longer exists.", 404);
  // Accounts, ledger, settings, page access and passkeys go with it (ON DELETE CASCADE).
  await run("DELETE FROM users WHERE id = ?", t.id);
  await audit(actor, "delete_user", { id: t.id, email: t.email }, `Deleted ${t.name}`);
}
