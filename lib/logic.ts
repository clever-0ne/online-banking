// Pure banking logic for the browser: balances, checks, summaries and changes to settings.
// Money itself only moves on the server (lib/server/bank.ts).
import {
  daysAgo, daysUntil, fmt, mask, monthKey, round2, shortDate, todayISO, uid,
} from "./format";
import type { Account, AccountId, BankState, Card, Scheduled, Tx } from "./types";

export const CATEGORY_EXCLUDED_FROM_SPENDING = ["Transfers", "Income"];
export const P2P_DAILY_LIMIT = 2500;
export const ACH_DAILY_LIMIT = 10000;

// ---------- Lookups ----------
export const acct = (s: BankState, id: AccountId) => s.accounts.find((a) => a.id === id)!;

export const SCORE_BANDS: [number, number, string][] = [
  [300, 579, "Poor"],
  [580, 669, "Fair"],
  [670, 739, "Good"],
  [740, 799, "Very good"],
  [800, 850, "Exceptional"],
];
export const bandOf = (score: number) => SCORE_BANDS.find(([lo, hi]) => score >= lo && score <= hi)?.[2] ?? "";
export const sortedTx = (tx: Tx[]) => [...tx].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

/** Money you can use now: posted balance less pending debits. For credit, the unused part of the limit. */
export function available(s: BankState, id: AccountId): number {
  const a = acct(s, id);
  const pendingOut = s.tx.filter((t) => t.acct === id && t.status === "pending" && t.amount < 0).reduce((x, t) => x + t.amount, 0);
  if (a.kind === "credit") return round2((a.limit ?? 0) + a.balance + pendingOut);
  return round2(a.balance + pendingOut - (a.held ?? 0));
}

export function scheduledLabel(s: BankState, sc: Scheduled): string {
  if (sc.type === "bill") return s.billers.find((b) => b.id === sc.to)?.name ?? "Bill";
  if (sc.type === "ach") {
    const e = s.external.find((x) => x.id === sc.to);
    return e ? `${e.nickname} ${mask(e.last4)}` : "External account";
  }
  const a = acct(s, sc.to as AccountId);
  return `${a.name} ${mask(a.last4)}`;
}

// ---------- Checks ----------
/** ABA routing number checksum: 3·(d1+d4+d7) + 7·(d2+d5+d8) + (d3+d6+d9) ≡ 0 (mod 10). */
export function routingValid(r: string): boolean {
  if (!/^\d{9}$/.test(r)) return false;
  const d = r.split("").map(Number);
  return (3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])) % 10 === 0;
}

export function handleKind(h: string): "email" | "phone" | null {
  const v = h.trim();
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) return "email";
  const digits = v.replace(/\D/g, "");
  if (digits.length === 10 || (digits.length === 11 && digits.startsWith("1"))) return "phone";
  return null;
}

