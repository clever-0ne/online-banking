import { NextResponse, type NextRequest } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { audit } from "@/lib/server/admin";
import { clearFailures, clientIp, error, lockedFor, recordFailure, sameOrigin, withSession } from "@/lib/server/http";
import { clearStepCookies, directSignInOptions, finishDirectSignIn } from "@/lib/server/passkeys";
import { findById, recordLogin } from "@/lib/server/users";

/** "Sign on with a passkey": part one, a challenge any of the customer's passkeys can answer. */
export async function GET(req: NextRequest) {
  const res = NextResponse.json({});
  const options = await directSignInOptions(req, res);
  return NextResponse.json({ options }, { headers: res.headers });
}

/** Part two: checks the passkey's answer and signs in the customer it belongs to. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  const keys = [`pk-direct-ip:${clientIp(req)}`];
  const wait = lockedFor(keys);
  if (wait > 0) return error(`Too many attempts. Try again in ${wait} seconds.`, 429);

  const body = (await req.json().catch(() => null)) as { response?: AuthenticationResponseJSON; remember?: boolean } | null;
  const uid = body?.response ? await finishDirectSignIn(req, body.response) : null;
  const user = uid ? await findById(uid) : null;
  if (!user) {
    recordFailure(keys);
    return error("That passkey isn't set up for an Anchor Bank account. Sign on with your email and password instead.", 401);
  }
  if (user.status !== "active") return error("This account is suspended. Contact Anchor Bank support to restore access.", 403);
  clearFailures(keys);
  const remember = body?.remember === true;
  await recordLogin(user.id, req.headers.get("user-agent"));
  await audit(user, "sign_in", user, `With passkey only${remember ? " · kept signed in for 30 days" : ""}`);
  const res = withSession(NextResponse.json({ user: { id: user.id, name: user.name } }), user, remember);
  clearStepCookies(res);
  return res;
}
