export type AccountId = "chk" | "sav" | "cc";

export interface Account {
  id: AccountId;
  name: string;
  kind: "checking" | "savings" | "credit";
  last4: string;
  /** Posted balance. For the credit card this is negative when money is owed. */
  balance: number;
  /** Held for withdrawals waiting for approval. Not spendable. */
  held?: number;
  apy?: number;
  limit?: number;
  statementBalance?: number;
  minDue?: number;
  dueDate?: string;
}

export type TxKind = "card" | "ach" | "p2p" | "bill" | "transfer" | "deposit" | "withdrawal" | "atm" | "interest" | "adjustment";

export interface Tx {
  id: string;
  date: string; // YYYY-MM-DD local
  acct: AccountId;
  payee: string;
  cat: string;
  amount: number;
  memo: string;
  kind: TxKind;
  status: "posted" | "pending";
}

export interface ExternalAccount {
  id: string;
  nickname: string;
  bank: string;
  routing: string;
  last4: string;
  type: "checking" | "savings";
}

export interface Contact {
  id: string;
  name: string;
  handle: string; // email or US phone
}

export interface P2P {
  id: string;
  name: string;
  handle: string;
  amount: number;
  date: string;
  memo: string;
  direction: "sent" | "received" | "requested";
}

export interface Biller {
  id: string;
  name: string;
  cat: string;
  last4: string;
  autopay: boolean;
}

export type Repeat = "once" | "weekly" | "monthly";

export interface Scheduled {
  id: string;
  type: "bill" | "transfer" | "ach";
  from: AccountId;
  /** AccountId for transfers, external account id for ACH, biller id for bills */
  to: string;
  amount: number;
  date: string;
  repeat: Repeat;
  memo: string;
}

export interface Card {
  id: "debit" | "credit";
  name: string;
  linked: AccountId;
  last4: string;
  exp: string;
  locked: boolean;
  online: boolean;
  abroad: boolean;
  contactless: boolean;
  atm?: number;
  spend: number;
  replacementOrdered?: string;
}

export interface TravelNotice {
  id: string;
  destination: string;
  from: string;
  to: string;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  saved: number;
  by?: string;
}

export interface AlertPrefs {
  lowBalance: { on: boolean; threshold: number };
  largePurchase: { on: boolean; threshold: number };
  deposit: { on: boolean };
  billDue: { on: boolean };
  p2p: { on: boolean };
  channels: { email: boolean; text: boolean; push: boolean };
}

export interface Device {
  id: string;
  name: string;
  where: string;
  lastActive: string; // ISO date
  current?: boolean;
}

export interface Profile {
  preferredName: string;
  dob: string; // YYYY-MM-DD
  address: { line1: string; line2: string; city: string; state: string; zip: string };
  photo?: string; // small data URL
  tier: string;
  security: { twoStep: boolean; method: "sms" | "app"; loginAlerts: boolean; passwordChanged: string };
  prefs: { paperless: boolean; marketing: boolean; language: "en" | "es" };
  devices: Device[];
}

export interface BankState {
  version: 2;
  customer: { name: string; since: number; email: string; phone: string };
  profile: Profile;
  routing: string;
  accounts: Account[];
  tx: Tx[];
  external: ExternalAccount[];
  contacts: Contact[];
  p2p: P2P[];
  billers: Biller[];
  scheduled: Scheduled[];
  cards: Card[];
  travel: TravelNotice[];
  goals: Goal[];
  alerts: AlertPrefs;
  budgets: Record<string, number>;
  /** null until the customer's credit file is available. */
  credit: { score: number | null; history: { month: string; score: number }[] };
}
