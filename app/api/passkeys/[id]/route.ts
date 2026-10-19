import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/server/admin";
import { requireUser } from "@/lib/server/current";
import { error, sameOrigin } from "@/lib/server/http";
import { listPasskeys, removePasskey } from "@/lib/server/passkeys";
import { notifyCustomer } from "@/lib/server/push";
import { verifyPassword } from "@/lib/server/users";

/** Removes a passkey. Needs the account password, so a borrowed signed-in device can't turn the second step off. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  const r = await requireUser();
  if ("response" in r) return r.response;
  const body = await req.json().catch(() => null);
  if (!verifyPassword(String(body?.password ?? ""), r.user.passwordHash)) return error("That password is incorrect.", 401, "password");
  const name = await removePasskey(r.user.id, (await params).id);
  if (!name) return error("That passkey was already removed.", 404);
  await audit(r.user, "passkey_removed", r.user, name);
  await notifyCustomer(r.user.id, { title: "Passkey removed", body: `"${name}" was removed from your account. If this wasn't you, contact us right away.`, url: "/profile", tag: "security" });
  return NextResponse.json({ passkeys: await listPasskeys(r.user.id) });
}
