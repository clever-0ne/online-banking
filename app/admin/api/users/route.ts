import { NextResponse, type NextRequest } from "next/server";
import { listUsers, stats } from "@/lib/server/admin";
import { adminGuard } from "@/lib/server/adminAuth";

export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const p = req.nextUrl.searchParams;
  return NextResponse.json({
    users: await listUsers({ q: p.get("q") ?? "", status: p.get("status") ?? "", sort: p.get("sort") ?? "" }),
    stats: await stats(),
  });
}
