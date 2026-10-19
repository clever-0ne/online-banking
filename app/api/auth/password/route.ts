import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/server/admin";
import { requireUser } from "@/lib/server/current";
import { run } from "@/lib/server/db";
import { clearFailures, error, lockedFor, recordFailure, sameOrigin, withSession } from "@/lib/server/http";
import { findById, hashPassword, verifyPassword } from "@/lib/server/users";
import { notifyCustomer } from "@/lib/server/push";
import { passwordProblem } from "@/lib/validate";

/** Changes the signed-in customer's password. Every other session is signed out; this one stays signed in. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  const r = await requireUser();
  if ("response" in r) return r.response;
  const body = await req.json().catch(() => null);
  const current = String(body?.current ?? "");
  const next = String(body?.next ?? "");

  const keys = [`pw:${r.user.id}`];
  const wait = lockedFor(keys);
  if (wait > 0) return error(`Too many attempts. Try again in ${wait} seconds.`, 429);
  if (!verifyPassword(current, r.user.passwordHash)) {
    recordFailure(keys);
    return error("Your current password is incorrect.", 401, "current");
  }
  clearFailures(keys);
  const problem = passwordProblem(next, r.user.email);
  if (problem) return error(problem, 400, "next");
  if (verifyPassword(next, r.user.passwordHash)) return error("Choose a password you haven't used here before.", 400, "next");

  await run("UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?", hashPassword(next), r.user.id);
  await audit(r.user, "password_changed", r.user, "Other sessions signed out");
  await notifyCustomer(r.user.id, { title: "Password changed", body: "Your Anchor Bank password was changed and your other devices were signed out. If this wasn't you, contact us right away.", url: "/profile", tag: "security" });
  const fresh = (await findById(r.user.id))!;
  return withSession(NextResponse.json({ ok: true, changedAt: new Date().toISOString().slice(0, 10) }), fresh, false);
}
