import { NextResponse, type NextRequest } from "next/server";
import { adminGuard, adminName } from "@/lib/server/adminAuth";
import { error, sameOrigin } from "@/lib/server/http";
import { pageAccess, setPageAccess } from "@/lib/server/permissions";
import { findById } from "@/lib/server/users";

type Ctx = { params: Promise<{ id: string }> };

/** Every customer page and whether this customer can use it. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  const u = await findById((await params).id);
  return u ? NextResponse.json({ pages: await pageAccess(u.id) }) : error("That customer no longer exists.", 404);
}

/** Switches pages on or off. Body: { pages: { transfer: false, send: true, ... } } */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  const u = await findById((await params).id);
  if (!u) return error("That customer no longer exists.", 404);
  const body = (await req.json().catch(() => null)) as { pages?: unknown } | null;
  if (!body?.pages || typeof body.pages !== "object" || Array.isArray(body.pages)) return error("Send { pages: { slug: true | false } }.", 400);
  try {
    return NextResponse.json({ pages: await setPageAccess({ id: "admin", email: adminName() }, { id: u.id, email: u.email }, body.pages as Record<string, unknown>) });
  } catch (e) {
    return error((e as Error).message, 400);
  }
}
