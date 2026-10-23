// "Forgot password": one-time links sent by email. The link holds a random token; only its SHA-256 hash is
// stored, it lasts 30 minutes, works once, and asking again cancels any earlier link. Server only.
import { createHash, randomBytes } from "node:crypto";
import { one, run, tx } from "./db";

const LIFETIME_MS = 30 * 60 * 1000;
const hash = (token: string) => createHash("sha256").update(token).digest("base64url");

/** Makes a new reset link token for this customer and cancels older ones. */
export async function createResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await tx(async () => {
    await run("DELETE FROM password_resets WHERE user_id = ?", userId);
    await run("INSERT INTO password_resets (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
      hash(token), userId, new Date(now).toISOString(), new Date(now + LIFETIME_MS).toISOString());
  }, userId);
  return token;
}

/** The customer a link belongs to, if it's still valid (not used, not expired). */
export async function resetTokenUser(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const r = await one<{ user_id: string; expires_at: string; used_at: string | null }>("SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?", hash(token));
  if (!r || r.used_at || r.expires_at < new Date().toISOString()) return null;
  return r.user_id;
}

/** Marks a link used and removes every other link for that customer. Returns false if it was already used. */
export async function useResetToken(token: string, userId: string): Promise<boolean> {
  return tx(async () => {
    const changed = await run("UPDATE password_resets SET used_at = ? WHERE token_hash = ? AND used_at IS NULL", new Date().toISOString(), hash(token));
    await run("DELETE FROM password_resets WHERE user_id = ? AND token_hash <> ?", userId, hash(token));
    return changed === 1;
  }, userId);
}
