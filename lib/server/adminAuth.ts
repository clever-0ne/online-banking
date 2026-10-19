// Admin sign-in, separate from customer accounts. The single admin credential comes from the
// environment (ADMIN_PASSWORD); staff sign in with the password alone. There is no admin sign-up.
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sign } from "./session";

export const ADMIN_COOKIE = "kb_admin";
const TTL_MS = 8 * 60 * 60 * 1000; // admin sessions last 8 hours

/** The hidden admin URL prefix, e.g. "/ops-3f9a1c7e2b4d". Null when not configured. */
export function adminPath(): string | null {
  const p = (process.env.ADMIN_PATH ?? "").trim().replace(/\/+$/, "");
  if (!p || p === "/admin" || !/^\/[A-Za-z0-9_-]{6,}$/.test(p)) return null;
  return p;
}

const password = () => process.env.ADMIN_PASSWORD ?? "";

/** Changes whenever the admin password changes, so old admin sessions stop working. */
const fingerprint = () => createHash("sha256").update("anchor-admin:" + password()).digest("base64url").slice(0, 16);

const sha = (s: string) => createHash("sha256").update(s).digest();
const same = (a: string, b: string) => timingSafeEqual(sha(a), sha(b));

export function adminConfigured(): boolean {
  return password().length > 0 && adminPath() !== null;
}

export function checkAdminPassword(pass: string): boolean {
  return adminConfigured() && same(pass, password());
}

export function adminToken(): string {
  const body = Buffer.from(JSON.stringify({ adm: 1, f: fingerprint(), exp: Date.now() + TTL_MS })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token || !adminConfigured()) return false;
  const [body, mac] = token.split(".");
  if (!body || !mac) return false;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { adm?: number; f?: string; exp?: number };
    return p.adm === 1 && p.f === fingerprint() && typeof p.exp === "number" && p.exp > Date.now();
  } catch {
    return false;
  }
}

export async function isAdmin(): Promise<boolean> {
  return verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

/** How staff appear in the activity log. */
export const adminName = () => "admin";

/** For admin API routes: null when signed in as admin, otherwise a 404 that doesn't reveal the API exists. */
export async function adminGuard(): Promise<NextResponse | null> {
  return (await isAdmin()) ? null : NextResponse.json({ error: "Not found." }, { status: 404 });
}

export function setAdminCookie(res: NextResponse) {
  res.cookies.set(ADMIN_COOKIE, adminToken(), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
  return res;
}

export function clearAdminCookie(res: NextResponse) {
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  return res;
}
