import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/server/admin";
import { emailConfigured, sendEmail } from "@/lib/server/email";
import { clientIp, error, lockedFor, recordFailure, sameOrigin } from "@/lib/server/http";
import { siteOrigin } from "@/lib/server/origin";
import { createResetToken } from "@/lib/server/reset";
import { findByEmail } from "@/lib/server/users";

/**
 * Emails a password reset link. The answer is the same whether or not the email has an account,
 * so this can't be used to find out who banks here. Limited to a few requests a minute.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  if (!emailConfigured()) return error("Password reset by email isn't available right now. Contact us to reset your password.", 503);
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return error("Enter the email address you use to sign in.", 400, "email");

  const keys = [`forgot:${email}`, `forgot-ip:${clientIp(req)}`];
  const wait = lockedFor(keys);
  if (wait > 0) return error(`Too many requests. Try again in ${wait} seconds.`, 429);
  recordFailure(keys); // every request counts toward the limit

  const user = await findByEmail(email);
  if (user && user.status === "active") {
    const token = await createResetToken(user.id);
    const base = siteOrigin(req.headers).origin;
    await sendEmail({
      to: user.email,
      subject: "Reset your Anchor Bank password",
      heading: "Reset your password",
      paragraphs: [
        `Hi ${user.name.split(" ")[0]}, we got a request to reset the password for your Anchor Bank account.`,
        "Select the button below to choose a new password. If you didn't ask for this, you can ignore this email. Your password won't change.",
      ],
      button: { label: "Choose a new password", href: `/reset-password?token=${token}` },
      note: "This link works once and expires in 30 minutes. If you have a passkey, you'll still need it to sign in.",
    }, base);
    await audit(user, "password_reset_requested", user, `From ${clientIp(req)}`);
  }
  return NextResponse.json({ ok: true });
}
