// The site's public address, used for passkeys. It comes from the request (the host the browser actually used),
// so passkeys keep working even if APP_ORIGIN is missing or wrong; APP_ORIGIN is only used when it matches.
// Server only.

type HeaderLike = { get(name: string): string | null };

export interface SiteOrigin {
  origin: string; // e.g. https://anchorbank.com
  rpID: string; // e.g. anchorbank.com
  secure: boolean; // passkeys and notifications need https (or localhost)
  /** APP_ORIGIN as set, when it's set. */
  configured: string | null;
  /** Why APP_ORIGIN was ignored, if it was. */
  problem: string | null;
}

export function siteOrigin(headers: HeaderLike, fallbackProto = "https"): SiteOrigin {
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost").split(",")[0].trim();
  const proto = (headers.get("x-forwarded-proto") ?? fallbackProto).split(",")[0].trim();
  let origin = `${proto}://${host}`;
  const configured = process.env.APP_ORIGIN?.trim() || null;
  let problem: string | null = null;
  if (configured) {
    try {
      const u = new URL(configured);
      if (u.host === host) origin = u.origin;
      else problem = `APP_ORIGIN is ${u.origin}, but this site is being opened at ${origin}. Passkeys use ${origin}.`;
    } catch {
      problem = `APP_ORIGIN "${configured}" isn't a full address. Use the form https://yourbank.com.`;
    }
  }
  const hostname = new URL(origin).hostname;
  const secure = origin.startsWith("https://") || hostname === "localhost" || hostname === "127.0.0.1";
  return { origin, rpID: hostname, secure, configured, problem };
}
