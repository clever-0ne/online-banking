// Server-side banking: accounts, the append-only ledger, scheduled payments and every movement of money.
// Balances are never stored or accepted from the browser; they're the sum of ledger entries, in whole cents.
// Customers can only change their own settings (profile, alerts, budgets, payees and so on) directly.
// Anything that moves money runs in one transaction holding that customer's lock, so balances can't be double-spent.
import { randomUUID } from "node:crypto";
import { all, one, run, tx } from "./db";
import { notifyCustomer } from "./push";
import { addBusinessDays, addDays, addMonths, fmt, mask, nextDayOfMonth, todayISO } from "@/lib/format";
import { ACH_DAILY_LIMIT, formatPhone, handleKind, P2P_DAILY_LIMIT } from "@/lib/logic";
import { newAccount, ROUTING_NUMBER } from "@/lib/seed";
import type { Account, AccountId, BankState, Card, Goal, P2P, Repeat, Scheduled, Tx, TxKind } from "@/lib/types";

export class BankError extends Error {
  constructor(message: string, public status = 400, public field?: string) { super(message); }
}

interface Owner { id: string; name: string; email: string; phone: string; createdAt: string }

// ---------- Settings: the part of the state customers may edit ----------
const SETTINGS_KEYS = ["customer", "profile", "external", "contacts", "p2p", "billers", "cards", "travel", "goals", "alerts", "budgets"] as const;
type SettingsKey = (typeof SETTINGS_KEYS)[number];
type Settings = Pick<BankState, SettingsKey | "credit">;
/** Fields only the server sets. A settings update that includes any of them is refused. */
export const SERVER_OWNED = ["accounts", "tx", "scheduled", "routing", "credit", "version"];

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function pickSettings(s: Partial<BankState>): Settings {
  const out = {} as Record<string, unknown>;
  for (const k of [...SETTINGS_KEYS, "credit"]) if (k in s) out[k] = s[k as keyof BankState];
  return out as unknown as Settings;
}

async function readSettings(userId: string): Promise<Settings | null> {
  const r = await one<{ data: string }>("SELECT data FROM bank_state WHERE user_id = ?", userId);
  if (!r) return null;
  try { return pickSettings(JSON.parse(r.data)); } catch { return null; }
}

async function writeSettings(userId: string, s: Settings) {
  await run(
    "INSERT INTO bank_state (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
    userId, JSON.stringify(s), new Date().toISOString(),
  );
}

const ARRAY_KEYS: SettingsKey[] = ["external", "contacts", "p2p", "billers", "cards", "travel", "goals"];

/** Checks the shape of a settings update and keeps the server's own figures (goal progress, card ids). */
function cleanSettings(input: Record<string, unknown>, prev: Settings): Settings {
  const out = { ...prev } as Record<string, unknown>;
  for (const k of SETTINGS_KEYS) {
    if (!(k in input)) continue;
    const v = input[k];
    const ok = ARRAY_KEYS.includes(k) ? Array.isArray(v) && v.length <= 500 && v.every(isObj) : isObj(v);
    if (!ok) throw new BankError(`"${k}" isn't in the expected format.`);
    out[k] = v;
  }
  const s = out as unknown as Settings;
  // Sent and received payments come from the ledger; only requests are kept here.
  s.p2p = s.p2p.filter((p) => p.direction === "requested");
  // Goal progress is counted from the ledger, so a goal's "saved" figure from the browser is ignored.
  s.goals = s.goals.map((g): Goal => {
    const target = Number(g.target);
    return { id: str(g.id, 60), name: str(g.name, 60), target: Number.isFinite(target) && target > 0 ? Math.round(target * 100) / 100 : 0, saved: 0, ...(g.by ? { by: str(g.by, 10) } : {}) };
  });
  // Only the controls on the two existing cards can change.
  s.cards = prev.cards.map((c): Card => {
    const n = (s.cards as unknown as Record<string, unknown>[]).find((x) => x.id === c.id);
    if (!n) return c;
    const bool = (k: keyof Card) => (typeof n[k] === "boolean" ? (n[k] as boolean) : (c[k] as boolean));
    const num = (k: "atm" | "spend", lo: number, hi: number) => (typeof n[k] === "number" && Number.isFinite(n[k]) ? Math.min(hi, Math.max(lo, n[k] as number)) : c[k]);
    return {
      ...c,
      locked: bool("locked"), online: bool("online"), abroad: bool("abroad"), contactless: bool("contactless"),
      spend: num("spend", 0, 10000) ?? c.spend,
      ...(c.atm !== undefined ? { atm: num("atm", 0, 1000) } : {}),
      last4: typeof n.last4 === "string" && /^\d{4}$/.test(n.last4) ? n.last4 : c.last4,
      exp: typeof n.exp === "string" && /^\d{2}\/\d{2}$/.test(n.exp) ? n.exp : c.exp,
      ...(typeof n.replacementOrdered === "string" ? { replacementOrdered: str(n.replacementOrdered, 10) } : {}),
    };
  });
  for (const [k, v] of Object.entries(s.budgets)) if (typeof v !== "number" || !Number.isFinite(v) || v < 0) delete s.budgets[k];
  s.customer = { ...prev.customer, name: str(s.customer.name, 120) || prev.customer.name, email: str(s.customer.email, 200) || prev.customer.email, phone: str(s.customer.phone, 40) };
  return s;
}

