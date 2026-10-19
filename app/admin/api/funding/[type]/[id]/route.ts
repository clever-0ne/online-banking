import { NextResponse, type NextRequest } from "next/server";
import { adminGuard, adminName } from "@/lib/server/adminAuth";
import { BankError } from "@/lib/server/bank";
import { fundingQueue, review } from "@/lib/server/funding";
import { error, sameOrigin } from "@/lib/server/http";

/** Approves or declines a deposit or withdrawal. Body: { decision: "approve" | "decline", reference? }. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  const { type, id } = await params;
  const body = await req.json().catch(() => null);
  if (type !== "deposit" && type !== "withdrawal") return error("Not found.", 404);
  if (body?.decision !== "approve" && body?.decision !== "decline") return error("Choose approve or decline.", 400);
  try {
    await review({ id: "admin", email: adminName() }, type, id, body.decision, String(body.reference ?? ""));
  } catch (e) {
    if (e instanceof BankError) return error(e.message, e.status);
    throw e;
  }
  return NextResponse.json(await fundingQueue());
}
