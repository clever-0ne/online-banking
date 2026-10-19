import { NextResponse, type NextRequest } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { audit } from "@/lib/server/admin";
import { clearFailures, clientIp, error, lockedFor, recordFailure, sameOrigin, withSession } from "@/lib/server/http";
import { clearStepCookies, finishSignIn, readPending, signInOptions } from "@/lib/server/passkeys";
import { findById, recordLogin } from "@/lib/server/users";

/** The customer whose password was just accepted, if they're still allowed to sign in. */
async function pendingUser(req: NextRequest) {
  const p = readPending(req);
  if (!p) return null;
  const user = await findById(p.uid);
  if (!user || user.status !== "active" || user.sessionVersion !== p.v) return null;
  return { user, remember: p.remember };
}

const expired = () => clearStepCookies(error("Your sign-in timed out. Enter your password again.", 401));

/** Step two, part one: the challenge for the customer's passkey. */
export async function GET(req: NextRequest) {
  const p = await pendingUser(req);
  if (!p) return expired();
  const res = NextResponse.json({});
  const options = await signInOptions(req, res, p.user.id);
  return NextResponse.json({ options }, { headers: res.headers });
}

/** Step two, part two: checks the passkey's answer and signs the customer in. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  const p = await pendingUser(req);
  if (!p) return expired();
  const keys = [`pk:${p.user.id}`, `ip:${clientIp(req)}`];
  const wait = lockedFor(keys);
  if (wait > 0) return error(`Too many attempts. Try again in ${wait} seconds.`, 429);

  const response = (await req.json().catch(() => null)) as AuthenticationResponseJSON | null;
  if (!response || !(await finishSignIn(req, p.user.id, response))) {
    recordFailure(keys);
    return error("That passkey didn't work. Try again, or use a different passkey for this account.", 401);
  }
  clearFailures(keys);
  await recordLogin(p.user.id, req.headers.get("user-agent"));
  await audit(p.user, "sign_in", p.user, `With passkey${p.remember ? " · kept signed in for 30 days" : ""}`);
  const res = withSession(NextResponse.json({ user: { id: p.user.id, name: p.user.name } }), p.user, p.remember);
  clearStepCookies(res);
  return res;
}
