import { NextResponse, type NextRequest } from "next/server";
import { adminGuard, adminName } from "@/lib/server/adminAuth";
import { BankError } from "@/lib/server/bank";
import { depositAddresses, fundingQueue, setDepositAddress } from "@/lib/server/funding";
import { error, sameOrigin } from "@/lib/server/http";

/** Deposit addresses plus deposits and withdrawals waiting for review and recently reviewed. */
export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  return NextResponse.json({ addresses: await depositAddresses(), ...(await fundingQueue()) }, { headers: { "Cache-Control": "no-store" } });
}

/** Sets the deposit address for one asset. Body: { asset, address }. An empty address turns that asset off. */
export async function PUT(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  const body = await req.json().catch(() => null);
  try {
    await setDepositAddress({ id: "admin", email: adminName() }, body?.asset, body?.address);
  } catch (e) {
    if (e instanceof BankError) return error(e.message, e.status, e.field);
    throw e;
  }
  return NextResponse.json({ addresses: await depositAddresses() });
}
