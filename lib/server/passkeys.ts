// Passkeys (WebAuthn): the only second step at sign-in. A customer with at least one passkey signs in with
// their password and then their passkey; without one, the password alone. Server only.
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL, isoUint8Array } from "@simplewebauthn/server/helpers";
import { all, one, run } from "./db";
import { siteOrigin } from "./origin";
import { sign } from "./session";

const RP_NAME = "Anchor Bank";
const STEP_MS = 5 * 60 * 1000; // a challenge or a half-finished sign-in lasts 5 minutes

/** The site passkeys are tied to: the address the customer is actually using (see origin.ts). */
function relyingParty(req: NextRequest) {
  const site = siteOrigin(req.headers, req.nextUrl.protocol.replace(":", ""));
  if (site.problem) console.warn("[passkeys]", site.problem);
  return { origin: site.origin, rpID: site.rpID };
}

// ---------- Short-lived signed cookies ----------
const CHALLENGE_COOKIE = "kb_pk_challenge";
export const PENDING_COOKIE = "kb_2fa";

function seal(payload: object): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + STEP_MS })).toString("base64url");
  return `${body}.${sign(body)}`;
}

function unseal<T>(token: string | undefined): T | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const a = Buffer.from(sign(body)), b = Buffer.from(mac);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp: number };
    return typeof p.exp === "number" && p.exp > Date.now() ? p : null;
  } catch {
    return null;
  }
}

function setStepCookie(res: NextResponse, name: string, value: string) {
  res.cookies.set(name, value, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: STEP_MS / 1000 });
}
export function clearStepCookies(res: NextResponse) {
  for (const name of [CHALLENGE_COOKIE, PENDING_COOKIE]) res.cookies.set(name, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  return res;
}

type Challenge = { purpose: "register" | "sign_in"; uid: string; challenge: string };
const readChallenge = (req: NextRequest, purpose: Challenge["purpose"], uid: string) => {
  const c = unseal<Challenge>(req.cookies.get(CHALLENGE_COOKIE)?.value);
  return c && c.purpose === purpose && c.uid === uid ? c.challenge : null;
};

// ---------- Half-finished sign-in (password checked, passkey still needed) ----------
export type Pending = { uid: string; v: number; remember: boolean };

export function startPendingSignIn(res: NextResponse, p: Pending) {
  setStepCookie(res, PENDING_COOKIE, seal(p));
}
export const readPending = (req: NextRequest) => unseal<Pending>(req.cookies.get(PENDING_COOKIE)?.value);

// ---------- Stored passkeys ----------
interface Row { id: string; credential_id: string; public_key: string; counter: number; transports: string; name: string; created_at: string; last_used_at: string | null }
export interface PasskeyInfo { id: string; name: string; createdAt: string; lastUsedAt: string | null }

const rows = (userId: string) => all<Row>("SELECT * FROM passkeys WHERE user_id = ? ORDER BY created_at", userId);
const transportsOf = (r: Row) => (r.transports ? (r.transports.split(",") as AuthenticatorTransportFuture[]) : undefined);

export async function listPasskeys(userId: string): Promise<PasskeyInfo[]> {
  return (await rows(userId)).map((r) => ({ id: r.id, name: r.name, createdAt: r.created_at, lastUsedAt: r.last_used_at }));
}

export async function hasPasskey(userId: string): Promise<boolean> {
  return !!(await one("SELECT 1 FROM passkeys WHERE user_id = ? LIMIT 1", userId));
}

export async function removePasskey(userId: string, id: string): Promise<string | null> {
  const r = await one<{ name: string }>("DELETE FROM passkeys WHERE id = ? AND user_id = ? RETURNING name", id, userId);
  return r?.name ?? null;
}

// ---------- Adding a passkey (signed in) ----------
export async function registrationOptions(req: NextRequest, res: NextResponse, user: { id: string; email: string; name: string }) {
  const { rpID } = relyingParty(req);
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: isoUint8Array.fromUTF8String(user.id),
    userName: user.email,
    userDisplayName: user.name,
    attestationType: "none",
    excludeCredentials: (await rows(user.id)).map((r) => ({ id: r.credential_id, transports: transportsOf(r) })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });
  setStepCookie(res, CHALLENGE_COOKIE, seal({ purpose: "register", uid: user.id, challenge: options.challenge } satisfies Challenge));
  return options;
}

/** Checks the browser's response and saves the passkey. Returns its name, or an error message. */
export async function finishRegistration(req: NextRequest, userId: string, response: RegistrationResponseJSON, name: string): Promise<{ name: string } | { error: string }> {
  const expectedChallenge = readChallenge(req, "register", userId);
  if (!expectedChallenge) return { error: "That took too long. Try adding the passkey again." };
  const { origin, rpID } = relyingParty(req);
  let verification;
  try {
    verification = await verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
  } catch {
    return { error: "Your device's response couldn't be verified. Try again." };
  }
  if (!verification.verified) return { error: "Your device's response couldn't be verified. Try again." };
  const { credential } = verification.registrationInfo;
  const label = name.trim().slice(0, 40) || "Passkey";
  try {
    await run(
      "INSERT INTO passkeys (id, user_id, credential_id, public_key, counter, transports, name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      "pk_" + randomUUID(), userId, credential.id, isoBase64URL.fromBuffer(credential.publicKey), credential.counter,
      (credential.transports ?? []).join(","), label, new Date().toISOString(),
    );
  } catch {
    return { error: "This passkey is already on an account." };
  }
  return { name: label };
}

// ---------- Signing in with a passkey ----------
export async function signInOptions(req: NextRequest, res: NextResponse, userId: string) {
  const { rpID } = relyingParty(req);
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: (await rows(userId)).map((r) => ({ id: r.credential_id, transports: transportsOf(r) })),
    userVerification: "required",
  });
  setStepCookie(res, CHALLENGE_COOKIE, seal({ purpose: "sign_in", uid: userId, challenge: options.challenge } satisfies Challenge));
  return options;
}

/** True when the response proves this customer holds one of their passkeys. Updates its counter and last use. */
export async function finishSignIn(req: NextRequest, userId: string, response: AuthenticationResponseJSON): Promise<boolean> {
  const expectedChallenge = readChallenge(req, "sign_in", userId);
  if (!expectedChallenge || typeof response?.id !== "string") return false;
  const r = await one<Row>("SELECT * FROM passkeys WHERE credential_id = ? AND user_id = ?", response.id, userId);
  if (!r) return false;
  const { origin, rpID } = relyingParty(req);
  try {
    const v = await verifyAuthenticationResponse({
      response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
      credential: { id: r.credential_id, publicKey: isoBase64URL.toBuffer(r.public_key), counter: r.counter, transports: transportsOf(r) },
    });
    if (!v.verified) return false;
    await run("UPDATE passkeys SET counter = ?, last_used_at = ? WHERE id = ?", v.authenticationInfo.newCounter, new Date().toISOString(), r.id);
    return true;
  } catch {
    return false;
  }
}
