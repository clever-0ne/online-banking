// Every customer page that staff can switch on or off per customer. Shared by the server (access checks),
// the customer menu and the staff console. A page's slug is its first path segment.

export const PAGES = [
  { slug: "dashboard", label: "Dashboard", group: "Accounts", locked: true }, // always on: it's where sign-in lands
  { slug: "activity", label: "Activity", group: "Accounts" },
  { slug: "statements", label: "Statements", group: "Accounts" },
  { slug: "transfer", label: "Transfer", group: "Pay & transfer" },
  { slug: "send", label: "Send money", group: "Pay & transfer" },
  { slug: "bills", label: "Bill pay", group: "Pay & transfer" },
  { slug: "deposit", label: "Deposit", group: "Pay & transfer" },
  { slug: "withdraw", label: "Withdraw", group: "Pay & transfer" },
  { slug: "explore", label: "Explore", group: "Plan & track" },
  { slug: "budget", label: "Budget", group: "Plan & track" },
  { slug: "goals", label: "Savings goals", group: "Plan & track" },
  { slug: "credit", label: "Credit score", group: "Plan & track" },
  { slug: "cards", label: "Cards", group: "Manage" },
  { slug: "alerts", label: "Alerts", group: "Manage" },
  { slug: "profile", label: "Profile", group: "Manage" },
] as const satisfies readonly { slug: string; label: string; group: string; locked?: boolean }[];

export type PageSlug = (typeof PAGES)[number]["slug"];

const SLUGS = new Set<string>(PAGES.map((p) => p.slug));
export const isPageSlug = (s: string): s is PageSlug => SLUGS.has(s);
export const isLocked = (s: PageSlug) => PAGES.some((p) => p.slug === s && "locked" in p && p.locked);

/** The page a path belongs to ("/transfer/abc" → "transfer"), or null if it isn't a customer page. */
export function pageOf(pathname: string): PageSlug | null {
  const first = pathname.split("/")[1] ?? "";
  return isPageSlug(first) ? first : null;
}

/** Where the customer is sent when they open a page they can't use. */
export const DENIED_PATH = "/access-denied";
