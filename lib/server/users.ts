// User accounts, stored in Postgres. Passwords are hashed with scrypt and a per-user salt;
// plain passwords are never stored or logged.
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { one, run } from "./db";

export type Role = "user" | "admin";
export type Status = "active" | "suspended";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: Role;
  status: Status;
  sessionVersion: number;
  note: string;
  createdAt: string;
  lastLoginAt: string | null;
  loginCount: number;
}

export type PublicUser = Omit<UserRecord, "passwordHash" | "sessionVersion">;

interface Row {
  id: string; name: string; email: string; phone: string; password_hash: string; role: Role; status: Status;
  session_version: number; note: string; created_at: string; last_login_at: string | null; login_count: number;
}

export type UserRow = Row;
export const fromRow = (r: Row): UserRecord => ({
  id: r.id, name: r.name, email: r.email, phone: r.phone, passwordHash: r.password_hash, role: r.role, status: r.status,
  sessionVersion: r.session_version, note: r.note, createdAt: r.created_at, lastLoginAt: r.last_login_at, loginCount: r.login_count,
});

export const toPublic = ({ passwordHash: _h, sessionVersion: _v, ...u }: UserRecord): PublicUser => u;

// ---------- Passwords ----------
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(password, Buffer.from(saltB64, "base64"), expected.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(expected, actual);
}

/** A readable one-time password for admin resets, e.g. "Tide-Harbor-4821-Keel". */
export function temporaryPassword(): string {
  const words = ["Tide", "Harbor", "Keel", "Compass", "Reef", "Mast", "Beacon", "Current", "Atlas", "Lantern", "Summit", "Cedar"];
  const pick = () => words[randomBytes(1)[0] % words.length];
  return `${pick()}-${pick()}-${1000 + (randomBytes(2).readUInt16BE(0) % 9000)}-${pick()}`;
}

// ---------- Queries ----------
export async function findByEmail(email: string): Promise<UserRecord | undefined> {
  const r = await one<Row>("SELECT * FROM users WHERE email = ?", email.trim().toLowerCase());
  return r && fromRow(r);
}

export async function findById(id: string): Promise<UserRecord | undefined> {
  const r = await one<Row>("SELECT * FROM users WHERE id = ?", id);
  return r && fromRow(r);
}

// A real hash to compare against when the email is unknown, so timing doesn't reveal which emails exist.
const DUMMY_HASH = hashPassword(randomBytes(12).toString("hex"));

export type LoginResult = { ok: true; user: UserRecord } | { ok: false; reason: "bad" | "suspended" };

export async function checkLogin(email: string, password: string): Promise<LoginResult> {
  const user = await findByEmail(email);
  const ok = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return { ok: false, reason: "bad" };
  if (user.status === "suspended") return { ok: false, reason: "suspended" };
  return { ok: true, user };
}

export async function recordLogin(id: string, userAgent?: string | null) {
  await run("UPDATE users SET last_login_at = ?, login_count = login_count + 1 WHERE id = ?", new Date().toISOString(), id);
  if (userAgent === undefined) return; // a brand-new account, not a sign-in
  const { signInAlertsOn } = await import("./bank");
  const { deviceName, notifyCustomer } = await import("./push");
  if (await signInAlertsOn(id)) {
    await notifyCustomer(id, { title: "New sign-in", body: `Your account was signed in to on ${deviceName(userAgent)}. If this wasn't you, change your password now.`, url: "/profile", tag: "sign-in" });
  }
}

export async function createUser(input: { name: string; email: string; phone: string; password: string }): Promise<UserRecord> {
  const id = randomUUID();
  const email = input.email.trim().toLowerCase();
  await run(
    "INSERT INTO users (id, name, email, phone, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    id, input.name.trim(), email, input.phone.trim(), hashPassword(input.password), new Date().toISOString(),
  );
  return (await findById(id))!;
}
