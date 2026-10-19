import { NextResponse, type NextRequest } from "next/server";
import { BankError, cancelScheduled, loadState } from "@/lib/server/bank";
import { requireUser } from "@/lib/server/current";
import { error, sameOrigin } from "@/lib/server/http";

/** Cancels a scheduled or repeating payment that hasn't gone out yet. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  const r = await requireUser();
  if ("response" in r) return r.response;
  try {
    await cancelScheduled(r.user, (await params).id);
  } catch (e) {
    if (e instanceof BankError) return error(e.message, e.status);
    throw e;
  }
  return NextResponse.json({ state: await loadState(r.user) });
}
