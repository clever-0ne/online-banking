// Email sign-in codes: the alternative to a passkey for the second step of sign-in. A six-digit code is
// emailed, lasts 10 minutes, allows 5 tries, and asking again replaces the earlier code. Only an HMAC of the
// code (keyed with the server secret and tied to the customer) is stored. Server only.
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { one, run } from "./db";
import { getSecret } from "./session";

export const CODE_MS = 10 * 60 * 1000;
const MAX_TRIES = 5;
const hash = (userId: string, code: string) => createHmac("sha256", getSecret()).update(`signin:${userId}:${code}`).digest("base64url");

/** Makes a new code for this customer, replacing any earlier one. */
export async function createSignInCode(userId: string): Promise<string> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await run(
    `INSERT INTO sign_in_codes (user_id, code_hash, expires_at, tries) VALUES (?, ?, ?, 0)
     ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, tries = 0`,
    userId, hash(userId, code), new Date(Date.now() + CODE_MS).toISOString());
  return code;
}

export type CodeCheck = "ok" | "wrong" | "expired";

/** Checks a code. A right code is used up; after 5 wrong tries, or once it expires, the code stops working. */
export async function checkSignInCode(userId: string, code: string): Promise<CodeCheck> {
  const r = await one<{ code_hash: string; expires_at: string; tries: number }>("SELECT code_hash, expires_at, tries FROM sign_in_codes WHERE user_id = ?", userId);
  if (!r || r.expires_at < new Date().toISOString() || r.tries >= MAX_TRIES) return "expired";
  const a = Buffer.from(hash(userId, code.replace(/\D/g, ""))), b = Buffer.from(r.code_hash);
  if (a.length === b.length && timingSafeEqual(a, b)) {
    await run("DELETE FROM sign_in_codes WHERE user_id = ?", userId);
    return "ok";
  }
  await run("UPDATE sign_in_codes SET tries = tries + 1 WHERE user_id = ?", userId);
  return r.tries + 1 >= MAX_TRIES ? "expired" : "wrong";
}
