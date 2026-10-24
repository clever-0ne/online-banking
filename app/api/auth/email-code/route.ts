import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/server/admin";
import { emailConfigured, sendEmail } from "@/lib/server/email";
import { clearFailures, clientIp, error, lockedFor, recordFailure, sameOrigin, withSession } from "@/lib/server/http";
import { siteOrigin } from "@/lib/server/origin";
import { clearStepCookies, readPending, startPendingSignIn } from "@/lib/server/passkeys";
import { CODE_MS, checkSignInCode, createSignInCode } from "@/lib/server/signin-codes";
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

/**
 * Step two by email instead of a passkey.
 * { action: "send" } emails a six-digit code; { action: "verify", code } checks it and signs the customer in.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  const p = await pendingUser(req);
  if (!p) return expired();
  const body = await req.json().catch(() => null);

  if (body?.action === "send") {
    if (!emailConfigured()) return error("Email codes aren't available right now. Use your passkey instead.", 503);
    const keys = [`code-send:${p.user.id}`, `code-send-ip:${clientIp(req)}`];
    const wait = lockedFor(keys);
    if (wait > 0) return error(`Too many codes requested. Try again in ${wait} seconds.`, 429);
    recordFailure(keys); // every send counts toward the limit
    const code = await createSignInCode(p.user.id);
    const sent = await sendEmail({
      to: p.user.email,
      subject: `${code} is your Anchor Bank sign-in code`,
      heading: "Your sign-in code",
      paragraphs: [
        `Hi ${p.user.name.split(" ")[0]}, use this code to finish signing in to Anchor Bank:`,
        code,
        "If you didn't try to sign in, someone may know your password. Change it now and contact us.",
      ],
      note: "This code expires in 10 minutes. Anchor Bank will never call or text you to ask for it.",
    }, siteOrigin(req.headers).origin);
    if (!sent) return error("We couldn't send the email. Try again, or use your passkey.", 502);
    await audit(p.user, "sign_in_code_sent", p.user, `From ${clientIp(req)}`);
    const res = NextResponse.json({ sent: true, to: maskEmail(p.user.email) });
    startPendingSignIn(res, { uid: p.user.id, v: p.user.sessionVersion, remember: p.remember }, CODE_MS);
    return res;
  }

  if (body?.action === "verify") {
    const keys = [`code:${p.user.id}`, `ip:${clientIp(req)}`];
    const wait = lockedFor(keys);
    if (wait > 0) return error(`Too many attempts. Try again in ${wait} seconds.`, 429);
    const code = String(body.code ?? "").replace(/\D/g, "");
    if (code.length !== 6) return error("Enter the 6-digit code from the email.", 400);
    const result = await checkSignInCode(p.user.id, code);
    if (result !== "ok") {
      recordFailure(keys);
      return error(result === "expired" ? "That code has expired or been used too many times. Send a new code." : "That code isn't right. Check the email and try again.", 401);
    }
    clearFailures(keys);
    await recordLogin(p.user.id, req.headers.get("user-agent"));
    await audit(p.user, "sign_in", p.user, `With email code${p.remember ? " · kept signed in for 30 days" : ""}`);
    const res = withSession(NextResponse.json({ user: { id: p.user.id, name: p.user.name } }), p.user, p.remember);
    clearStepCookies(res);
    return res;
  }

  return error("Unknown request.", 400);
}

/** "jordan@example.com" → "jo•••@example.com", so the page can say where the code went. */
function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(4, name.length - 2)))}@${domain}`;
}
