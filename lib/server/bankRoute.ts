// Shared handling for the endpoints that move money: same-origin check, signed-in customer,
// access to the page the action belongs to, JSON body, and the customer's fresh state (or a readable error) in the response.
import { NextResponse, type NextRequest } from "next/server";
import { BankError, loadState } from "./bank";
import { requireUser } from "./current";
import { error, sameOrigin } from "./http";
import { canUse } from "./permissions";
import type { PageSlug } from "@/lib/pages";
import type { UserRecord } from "./users";

export async function bankAction(req: NextRequest, page: PageSlug, fn: (user: UserRecord, body: Record<string, unknown>) => Promise<void>) {
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  const r = await requireUser();
  if ("response" in r) return r.response;
  if (!(await canUse(r.user.id, page))) return error("This feature isn't available on your account.", 403);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return error("Send the payment details as JSON.", 400);
  try {
    await fn(r.user, body as Record<string, unknown>);
  } catch (e) {
    if (e instanceof BankError) return error(e.message, e.status, e.field);
    throw e;
  }
  return NextResponse.json({ state: await loadState(r.user) });
}
