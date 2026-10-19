import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/current";
import { blockedPages } from "@/lib/server/permissions";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { note: _adminOnly, ...self } = user;
  return NextResponse.json({ user: self, blocked: await blockedPages(user.id) });
}
