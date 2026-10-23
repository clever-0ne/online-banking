// Setup check for the staff console: is each setting the site depends on present and right on this server?
// Server only. Values are never shown, only whether they're set and what's wrong.
import { headers } from "next/headers";
import { one } from "./db";
import { siteUrl } from "./email";
import { siteOrigin } from "./origin";
import { pushConfigured, pushProblem } from "./push";

export interface SetupItem { name: string; ok: boolean; detail: string }

export async function setupCheck(): Promise<SetupItem[]> {
  const site = siteOrigin(await headers());
  const items: SetupItem[] = [];

  let dbOk = false;
  try { dbOk = !!(await one("SELECT 1 AS ok")); } catch {}
  items.push({ name: "Database", ok: dbOk, detail: dbOk ? "Connected." : "Can't reach the database. Check DATABASE_URL." });

  const secret = process.env.AUTH_SECRET ?? "";
  items.push({ name: "Sign-in secret", ok: secret.length >= 32, detail: secret.length >= 32 ? "AUTH_SECRET is set." : "AUTH_SECRET is missing or shorter than 32 characters. Without it, everyone is signed out whenever the server restarts." });

  items.push({ name: "Secure connection", ok: site.secure, detail: site.secure ? `Served at ${site.origin}.` : `Served at ${site.origin}. Passkeys and notifications only work over https.` });

  items.push({
    name: "Passkeys",
    ok: site.secure && !site.problem,
    detail: site.problem ?? (site.configured ? `Tied to ${site.origin}.` : `Tied to ${site.origin}. Set APP_ORIGIN to this address so it can't change by accident.`),
  });

  const key = !!process.env.RESEND_API_KEY?.trim(), sender = process.env.EMAIL_FROM?.trim();
  items.push({
    name: "Email",
    ok: key && !!sender,
    detail: !key ? "RESEND_API_KEY isn't set, so no emails are sent and Forgot password is off." : !sender ? "EMAIL_FROM isn't set; emails go from Resend's test address, which only reaches your own inbox." : `Sending as ${sender}.`,
  });
  if (key && !siteUrl()) items.push({ name: "Email links", ok: false, detail: "APP_ORIGIN isn't set, so alert emails go out without an Open Anchor Bank button." });

  const push = pushConfigured();
  items.push({ name: "Notifications", ok: push && site.secure, detail: push ? (site.secure ? "Keys are set." : "Keys are set, but notifications need https.") : (pushProblem ?? "Not set up.") });

  return items;
}
