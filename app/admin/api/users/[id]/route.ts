import { NextResponse, type NextRequest } from "next/server";
import { AdminError, applyAction, deleteUser, userDetail, type AdminAction } from "@/lib/server/admin";
import { adminGuard, adminName } from "@/lib/server/adminAuth";
import { error, sameOrigin } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };
const staff = () => ({ id: "admin", email: adminName() });

export async function GET(_req: NextRequest, { params }: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  const detail = await userDetail((await params).id);
  return detail ? NextResponse.json({ user: detail }) : error("That customer no longer exists.", 404);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  const body = (await req.json().catch(() => null)) as AdminAction | null;
  if (!body || typeof body.action !== "string") return error("Say which action to take.", 400);
  try {
    return NextResponse.json(await applyAction(staff(), (await params).id, body));
  } catch (e) {
    if (e instanceof AdminError) return error(e.message, e.status);
    throw e;
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const denied = await adminGuard();
  if (denied) return denied;
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  try {
    await deleteUser(staff(), (await params).id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AdminError) return error(e.message, e.status);
    throw e;
  }
}
