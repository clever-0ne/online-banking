import { NextResponse, type NextRequest } from "next/server";
import { BankError, loadState, updateSettings } from "@/lib/server/bank";
import { requireUser } from "@/lib/server/current";
import { error, sameOrigin } from "@/lib/server/http";

const MAX_BYTES = 1_000_000;

/** The signed-in customer's accounts, ledger-backed balances and transactions, and settings. */
export async function GET() {
  const r = await requireUser();
  if ("response" in r) return r.response;
  return NextResponse.json({ state: await loadState(r.user) });
}

/** Saves settings only (profile, alerts, budgets, payees, card controls and so on). Money moves through the POST endpoints. */
export async function PUT(req: NextRequest) {
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  const r = await requireUser();
  if ("response" in r) return r.response;
  const text = await req.text();
  if (text.length > MAX_BYTES) return error("That's more data than an account can hold.", 413);
  let body: unknown;
  try { body = JSON.parse(text); } catch { return error("Send the settings as JSON.", 400); }
  const settings = body && typeof body === "object" && !Array.isArray(body) ? (body as { settings?: unknown }).settings : undefined;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return error("Balances and transactions can only change through payments and transfers. Send { settings } here.", 400);
  }
  try {
    await updateSettings(r.user, settings as Record<string, unknown>);
  } catch (e) {
    if (e instanceof BankError) return error(e.message, e.status);
    throw e;
  }
  return NextResponse.json({ ok: true });
}
