// Email through Resend (RESEND_API_KEY, EMAIL_FROM). Every email uses one Anchor Bank layout built from plain
// tables and inline styles, so it looks the same in Gmail, Outlook and Apple Mail. Sending never throws:
// a failed email is logged and the request carries on. Server only.

export interface EmailMessage {
  to: string;
  subject: string;
  /** Large heading at the top of the email. Defaults to the subject. */
  heading?: string;
  /** Paragraphs of plain text (escaped for you). */
  paragraphs: string[];
  /** Optional rows shown in a box, e.g. [["Amount", "$25.00"], ["Asset", "BTC"]]. */
  details?: [string, string][];
  /** Optional main button. A relative href ("/deposit") is made absolute with the site's address. */
  button?: { label: string; href: string };
  /** Small grey line under the button, e.g. "This link expires in 30 minutes." */
  note?: string;
}

export const emailConfigured = () => !!process.env.RESEND_API_KEY?.trim();
const from = () => process.env.EMAIL_FROM?.trim() || "Anchor Bank <onboarding@resend.dev>";

/** The site's public address for links in emails (APP_ORIGIN), or null if it isn't set. */
export function siteUrl(): string | null {
  try { return process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).origin : null; } catch { return null; }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function absolute(href: string, base: string | null): string | null {
  if (/^https?:\/\//.test(href)) return href;
  return base ? base + (href.startsWith("/") ? href : "/" + href) : null;
}

/** Builds the HTML and plain-text versions of an email. */
export function renderEmail(m: EmailMessage, base = siteUrl()): { html: string; text: string } {
  const heading = m.heading ?? m.subject;
  const link = m.button ? absolute(m.button.href, base) : null;
  const logo = base ? `<img src="${esc(base)}/icon-192.png" width="40" height="40" alt="" style="display:block;border-radius:10px;border:0">` : "";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(m.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f8;">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${esc(m.paragraphs[0] ?? "")}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f8;padding:24px 12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3e3ec;">
<tr><td style="background:#0B3D91;padding:18px 28px;border-bottom:4px solid #2F7BC4;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>${logo ? `<td style="padding-right:12px">${logo}</td>` : ""}<td style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.01em">Anchor Bank</td></tr></table>
</td></tr>
<tr><td style="padding:32px 28px 8px;color:#17171f;">
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#17171f;">${esc(heading)}</h1>
${m.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#3f3f52;">${esc(p)}</p>`).join("\n")}
${m.details?.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;background:#f4f4f8;border-radius:12px;">${m.details.map(([k, v]) => `<tr><td style="padding:10px 16px;font-size:14px;color:#64647a;">${esc(k)}</td><td align="right" style="padding:10px 16px;font-size:14px;font-weight:700;color:#17171f;">${esc(v)}</td></tr>`).join("")}</table>` : ""}
${link ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;"><tr><td style="border-radius:999px;background:#0B3D91;"><a href="${esc(link)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${esc(m.button!.label)}</a></td></tr></table>` : ""}
${m.note ? `<p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:#64647a;">${esc(m.note)}</p>` : ""}
</td></tr>
<tr><td style="padding:18px 28px 26px;border-top:1px solid #e3e3ec;font-size:12px;line-height:1.5;color:#8a8aa0;">
You're getting this email because you have an Anchor Bank account. Anchor Bank will never ask for your password or passkey by email.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
  const text = [heading, "", ...m.paragraphs.flatMap((p) => [p, ""]), ...(m.details ?? []).map(([k, v]) => `${k}: ${v}`), ...(m.details?.length ? [""] : []),
    ...(link ? [`${m.button!.label}: ${link}`, ""] : []), ...(m.note ? [m.note, ""] : []), "— Anchor Bank"].join("\n");
  return { html, text };
}

/** Sends one email. Returns true when Resend accepted it. Never throws. */
export async function sendEmail(m: EmailMessage, base = siteUrl()): Promise<boolean> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key || !m.to) return false;
  const { html, text } = renderEmail(m, base);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: from(), to: [m.to], subject: m.subject, html, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.warn("[email] Resend refused:", res.status, (await res.text().catch(() => "")).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.warn("[email] couldn't reach Resend:", (e as Error).message);
    return false;
  }
}