// ---------- Accounts ----------
interface AccountRow { id: AccountId; name: string; kind: Account["kind"]; last4: string; credit_limit_cents: number; apy: number | null }

const accountRows = (userId: string) =>
  all<AccountRow>("SELECT id, name, kind, last4, credit_limit_cents, apy FROM bank_accounts WHERE user_id = ? ORDER BY CASE id WHEN 'chk' THEN 1 WHEN 'sav' THEN 2 ELSE 3 END", userId);

async function accountRow(userId: string, id: string): Promise<AccountRow> {
  const a = (await accountRows(userId)).find((x) => x.id === id);
  if (!a) throw new BankError("That account doesn't exist.", 400);
  return a;
}

/** Opens checking, savings and a card for a new customer, with $0 balances. Safe to call again. */
export async function ensureOpen(user: Owner) {
  const have = (await one<{ a: number; s: number }>(
    "SELECT (SELECT COUNT(*) FROM bank_accounts WHERE user_id = ?) AS a, (SELECT COUNT(*) FROM bank_state WHERE user_id = ?) AS s", user.id, user.id,
  ))!;
  if (have.a >= 3 && have.s > 0) return;
  await tx(async () => {
    const fresh = newAccount(user);
    if ((await accountRows(user.id)).length === 0) {
      for (const a of fresh.accounts) {
        await run(
          "INSERT INTO bank_accounts (user_id, id, name, kind, last4, credit_limit_cents, apy, opened_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
          user.id, a.id, a.name, a.kind, a.last4, Math.round((a.limit ?? 0) * 100), a.apy ?? null, new Date().toISOString(),
        );
      }
    }
    if (!(await readSettings(user.id))) {
      // The credit card's number matches the card account already on file.
      const cc = await accountRow(user.id, "cc");
      const s = pickSettings(fresh);
      s.cards = s.cards.map((c) => (c.id === "credit" ? { ...c, last4: cc.last4 } : c));
      await writeSettings(user.id, s);
    }
  }, user.id);
}

/** Whether the customer wants to hear about new sign-ins (Profile → Security → Sign-in alerts). On unless turned off. */
export async function signInAlertsOn(userId: string): Promise<boolean> {
  const s = await readSettings(userId);
  return (s?.profile as { security?: { loginAlerts?: boolean } } | undefined)?.security?.loginAlerts !== false;
}

// ---------- Ledger ----------
interface Entry {
  acct: AccountId; date: string; availableOn: string; amountCents: number;
  payee: string; cat: string; memo: string; kind: TxKind;
  handle?: string; goalId?: string; ref?: string;
}

async function post(userId: string, e: Entry, by: string) {
  await postEntry(userId, e, by);
}

