// The signed-in user for server components and route handlers.
// A session only counts if its signature is valid, the user still exists and is active,
// and its version matches (admins bump the version to sign someone out everywhere).
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifyToken } from "./session";
import { findById, toPublic, type PublicUser, type UserRecord } from "./users";

export async function currentRecord(): Promise<UserRecord | null> {
  const session = verifyToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await findById(session.uid);
  if (!user || user.status !== "active" || user.sessionVersion !== session.v) return null;
  return user;
}

export async function currentUser(): Promise<PublicUser | null> {
  const u = await currentRecord();
  return u ? toPublic(u) : null;
}

/** For route handlers: the signed-in user, or a 401/403 response to return. */
export async function requireUser(): Promise<{ user: UserRecord } | { response: NextResponse }> {
  const user = await currentRecord();
  if (!user) return { response: NextResponse.json({ error: "Sign in to continue." }, { status: 401 }) };
  return { user };
}