export function formatPhone(h: string): string {
  const d = h.replace(/\D/g, "").slice(-10);
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function sentToday(s: BankState): number {
  const t = todayISO();
  return s.p2p.filter((p) => p.direction === "sent" && p.date === t).reduce((x, p) => x + p.amount, 0);
}

// ---------- Charts and summaries ----------
/** End-of-day posted balance, oldest first, walking back from today's posted balance. */
export function balanceSeries(s: BankState, id: AccountId, days = 30) {
  const byDay: Record<string, number> = {};
  for (const t of s.tx) if (t.acct === id && t.status === "posted") byDay[t.date] = (byDay[t.date] || 0) + t.amount;
  const pts: { date: string; bal: number }[] = [];
  let bal = acct(s, id).balance;
  for (let d = 0; d <= days; d++) {
    const k = daysAgo(d);
    pts.unshift({ date: k, bal: round2(bal) });
    bal -= byDay[k] || 0;
  }
  return pts;
}

/** Spending per category in a calendar month (YYYY-MM), largest first. */
export function spendingInMonth(s: BankState, month = monthKey(todayISO())): [string, number][] {
  const m: Record<string, number> = {};
  for (const t of s.tx) {
    if (t.amount < 0 && monthKey(t.date) === month && !CATEGORY_EXCLUDED_FROM_SPENDING.includes(t.cat)) {
      m[t.cat] = round2((m[t.cat] || 0) - t.amount);
    }
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

export interface Statement {
  month: string;
  opening: number;
  closing: number;
  credits: number;
  debits: number;
  tx: Tx[];
}

/** Monthly statements for an account, newest first. The current month is left out until it closes. */
export function statements(s: BankState, id: AccountId): Statement[] {
  const posted = s.tx.filter((t) => t.acct === id && t.status === "posted");
  const months = [...new Set(posted.map((t) => monthKey(t.date)))].sort().reverse();
  const current = monthKey(todayISO());
  let closing = acct(s, id).balance;
  const out: Statement[] = [];
  for (const m of months) {
    const inMonth = posted.filter((t) => monthKey(t.date) === m);
    const net = inMonth.reduce((x, t) => x + t.amount, 0);
    const opening = round2(closing - net);
    if (m !== current) {
      out.push({
        month: m,
        opening,
        closing: round2(closing),
        credits: round2(inMonth.filter((t) => t.amount > 0).reduce((x, t) => x + t.amount, 0)),
        debits: round2(inMonth.filter((t) => t.amount < 0).reduce((x, t) => x - t.amount, 0)),
        tx: sortedTx(inMonth).reverse(),
      });
    }
    closing = opening;
  }
  // The first month of history is partial, so it isn't a full statement.
  return out.slice(0, -1);
}

export interface AlertItem {
  id: string;
  date: string;
  tone: "info" | "warn" | "good";
  title: string;
  body: string;
}

/** Alerts the customer's settings would have sent recently, newest first. */
export function alertFeed(s: BankState): AlertItem[] {
  const p = s.alerts;
  const since = daysAgo(14);
  const out: AlertItem[] = [];
  const chkAvail = available(s, "chk");
  // Only once money has moved through checking, so a newly opened account isn't flagged.
  if (p.lowBalance.on && s.tx.some((t) => t.acct === "chk") && chkAvail < p.lowBalance.threshold) {
    out.push({ id: "low", date: todayISO(), tone: "warn", title: "Low balance", body: `Checking ••${acct(s, "chk").last4} available balance is ${fmt(chkAvail)}, below your ${fmt(p.lowBalance.threshold)} alert.` });
  }
  if (p.billDue.on) {
    for (const sc of s.scheduled) {
      const days = daysUntil(sc.date);
      if (sc.type === "bill" && days >= 0 && days <= 5) {
        out.push({ id: "due-" + sc.id, date: todayISO(), tone: "info", title: "Bill payment coming up", body: `${fmt(sc.amount)} to ${scheduledLabel(s, sc)} on ${sc.date === todayISO() ? "today" : shortDate(sc.date)}.` });
      }
    }
    const cc = acct(s, "cc");
    if (cc.dueDate && (cc.minDue ?? 0) > 0 && daysUntil(cc.dueDate) <= 7) {
      out.push({ id: "ccdue", date: todayISO(), tone: "warn", title: "Credit card payment due", body: `Minimum ${fmt(cc.minDue!)} due on ${shortDate(cc.dueDate)}.` });
    }
  }
  for (const t of sortedTx(s.tx)) {
    if (t.date < since) break;
    if (p.largePurchase.on && t.kind === "card" && -t.amount >= p.largePurchase.threshold) {
      out.push({ id: "lp-" + t.id, date: t.date, tone: "info", title: "Large purchase", body: `${fmt(-t.amount)} at ${t.payee} on ${t.memo}.` });
    }
    if (p.deposit.on && t.acct === "chk" && t.amount > 0 && (t.kind === "ach" || t.kind === "deposit")) {
      out.push({ id: "dep-" + t.id, date: t.date, tone: "good", title: t.status === "pending" ? "Deposit received, on hold" : "Deposit posted", body: `${fmt(t.amount)} from ${t.payee}.` });
    }
    if (p.p2p.on && t.kind === "p2p") {
      out.push({ id: "p2p-" + t.id, date: t.date, tone: t.amount > 0 ? "good" : "info", title: t.amount > 0 ? "Money received" : "Money sent", body: `${fmt(Math.abs(t.amount))} ${t.amount > 0 ? "from" : "to"} ${t.payee}.` });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

// Money only moves on the server (lib/server/bank.ts). These change settings the customer owns.
export function addExternal(s: BankState, e: { nickname: string; bank: string; routing: string; account: string; type: "checking" | "savings" }): BankState {
  return { ...s, external: [...s.external, { id: uid("ext"), nickname: e.nickname, bank: e.bank, routing: e.routing, last4: e.account.slice(-4), type: e.type }] };
}

export function addBiller(s: BankState, b: { name: string; cat: string; account: string }): BankState {
  return { ...s, billers: [...s.billers, { id: uid("b"), name: b.name, cat: b.cat, last4: b.account.slice(-4), autopay: false }] };
}

export const toggleAutopay = (s: BankState, id: string): BankState => ({
  ...s,
  billers: s.billers.map((b) => (b.id === id ? { ...b, autopay: !b.autopay } : b)),
});

function rememberContact(s: BankState, name: string, handle: string): BankState {
  const exists = s.contacts.some((c) => c.handle.toLowerCase() === handle.toLowerCase());
  return exists ? s : { ...s, contacts: [...s.contacts, { id: uid("c"), name, handle }] };
}

export function requestMoney(s: BankState, p: { name: string; handle: string; amount: number; memo: string }): BankState {
  const next = { ...s, p2p: [{ id: uid("p"), name: p.name, handle: p.handle, amount: p.amount, date: todayISO(), memo: p.memo, direction: "requested" as const }, ...s.p2p] };
  return rememberContact(next, p.name, p.handle);
}

export const updateCard = (s: BankState, id: Card["id"], patch: Partial<Card>): BankState => ({
  ...s,
  cards: s.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)),
});

export function replaceCard(s: BankState, id: Card["id"]): BankState {
  const last4 = String(1000 + Math.floor(Math.random() * 9000));
  const t = new Date();
  const exp = `${String(t.getMonth() + 1).padStart(2, "0")}/${String((t.getFullYear() + 4) % 100).padStart(2, "0")}`;
  return updateCard(s, id, { last4, exp, locked: false, replacementOrdered: todayISO() });
}

export const addTravel = (s: BankState, destination: string, from: string, to: string): BankState => ({
  ...s,
  travel: [...s.travel, { id: uid("t"), destination, from, to }].sort((a, b) => a.from.localeCompare(b.from)),
});
export const removeTravel = (s: BankState, id: string): BankState => ({ ...s, travel: s.travel.filter((t) => t.id !== id) });

export const addGoal = (s: BankState, g: { name: string; target: number; by?: string }): BankState => ({
  ...s,
  goals: [...s.goals, { id: uid("g"), name: g.name, target: g.target, saved: 0, by: g.by || undefined }],
});

export const removeGoal = (s: BankState, id: string): BankState => ({ ...s, goals: s.goals.filter((g) => g.id !== id) });

export const setBudget = (s: BankState, cat: string, amount: number): BankState => ({ ...s, budgets: { ...s.budgets, [cat]: amount } });

export const accountLabel = (a: Account) => `${a.name} ${mask(a.last4)}`;

// ---------- Card details (derived from the card's last four digits) ----------
export function cardNumber(c: Card): string {
  const prefix = c.id === "debit" ? "4000 0027 6315" : "4000 0058 1940";
  return `${prefix} ${c.last4}`;
}

export function cardCvv(c: Card): string {
  return String((Number(c.last4) * 7 + (c.id === "debit" ? 113 : 409)) % 1000).padStart(3, "0");
}
