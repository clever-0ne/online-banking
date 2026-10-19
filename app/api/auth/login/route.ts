import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/server/admin";
import { clearFailures, clientIp, error, lockedFor, recordFailure, sameOrigin, withSession } from "@/lib/server/http";
import { hasPasskey, startPendingSignIn } from "@/lib/server/passkeys";
import { checkLogin, recordLogin } from "@/lib/server/users";

/** Step one of sign-in. Customers with a passkey get { passkey: true } and finish at /api/auth/passkey. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const remember = body?.remember === true;
  if (!email || !password) return error("Enter your email and password.", 400);

  const keys = [`e:${email}`, `ip:${clientIp(req)}`];
  const wait = lockedFor(keys);
  if (wait > 0) return error(`Too many attempts. Try again in ${wait} seconds.`, 429);

  const result = await checkLogin(email, password);
  if (!result.ok) {
    if (result.reason === "suspended") {
      clearFailures(keys);
      return error("This account is suspended. Contact Anchor Bank support to restore access.", 403);
    }
    recordFailure(keys);
    const nowLocked = lockedFor(keys);
    return error(nowLocked > 0 ? `Too many attempts. Try again in ${nowLocked} seconds.` : "Email or password is incorrect.", nowLocked > 0 ? 429 : 401);
  }
  clearFailures(keys);
  const user = result.user;

  if (await hasPasskey(user.id)) {
    const res = NextResponse.json({ passkey: true });
    startPendingSignIn(res, { uid: user.id, v: user.sessionVersion, remember });
    return res;
  }
  await recordLogin(user.id, req.headers.get("user-agent"));
  await audit(user, "sign_in", user, remember ? "Kept signed in for 30 days" : "");
  return withSession(NextResponse.json({ user: { id: user.id, name: user.name } }), user, remember);
}