/** Adds one ledger entry. Call it inside a transaction that holds the customer's lock. */
export async function postEntry(userId: string, e: Entry, by: string) {
  await run(
    `INSERT INTO ledger (user_id, acct, date, available_on, amount_cents, payee, cat, memo, kind, handle, goal_id, ref, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    userId, e.acct, e.date, e.availableOn, e.amountCents, e.payee, e.cat, e.memo, e.kind, e.handle ?? null, e.goalId ?? null, e.ref ?? null, new Date().toISOString(), by,
  );
}

interface LedgerRow { seq: number; acct: AccountId; date: string; available_on: string; amount_cents: number; payee: string; cat: string; memo: string; kind: TxKind; handle: string | null; goal_id: string | null }

const ledgerRows = (userId: string) =>
  all<LedgerRow>("SELECT seq, acct, date, available_on, amount_cents, payee, cat, memo, kind, handle, goal_id FROM ledger WHERE user_id = ? ORDER BY seq", userId);

const toTx = (r: LedgerRow, today: string): Tx => ({
  id: "tx" + String(r.seq).padStart(10, "0"),
  date: r.date, acct: r.acct, payee: r.payee, cat: r.cat, memo: r.memo, kind: r.kind,
  amount: r.amount_cents / 100,
  status: r.available_on > today ? "pending" : "posted",
});

/** Posted balance and pending debits for one account, in cents. */
async function totals(userId: string, acct: AccountId, today = todayISO()) {
  const r = await one<{ posted: number; pending_out: number; total: number }>(
    `SELECT COALESCE(SUM(CASE WHEN available_on <= ? THEN amount_cents END), 0) AS posted,
            COALESCE(SUM(CASE WHEN available_on > ? AND amount_cents < 0 THEN amount_cents END), 0) AS pending_out,
            COALESCE(SUM(amount_cents), 0) AS total
       FROM ledger WHERE user_id = ? AND acct = ?`,
    today, today, userId, acct,
  );
  return r!;
}

/** Money held for withdrawals waiting for staff approval, in cents. */
export async function heldCents(userId: string, acct: AccountId): Promise<number> {
  return (await one<{ n: number }>("SELECT COALESCE(SUM(amount_cents), 0) AS n FROM crypto_withdrawals WHERE user_id = ? AND from_acct = ? AND status = 'pending'", userId, acct))!.n;
}

/** Money that can be spent now: the posted balance less pending debits and held withdrawals. For the card, unused credit. */
async function availableCents(userId: string, acct: AccountId): Promise<number> {
  const t = await totals(userId, acct);
  const a = await accountRow(userId, acct);
  return (a.kind === "credit" ? a.credit_limit_cents : 0) + t.posted + t.pending_out - (await heldCents(userId, acct));
}
export const spendableCents = availableCents;

/** The card's statement figures. Statements close at the end of each month and are due on the 28th. */
async function cardStatement(userId: string, today = todayISO()) {
  const cycleStart = today.slice(0, 8) + "01";
  const r = (await one<{ closed: number; paid: number }>(
    `SELECT COALESCE(SUM(CASE WHEN date < ? AND available_on <= ? THEN amount_cents END), 0) AS closed,
            COALESCE(SUM(CASE WHEN date >= ? AND amount_cents > 0 THEN amount_cents END), 0) AS paid
       FROM ledger WHERE user_id = ? AND acct = 'cc'`,
    cycleStart, today, cycleStart, userId,
  ))!;
  const statement = Math.max(0, -r.closed - r.paid);
  const minDue = statement === 0 ? 0 : Math.min(statement, Math.max(2500, Math.round(statement * 0.02)));
  return { statementBalance: statement / 100, minDue: minDue / 100, dueDate: nextDayOfMonth(28) };
}

// ---------- Validation ----------
const MAX_CENTS = 100_000_000; // $1,000,000

function amountCents(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isFinite(n) || n <= 0) throw new BankError("Enter an amount greater than $0.", 400, "amount");
  const c = Math.round(n * 100);
  if (Math.abs(n * 100 - c) > 1e-6) throw new BankError("Amounts can have at most two decimal places.", 400, "amount");
  if (c > MAX_CENTS) throw new BankError("That's over the $1,000,000 limit for one payment.", 400, "amount");
  return c;
}

function dateOf(v: unknown): string {
  const today = todayISO();
  if (v === undefined || v === null || v === "") return today;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new BankError("Pick a valid date.", 400, "date");
  if (v < today) throw new BankError("Pick today or a future date.", 400, "date");
  if (v > addDays(today, 365)) throw new BankError("Payments can be scheduled up to a year ahead.", 400, "date");
  return v;
}

function repeatOf(v: unknown): Repeat {
  if (v === undefined || v === null || v === "") return "once";
  if (v === "once" || v === "weekly" || v === "monthly") return v;
  throw new BankError("Choose how often it repeats.", 400, "repeat");
}

function fromOf(v: unknown): "chk" | "sav" {
  if (v === "chk" || v === "sav") return v;
  throw new BankError("Choose checking or savings to pay from.", 400, "from");
}

// ---------- Moving money ----------
type Movement = { type: Scheduled["type"]; from: "chk" | "sav"; to: string; amountCents: number; date: string; memo: string; goalId?: string };

/** Posts one payment or transfer after checking funds and limits. Throws BankError if it can't go through. */
async function move(userId: string, settings: Settings, m: Movement, by: string) {
  const from = await accountRow(userId, m.from);
  const avail = await availableCents(userId, m.from);
  if (m.amountCents > avail) throw new BankError(`That's more than the ${fmt(avail / 100)} available in ${from.name}.`, 400, "amount");
  const fromLabel = `${from.name} ${mask(from.last4)}`;

  if (m.type === "transfer") {
    if (m.to === m.from) throw new BankError("Choose a different account to send to.", 400, "to");
    const to = await accountRow(userId, m.to);
    if (to.kind === "credit") {
      const owed = -(await totals(userId, "cc")).total;
      if (owed <= 0) throw new BankError("There's nothing to pay on your card right now.", 400, "amount");
      if (m.amountCents > owed) throw new BankError(`That's more than the ${fmt(owed / 100)} you owe on your card.`, 400, "amount");
    }
    const ref = randomUUID();
    const card = to.kind === "credit";
    await post(userId, { acct: from.id, date: m.date, availableOn: m.date, amountCents: -m.amountCents, payee: card ? to.name : `Transfer to ${to.name} ${mask(to.last4)}`, cat: "Transfers", memo: m.memo || (card ? "Credit card payment" : "Online transfer"), kind: "transfer", ref }, by);
    await post(userId, { acct: to.id, date: m.date, availableOn: m.date, amountCents: m.amountCents, payee: card ? "Payment — thank you" : `Transfer from ${fromLabel}`, cat: "Transfers", memo: m.memo || (card ? `From ${fromLabel}` : "Online transfer"), kind: "transfer", ref, goalId: m.goalId }, by);
    return;
  }
  if (m.type === "ach") {
    const e = settings.external.find((x) => x.id === m.to);
    if (!e) throw new BankError("Add that account before sending money to it.", 400, "to");
    if (m.amountCents > ACH_DAILY_LIMIT * 100) throw new BankError(`Transfers to other banks are limited to ${fmt(ACH_DAILY_LIMIT)} per day.`, 400, "amount");
    await post(userId, { acct: from.id, date: m.date, availableOn: addBusinessDays(m.date, 3), amountCents: -m.amountCents, payee: `${e.bank} ${mask(e.last4)}`, cat: "Transfers", memo: `ACH transfer${m.memo ? " · " + m.memo : ""}`, kind: "ach" }, by);
    return;
  }
  const b = settings.billers.find((x) => x.id === m.to);
  if (!b) throw new BankError("Add that payee before paying them.", 400, "to");
  await post(userId, { acct: from.id, date: m.date, availableOn: m.date, amountCents: -m.amountCents, payee: b.name, cat: b.cat || "Bills", memo: `Bill Pay · ${m.memo || "acct " + mask(b.last4)}`, kind: "bill" }, by);
}

const nextDate = (date: string, repeat: Repeat) => (repeat === "weekly" ? addDays(date, 7) : repeat === "monthly" ? addMonths(date, 1) : null);

interface ScheduledRow { id: string; type: Scheduled["type"]; from_acct: "chk" | "sav"; to_ref: string; amount_cents: number; date: string; repeat: Repeat; memo: string }

/** Runs scheduled payments whose date has come. One that can't go through (say, not enough money) is skipped and logged. */
async function runDue(userId: string, settings: Settings) {
  const today = todayISO();
  if (!(await one("SELECT 1 FROM scheduled_payments WHERE user_id = ? AND date <= ? LIMIT 1", userId, today))) return;
  await tx(async () => {
    for (let guard = 0; guard < 400; guard++) {
      const row = await one<ScheduledRow>("SELECT * FROM scheduled_payments WHERE user_id = ? AND date <= ? ORDER BY date, created_at LIMIT 1", userId, today);
      if (!row) break;
      try {
        await move(userId, settings, { type: row.type, from: row.from_acct, to: row.to_ref, amountCents: row.amount_cents, date: row.date, memo: row.memo }, "schedule");
      } catch (e) {
        if (!(e instanceof BankError)) throw e;
        await run("INSERT INTO audit_log (at, actor_id, actor_email, action, target_id, target_email, detail) VALUES (?, NULL, NULL, 'scheduled_payment_failed', ?, NULL, ?)",
          new Date().toISOString(), userId, `${fmt(row.amount_cents / 100)} on ${row.date}: ${e.message}`);
      }
      const nd = nextDate(row.date, row.repeat);
      if (nd) await run("UPDATE scheduled_payments SET date = ? WHERE id = ?", nd, row.id);
      else await run("DELETE FROM scheduled_payments WHERE id = ?", row.id);
    }
  }, userId);
}

// ---------- The customer's full state ----------
/** Everything the app shows: settings plus accounts, transactions and schedule built from the ledger. */
export async function loadState(user: Owner): Promise<BankState> {
  await ensureOpen(user);
  const today = todayISO();
  const due = await one("SELECT 1 FROM scheduled_payments WHERE user_id = ? AND date <= ? LIMIT 1", user.id, today);
  if (due) await runDue(user.id, (await readSettings(user.id))!);
  // Everything below is independent, so it's read in parallel (one round trip to the database).
  const [settings, acctRows, rows, posted, holds, card, schedRows] = await Promise.all([
    readSettings(user.id),
    accountRows(user.id),
    ledgerRows(user.id),
    all<{ acct: AccountId; posted: number }>("SELECT acct, COALESCE(SUM(CASE WHEN available_on <= ? THEN amount_cents END), 0) AS posted FROM ledger WHERE user_id = ? GROUP BY acct", today, user.id),
    all<{ from_acct: AccountId; n: number }>("SELECT from_acct, SUM(amount_cents) AS n FROM crypto_withdrawals WHERE user_id = ? AND status = 'pending' GROUP BY from_acct", user.id),
    cardStatement(user.id, today),
    all<ScheduledRow>("SELECT * FROM scheduled_payments WHERE user_id = ? ORDER BY date", user.id),
  ]);
  const savedByGoal: Record<string, number> = {};
  for (const r of rows) if (r.goal_id && r.amount_cents > 0) savedByGoal[r.goal_id] = (savedByGoal[r.goal_id] ?? 0) + r.amount_cents;

  const accounts: Account[] = acctRows.map((a) => {
    const bal = posted.find((p) => p.acct === a.id)?.posted ?? 0;
    const held = a.kind === "credit" ? 0 : holds.find((h) => h.from_acct === a.id)?.n ?? 0;
    const base: Account = { id: a.id, name: a.name, kind: a.kind, last4: a.last4, balance: bal / 100, ...(held ? { held: held / 100 } : {}) };
    if (a.kind === "savings") return { ...base, apy: a.apy ?? undefined };
    if (a.kind === "credit") return { ...base, limit: a.credit_limit_cents / 100, ...card };
    return base;
  });

  const sent: P2P[] = rows.filter((r) => r.kind === "p2p").map((r) => ({
    id: "p" + r.seq, name: r.payee, handle: r.handle ?? "", amount: Math.abs(r.amount_cents) / 100, date: r.date, memo: r.memo, direction: r.amount_cents < 0 ? "sent" : "received",
  }));
  const scheduled = schedRows.map((s): Scheduled => ({
    id: s.id, type: s.type, from: s.from_acct, to: s.to_ref, amount: s.amount_cents / 100, date: s.date, repeat: s.repeat, memo: s.memo,
  }));

  return {
    version: 2,
    ...settings!,
    routing: ROUTING_NUMBER,
    accounts,
    tx: rows.map((r) => toTx(r, today)),
    p2p: [...sent, ...settings!.p2p].sort((a, b) => b.date.localeCompare(a.date)),
    scheduled,
    goals: settings!.goals.map((g) => ({ ...g, saved: (savedByGoal[g.id] ?? 0) / 100 })),
  };
}

export async function updateSettings(user: Owner, input: Record<string, unknown>) {
  const bad = SERVER_OWNED.filter((k) => k in input);
  if (bad.length) throw new BankError("Balances, transactions and scheduled payments can only change through payments and transfers.", 400);
  await ensureOpen(user);
  await tx(async () => writeSettings(user.id, cleanSettings(input, (await readSettings(user.id))!)), user.id);
}

// ---------- Actions the customer can take ----------
/** Runs fn in one transaction holding this customer's lock, after any payments that are due have gone out. */
async function withSettings<T>(user: Owner, fn: (s: Settings) => Promise<T>): Promise<T> {
  await ensureOpen(user);
  return tx(async () => {
    await runDue(user.id, (await readSettings(user.id))!);
    return fn((await readSettings(user.id))!);
  }, user.id);
}

/** Internal transfer, card payment or transfer to another bank. Dated today it posts now; later dates are scheduled. */
export async function transfer(user: Owner, body: Record<string, unknown>) {
  const type = body.type === "ach" ? "ach" : "transfer";
  const m: Movement = { type, from: fromOf(body.from), to: str(body.to, 60), amountCents: amountCents(body.amount), date: dateOf(body.date), memo: str(body.memo, 140) };
  await schedule(user, m, repeatOf(body.repeat));
}

export async function payBill(user: Owner, body: Record<string, unknown>) {
  const m: Movement = { type: "bill", from: "chk", to: str(body.billerId, 60), amountCents: amountCents(body.amount), date: dateOf(body.date), memo: str(body.memo, 140) };
  await schedule(user, m, repeatOf(body.repeat));
}

async function schedule(user: Owner, m: Movement, repeat: Repeat) {
  let toName = "";
  let fromName = "";
  await withSettings(user, async (s) => {
    fromName = (await accountRow(user.id, m.from)).name;
    if (m.type === "ach") { const e = s.external.find((x) => x.id === m.to); toName = e ? `${e.bank} ${mask(e.last4)}` : ""; }
    else if (m.type === "bill") toName = s.billers.find((x) => x.id === m.to)?.name ?? "";
    else toName = (await accountRows(user.id)).find((x) => x.id === m.to)?.name ?? "";
    if (m.type !== "bill" && m.type !== "ach") await accountRow(user.id, m.to); // the destination must exist
    if (m.type === "ach" && !s.external.some((e) => e.id === m.to)) throw new BankError("Add that account before sending money to it.", 400, "to");
    if (m.type === "bill" && !s.billers.some((b) => b.id === m.to)) throw new BankError("Add that payee before paying them.", 400, "to");
    const today = todayISO();
    if (m.date === today) await move(user.id, s, m, "customer");
    const next = m.date === today ? nextDate(m.date, repeat) : m.date;
    if (next) {
      await run("INSERT INTO scheduled_payments (id, user_id, type, from_acct, to_ref, amount_cents, date, repeat, memo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        "sc_" + randomUUID(), user.id, m.type, m.from, m.to, m.amountCents, next, repeat, m.memo, new Date().toISOString());
    }
  });
  const now = m.date === todayISO();
  const amount = fmt(m.amountCents / 100);
  const what = m.type === "bill" ? "Bill payment" : m.type === "ach" ? "Transfer to another bank" : toName.includes("Visa") ? "Card payment" : "Transfer";
  const repeats = repeat === "once" ? "" : ` It repeats ${repeat}.`;
  await notifyCustomer(user.id, {
    title: now ? `${what} ${m.type === "ach" ? "on its way" : "sent"}` : `${what} scheduled`,
    body: now
      ? `${amount} to ${toName} from your ${fromName}.${m.type === "ach" ? " It usually arrives in 1–3 business days." : ""}${repeats}`
      : `${amount} to ${toName} will go out on ${m.date}.${repeats}`,
    url: m.type === "bill" ? "/bills" : "/transfer", tag: "payment",
    email: {
      details: [["Amount", amount], ["To", toName], ["From", fromName], ["Date", m.date], ...(repeat !== "once" ? [["Repeats", repeat] as [string, string]] : []), ...(m.memo ? [["Memo", m.memo.slice(0, 60)] as [string, string]] : []), ["Status", now ? (m.type === "ach" ? "Processing" : "Sent") : "Scheduled"]],
      button: { label: m.type === "bill" ? "View bill pay" : "View activity", href: m.type === "bill" ? "/bills" : "/activity" },
    },
  });
}

export async function cancelScheduled(user: Owner, id: string) {
  const changed = await run("DELETE FROM scheduled_payments WHERE id = ? AND user_id = ?", id, user.id);
  if (changed === 0) throw new BankError("That payment has already gone out or was canceled.", 404);
}

const sumToday = async (userId: string, kind: TxKind, sign: 1 | -1) =>
  (await one<{ n: number }>(`SELECT COALESCE(SUM(ABS(amount_cents)), 0) AS n FROM ledger WHERE user_id = ? AND kind = ? AND date = ? AND amount_cents ${sign > 0 ? ">" : "<"} 0`,
    userId, kind, todayISO()))!.n;

/** Sends money to a person from checking. */
export async function sendMoney(user: Owner, body: Record<string, unknown>) {
  const name = str(body.name, 80);
  const raw = str(body.handle, 120);
  const kind = handleKind(raw);
  if (name.length < 1) throw new BankError("Add the person's name.", 400, "name");
  if (!kind) throw new BankError("Enter an email address or a 10-digit U.S. mobile number.", 400, "handle");
  const handle = kind === "phone" ? formatPhone(raw) : raw;
  const cents = amountCents(body.amount);
  const memo = str(body.memo, 140);
  await withSettings(user, async (s) => {
    const left = P2P_DAILY_LIMIT * 100 - (await sumToday(user.id, "p2p", -1));
    if (cents > left) throw new BankError(`You can send ${fmt(Math.max(0, left) / 100)} more today. The daily limit is ${fmt(P2P_DAILY_LIMIT)}.`, 400, "amount");
    const avail = await availableCents(user.id, "chk");
    if (cents > avail) throw new BankError(`That's more than the ${fmt(avail / 100)} available in checking.`, 400, "amount");
    const today = todayISO();
    await post(user.id, { acct: "chk", date: today, availableOn: today, amountCents: -cents, payee: name, cat: "Transfers", memo: memo || "Sent with Anchor Pay", kind: "p2p", handle }, "customer");
    if (!s.contacts.some((c) => c.handle.toLowerCase() === handle.toLowerCase())) {
      await writeSettings(user.id, { ...s, contacts: [...s.contacts, { id: "c_" + randomUUID().slice(0, 8), name, handle }] });
    }
  });
  await notifyCustomer(user.id, {
    title: "Money sent", body: `You sent ${fmt(cents / 100)} to ${name} (${handle}) from your checking.`, url: "/send", tag: "payment",
    email: {
      details: [["Amount", fmt(cents / 100)], ["To", name], ["Sent to", handle], ["From", "Checking"], ...(memo ? [["Note", memo.slice(0, 60)] as [string, string]] : []), ["Status", "Sent"]],
      button: { label: "View activity", href: "/activity" },
      note: "If you didn't send this, contact us right away.",
    },
  });
}

/** Moves money from checking to savings and counts it toward a goal. */
export async function contributeToGoal(user: Owner, body: Record<string, unknown>) {
  const goalId = str(body.goalId, 60);
  const cents = amountCents(body.amount);
  let goalName = "";
  await withSettings(user, async (s) => {
    const g = s.goals.find((x) => x.id === goalId);
    if (!g) throw new BankError("That goal doesn't exist.", 404);
    goalName = g.name;
    await move(user.id, s, { type: "transfer", from: "chk", to: "sav", amountCents: cents, date: todayISO(), memo: `Goal: ${g.name}`, goalId }, "customer");
  });
  await notifyCustomer(user.id, {
    title: "Added to your savings goal", body: `${fmt(cents / 100)} moved from checking to savings for "${goalName}".`, url: "/goals", tag: "payment",
    email: { details: [["Amount", fmt(cents / 100)], ["Goal", goalName], ["From", "Checking"], ["To", "High-Yield Savings"]], button: { label: "See your goals", href: "/goals" } },
  });
}

// ---------- For staff ----------
export interface BankSummary { cash: number; owed: number; txCount: number; lastActivity: string | null; updatedAt: string | null }

export async function summary(userId: string): Promise<BankSummary> {
  const today = todayISO();
  const r = (await one<{ cash: number; cc: number; n: number; last: string | null; updated: string | null }>(
    `SELECT COALESCE(SUM(CASE WHEN acct != 'cc' AND available_on <= ? THEN amount_cents END), 0) AS cash,
            COALESCE(SUM(CASE WHEN acct = 'cc' AND available_on <= ? THEN amount_cents END), 0) AS cc,
            COUNT(*) AS n, MAX(date) AS last, MAX(created_at) AS updated
       FROM ledger WHERE user_id = ?`,
    today, today, userId,
  ))!;
  return { cash: r.cash / 100, owed: Math.max(0, -r.cc) / 100, txCount: r.n, lastActivity: r.last, updatedAt: r.updated };
}

/** Accounts with posted balances, without running scheduled payments. */
export async function staffAccounts(userId: string): Promise<Account[]> {
  const today = todayISO();
  const out: Account[] = [];
  for (const a of await accountRows(userId)) {
    out.push({
      id: a.id, name: a.name, kind: a.kind, last4: a.last4, balance: (await totals(userId, a.id, today)).posted / 100,
      ...(a.kind !== "credit" && (await heldCents(userId, a.id)) ? { held: (await heldCents(userId, a.id)) / 100 } : {}),
      ...(a.kind === "credit" ? { limit: a.credit_limit_cents / 100 } : {}),
    });
  }
  return out;
}

export async function staffRecentTx(userId: string, limit = 12): Promise<Tx[]> {
  const today = todayISO();
  return (await all<LedgerRow>("SELECT seq, acct, date, available_on, amount_cents, payee, cat, memo, kind, handle, goal_id FROM ledger WHERE user_id = ? ORDER BY date DESC, seq DESC LIMIT ?", userId, limit))
    .map((r) => toTx(r, today));
}

export const ledgerCount = async () => (await one<{ n: number }>("SELECT COUNT(*) AS n FROM ledger"))!.n;

/** Brings every account to $0 with adjustment entries, cancels scheduled payments and resets settings. */
export async function resetToZero(userId: string, staffName: string) {
  await tx(async () => {
    const today = todayISO();
    const adjust = async (acct: AccountId, availableOn: string, cents: number) => {
      if (cents !== 0) await post(userId, { acct, date: today, availableOn, amountCents: -cents, payee: "Account adjustment", cat: "Adjustments", memo: "Balance reset by Anchor Bank", kind: "adjustment" }, "staff:" + staffName);
    };
    for (const a of await accountRows(userId)) {
      await adjust(a.id, today, (await totals(userId, a.id, today)).posted);
      // Held entries are offset on the day they would clear, so the balance stays at $0 throughout.
      const held = await all<{ available_on: string; n: number }>("SELECT available_on, SUM(amount_cents) AS n FROM ledger WHERE user_id = ? AND acct = ? AND available_on > ? GROUP BY available_on", userId, a.id, today);
      for (const h of held) await adjust(a.id, h.available_on, h.n);
    }
    await run("DELETE FROM scheduled_payments WHERE user_id = ?", userId);
    await run("DELETE FROM bank_state WHERE user_id = ?", userId);
  }, userId);
}
