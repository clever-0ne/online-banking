import { NextResponse, type NextRequest } from "next/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { audit } from "@/lib/server/admin";
import { requireUser } from "@/lib/server/current";
import { error, sameOrigin } from "@/lib/server/http";
import { clearStepCookies, finishRegistration, listPasskeys, registrationOptions } from "@/lib/server/passkeys";
import { notifyCustomer } from "@/lib/server/push";

/** The signed-in customer's passkeys. With ?options=1, a challenge for adding one. */
export async function GET(req: NextRequest) {
  const r = await requireUser();
  if ("response" in r) return r.response;
  if (req.nextUrl.searchParams.get("options") !== "1") return NextResponse.json({ passkeys: await listPasskeys(r.user.id) });
  const res = NextResponse.json({});
  const options = await registrationOptions(req, res, r.user);
  return NextResponse.json({ options }, { headers: res.headers });
}

/** Saves a new passkey. Body: { name, response } where response is the browser's registration result. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  const r = await requireUser();
  if ("response" in r) return r.response;
  const body = (await req.json().catch(() => null)) as { name?: unknown; response?: RegistrationResponseJSON } | null;
  if (!body?.response) return error("Send the passkey details.", 400);
  const result = await finishRegistration(req, r.user.id, body.response, String(body.name ?? ""));
  if ("error" in result) return error(result.error, 400);
  await audit(r.user, "passkey_added", r.user, result.name);
  await notifyCustomer(r.user.id, { title: "Passkey added", body: `"${result.name}" can now confirm your sign-ins. If this wasn't you, contact us right away.`, url: "/profile", tag: "security" });
  return clearStepCookies(NextResponse.json({ passkeys: await listPasskeys(r.user.id) }, { status: 201 }));
}
