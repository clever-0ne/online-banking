// The starting state for a newly opened account: every balance is $0 and there is no
// activity, payees, contacts or goals until the customer adds them.
import { addMonths, nextDayOfMonth, todayISO } from "./format";
import type { BankState, Profile } from "./types";

export const ROUTING_NUMBER = "311094226";

/** Random digits for new account and card numbers. */
function digits(n: number): string {
  const a = new Uint32Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => String(x % 10)).join("");
}

export function defaultProfile(preferredName = ""): Profile {
  return {
    preferredName,
    dob: "",
    address: { line1: "", line2: "", city: "", state: "", zip: "" },
    tier: "Everyday",
    security: { twoStep: false, method: "sms", loginAlerts: true, passwordChanged: todayISO() },
    prefs: { paperless: true, marketing: false, language: "en" },
    devices: [{ id: "this", name: "This browser", where: "", lastActive: todayISO(), current: true }],
  };
}

export function newAccount(user: { name: string; email: string; phone: string; createdAt: string }): BankState {
  const exp = addMonths(todayISO(), 48);
  const expiry = `${exp.slice(5, 7)}/${exp.slice(2, 4)}`;
  const chk = digits(4), sav = digits(4), cc = digits(4);

  return {
    version: 2,
    customer: { name: user.name, since: new Date(user.createdAt).getFullYear(), email: user.email, phone: user.phone },
    profile: defaultProfile(user.name.split(" ")[0]),
    routing: ROUTING_NUMBER,
    accounts: [
      { id: "chk", name: "Anchor Checking", kind: "checking", last4: chk, balance: 0 },
      { id: "sav", name: "High-Yield Savings", kind: "savings", last4: sav, balance: 0, apy: 3.75 },
      { id: "cc", name: "Anchor Cash Back Visa", kind: "credit", last4: cc, balance: 0, limit: 1000, statementBalance: 0, minDue: 0, dueDate: nextDayOfMonth(28) },
    ],
    tx: [],
    external: [],
    contacts: [],
    p2p: [],
    billers: [],
    scheduled: [],
    cards: [
      { id: "debit", name: "Anchor Debit Card", linked: "chk", last4: digits(4), exp: expiry, locked: false, online: true, abroad: false, contactless: true, atm: 500, spend: 3000 },
      { id: "credit", name: "Anchor Cash Back Visa", linked: "cc", last4: cc, exp: expiry, locked: false, online: true, abroad: false, contactless: true, spend: 1000 },
    ],
    travel: [],
    goals: [],
    alerts: {
      lowBalance: { on: true, threshold: 100 },
      largePurchase: { on: true, threshold: 100 },
      deposit: { on: true },
      billDue: { on: true },
      p2p: { on: true },
      channels: { email: true, text: true, push: false },
    },
    budgets: {},
    credit: { score: null, history: [] },
  };
}
