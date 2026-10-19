// Signed session tokens. Used by proxy.ts, route handlers and the protected layout (Node.js runtime only).
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const SESSION_COOKIE = "kb_session";
export const DATA_DIR = path.join(process.cwd(), ".data");

let cachedSecret: string | null = null;

/** HMAC key: AUTH_SECRET if set, otherwise a random key created once and kept in .data/secret. */
export function getSecret(): string {
  if (cachedSecret) return cachedSecret;
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32) return (cachedSecret = process.env.AUTH_SECRET);
  const file = path.join(DATA_DIR, "secret");
  if (!existsSync(file)) {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(file, randomBytes(48).toString("hex"), { mode: 0o600 });
  }
  return (cachedSecret = readFileSync(file, "utf8").trim());
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
export const sign = (body: string) => createHmac("sha256", getSecret()).update(body).digest("base64url");

export interface SessionPayload {
  uid: string;
  v: number; // must match the user's session_version; bumping it signs them out everywhere
  exp: number; // ms since epoch
}

export function createToken(uid: string, v: number, ttlMs: number): string {
  const body = b64(JSON.stringify({ uid, v, exp: Date.now() + ttlMs } satisfies SessionPayload));
  return `${body}.${sign(body)}`;
}

/** Returns the payload when the token is authentic and not expired, otherwise null. */
export function verifyToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof p.uid !== "string" || typeof p.v !== "number" || typeof p.exp !== "number" || p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}
