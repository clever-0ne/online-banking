// Helpers shared by the auth route handlers.
import { NextResponse, type NextRequest } from "next/server";
import { createToken, SESSION_COOKIE } from "./session";

const DAY = 24 * 60 * 60 * 1000;

/** Rejects cross-site form posts: the Origin header must match this site. */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export function error(message: string, status: number, field?: string) {
  return NextResponse.json({ error: message, field }, { status });
}

/** Sets the session cookie. "Remember me" keeps it for 30 days; otherwise 12 hours and gone when the browser closes. */
export function withSession(res: NextResponse, user: { id: string; sessionVersion: number }, remember: boolean) {
  const ttl = remember ? 30 * DAY : DAY / 2;
  res.cookies.set(SESSION_COOKIE, createToken(user.id, user.sessionVersion, ttl), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: ttl / 1000 } : {}),
  });
  return res;
}

export function clearSession(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

// ---------- Login throttling (per email and per IP, in memory) ----------
const attempts = new Map<string, { fails: number; until: number }>();
const MAX_FAILS = 5;
const LOCK_MS = 60_000;

export function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

/** Seconds left on a lockout for any of the keys, or 0. */
export function lockedFor(keys: string[]): number {
  const now = Date.now();
  return Math.max(0, ...keys.map((k) => Math.ceil(((attempts.get(k)?.until ?? 0) - now) / 1000)));
}

export function recordFailure(keys: string[]) {
  for (const k of keys) {
    const a = attempts.get(k) ?? { fails: 0, until: 0 };
    a.fails += 1;
    if (a.fails >= MAX_FAILS) { a.until = Date.now() + LOCK_MS; a.fails = 0; }
    attempts.set(k, a);
  }
}

export function clearFailures(keys: string[]) {
  for (const k of keys) attempts.delete(k);
}
