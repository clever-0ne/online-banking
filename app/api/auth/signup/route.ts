import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/server/admin";
import { error, sameOrigin, withSession } from "@/lib/server/http";
import { createUser, findByEmail, recordLogin } from "@/lib/server/users";
import { signupProblem } from "@/lib/validate";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return error("Request blocked.", 403);
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return error("Send name, email, phone and password.", 400);
  const v = {
    name: String(body.name ?? ""),
    email: String(body.email ?? ""),
    phone: String(body.phone ?? ""),
    password: String(body.password ?? ""),
  };
  const problem = signupProblem(v);
  if (problem) return error(problem.message, 400, problem.field);
  if (await findByEmail(v.email)) return error("An account with this email already exists. Sign in instead.", 409, "email");
  try {
    const user = await createUser(v);
    await recordLogin(user.id);
    await audit(user, "sign_up", user);
    return withSession(NextResponse.json({ user: { id: user.id, name: user.name } }, { status: 201 }), user, false);
  } catch {
    return error("An account with this email already exists. Sign in instead.", 409, "email");
  }
}
