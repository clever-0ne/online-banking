import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/current";
import { marketSnapshot } from "@/lib/server/markets";

/** Global markets and headlines for the Explore page (signed-in customers). */
export async function GET() {
  const r = await requireUser();
  if ("response" in r) return r.response;
  return NextResponse.json(await marketSnapshot(), { headers: { "Cache-Control": "private, max-age=300" } });
}
