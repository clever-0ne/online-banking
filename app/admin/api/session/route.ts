import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/server/admin";
import { adminConfigured, adminName, checkAdminPassword, clearAdminCookie, setAdminCookie } from "@/lib/server/adminAuth";
import { clearFailures, clientIp, error, lockedFor, recordFailure, sameOrigin } from "@/lib/server/http";

/** Admin sign in. Reached only through the hidden admin path. */
export async function POST(req: NextRequest) {
  if (!adminConfigured()) return error("Not found.", 404);
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  const body = await req.json().catch(() => null);
  const password = String(body?.password ?? "");

  const keys = [`admin:${clientIp(req)}`];
  const wait = lockedFor(keys);
  if (wait > 0) return error(`Too many attempts. Try again in ${wait} seconds.`, 429);

  if (!checkAdminPassword(password)) {
    recordFailure(keys);
    await audit({ id: "admin", email: adminName() }, "admin_sign_in_failed", null, `From ${clientIp(req)}`);
    const locked = lockedFor(keys);
    return error(locked > 0 ? `Too many attempts. Try again in ${locked} seconds.` : "That password is incorrect.", locked > 0 ? 429 : 401);
  }
  clearFailures(keys);
  await audit({ id: "admin", email: adminName() }, "admin_sign_in", null, `From ${clientIp(req)}`);
  return setAdminCookie(NextResponse.json({ ok: true }));
}

/** Admin sign out. */
export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  return clearAdminCookie(NextResponse.json({ ok: true }));
}
