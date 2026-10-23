import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/server/admin";
import { sendEmail } from "@/lib/server/email";
import { error, sameOrigin, withSession } from "@/lib/server/http";
import { siteOrigin } from "@/lib/server/origin";
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
    await sendEmail({
      to: user.email,
      subject: "Welcome to Anchor Bank",
      heading: `Welcome, ${user.name.split(" ")[0]}`,
      paragraphs: [
        "Your Anchor Bank account is open. Your checking account, high-yield savings and card are ready to use.",
        "To keep your account safe, add a passkey in Profile → Security. Then every sign-in also needs your fingerprint, face or device PIN.",
      ],
      details: [["Checking", "Ready"], ["High-Yield Savings", "3.75% APY"], ["Email", user.email]],
      button: { label: "Go to your accounts", href: "/dashboard" },
    }, siteOrigin(req.headers).origin);
    return withSession(NextResponse.json({ user: { id: user.id, name: user.name } }, { status: 201 }), user, false);
  } catch {
    return error("An account with this email already exists. Sign in instead.", 409, "email");
  }
}
