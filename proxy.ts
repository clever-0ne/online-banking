// Runs before every request.
//  - Customers: signed-out visitors to banking pages go to /login; signed-in visitors skip /login and /signup.
//    A page staff have switched off for this customer shows "Access denied" (403) instead.
//  - Staff: the admin area exists only at the secret ADMIN_PATH, which is rewritten internally to /admin.
//    Visiting /admin directly gives the ordinary "not found" page, so the real address isn't discoverable.
// The protected layouts and every API check sessions again on the server.
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminPath, verifyAdminToken } from "@/lib/server/adminAuth";
import { canUse } from "@/lib/server/permissions";
import { SESSION_COOKIE, verifyToken } from "@/lib/server/session";
import { DENIED_PATH, pageOf } from "@/lib/pages";

const PROTECTED = ["/dashboard", "/activity", "/statements", "/transfer", "/send", "/bills", "/deposit", "/withdraw", "/budget", "/goals", "/credit", "/cards", "/alerts", "/profile"];
const AUTH_PAGES = ["/login", "/signup"];
const under = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + "/");

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // ---- Staff area ----
  const secret = adminPath();
  if (secret && under(pathname, secret)) {
    const rest = pathname.slice(secret.length);
    const isStaff = verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value);
    // Console pages need a staff session; signed-out staff go to the sign-in page (APIs answer 404 themselves).
    if (!isStaff && rest !== "/login" && !under(rest, "/api")) {
      return NextResponse.redirect(new URL(secret + "/login", req.url), { headers: { "Cache-Control": "no-store" } });
    }
    if (isStaff && rest === "/login") return NextResponse.redirect(new URL(secret, req.url));
    const url = req.nextUrl.clone();
    url.pathname = "/admin" + rest;
    const res = NextResponse.rewrite(url);
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
  if (under(pathname, "/admin")) {
    const url = req.nextUrl.clone();
    url.pathname = "/_not-found-anchor";
    return NextResponse.rewrite(url, { status: 404 });
  }

  // ---- Customer area ----
  const session = verifyToken(req.cookies.get(SESSION_COOKIE)?.value);
  const signedIn = session !== null;
  if (PROTECTED.some((p) => under(pathname, p)) && !signedIn) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + search);
    const res = NextResponse.redirect(url);
    if (req.cookies.has(SESSION_COOKIE)) res.cookies.delete(SESSION_COOKIE); // expired or tampered
    return res;
  }
  if (signedIn && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  const page = pageOf(pathname);
  if (session && page && !(await canUse(session.uid, page))) {
    const url = req.nextUrl.clone();
    url.pathname = DENIED_PATH;
    url.search = "";
    return NextResponse.rewrite(url, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  // Everything except static assets; the admin path is only known at runtime.
  matcher: ["/((?!_next/static|_next/image|icon.svg|videos/|favicon.ico|manifest.webmanifest|sw.js|offline.html|icon-|apple-touch-icon|badge-).*)"],
};
