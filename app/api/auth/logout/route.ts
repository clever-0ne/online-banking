import { NextResponse, type NextRequest } from "next/server";
import { clearSession, error, sameOrigin } from "@/lib/server/http";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  return clearSession(NextResponse.json({ ok: true }));
}
