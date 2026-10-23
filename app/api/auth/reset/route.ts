import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/server/admin";
import { run } from "@/lib/server/db";
import { clientIp, error, lockedFor, recordFailure, sameOrigin } from "@/lib/server/http";
import { notifyCustomer } from "@/lib/server/push";
import { resetTokenUser, useResetToken } from "@/lib/server/reset";
import { findById, hashPassword } from "@/lib/server/users";
import { passwordProblem } from "@/lib/validate";

const EXPIRED = "This reset link has expired or was already used. Ask for a new one.";

/** Checks a reset link before showing the new-password form. ?token= */
export async function GET(req: NextRequest) {
  const uid = await resetTokenUser(req.nextUrl.searchParams.get("token") ?? "");
  const user = uid ? await findById(uid) : null;
  if (!user || user.status !== "active") return error(EXPIRED, 410);
  return NextResponse.json({ email: user.email });
}

/** Sets a new password from a reset link and signs the customer out everywhere. Body: { token, password }. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  const keys = [`reset-ip:${clientIp(req)}`];
  const wait = lockedFor(keys);
  if (wait > 0) return error(`Too many attempts. Try again in ${wait} seconds.`, 429);

  const body = await req.json().catch(() => null);
  const token = String(body?.token ?? "");
  const password = String(body?.password ?? "");
  const uid = await resetTokenUser(token);
  const user = uid ? await findById(uid) : null;
  if (!user || user.status !== "active") { recordFailure(keys); return error(EXPIRED, 410); }

  const problem = passwordProblem(password, user.email);
  if (problem) return error(problem, 400, "password");
  if (!(await useResetToken(token, user.id))) return error(EXPIRED, 410);

  await run("UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?", hashPassword(password), user.id);
  await audit(user, "password_reset", user, "With an email link; signed out everywhere");
  await notifyCustomer(user.id, {
    title: "Your password was reset",
    body: "Your Anchor Bank password was just changed with a reset link, and every device was signed out. If this wasn't you, contact us right away.",
    url: "/login", tag: "security",
  });
  return NextResponse.json({ ok: true });
}
