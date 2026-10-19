// Money, date and small string helpers. All dates are local YYYY-MM-DD strings.

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export const fmt = (n: number) => usd.format(n);
export const signed = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + usd.format(Math.abs(n));
export const round2 = (n: number) => Math.round(n * 100) / 100;

const pad = (n: number) => String(n).padStart(2, "0");
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (iso: string) => new Date(iso + "T12:00:00");

export function todayISO(): string {
  return toISO(new Date());
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return toISO(d);
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function addMonths(iso: string, n: number): string {
  const d = fromISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
}

export function addBusinessDays(iso: string, n: number): string {
  const d = fromISO(iso);
  while (n > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) n--;
  }
  return toISO(d);
}

/** Next date (today or later) that falls on the given day of the month. */
export function nextDayOfMonth(dom: number): string {
  const t = fromISO(todayISO());
  const d = new Date(t.getFullYear(), t.getMonth(), dom, 12);
  if (d < t) d.setMonth(d.getMonth() + 1);
  return toISO(d);
}

export const monthKey = (iso: string) => iso.slice(0, 7);
export const monthLabel = (key: string) =>
  fromISO(key + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" });

export const shortDate = (iso: string) => fromISO(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const longDate = (iso: string) =>
  fromISO(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

export function dayLabel(iso: string): string {
  if (iso === daysAgo(0)) return "Today";
  if (iso === daysAgo(1)) return "Yesterday";
  return fromISO(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function daysUntil(iso: string): number {
  return Math.round((fromISO(iso).getTime() - fromISO(todayISO()).getTime()) / 864e5);
}

export const initials = (s: string) =>
  s.split(/\s+/).filter((w) => /^[\p{L}\d]/u.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export const uid = (p = "id") => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const mask = (last4: string) => `••${last4}`;

/** Parses "1,234.5" style input into a number with at most two decimals, or NaN. */
export function parseAmount(raw: string): number {
  const s = raw.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Number(s);
}
