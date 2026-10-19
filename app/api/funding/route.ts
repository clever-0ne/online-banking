import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/current";
import { depositAddresses, myRequests } from "@/lib/server/funding";

/** Deposit addresses (as staff set them right now) and the customer's own deposits and withdrawals. */
export async function GET() {
  const r = await requireUser();
  if ("response" in r) return r.response;
  const [addresses, requests] = await Promise.all([depositAddresses(), myRequests(r.user.id)]);
  return NextResponse.json({ addresses, requests }, { headers: { "Cache-Control": "no-store" } });
}
