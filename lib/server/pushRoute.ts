// The push-subscription endpoints, shared by customers (/api/push) and staff (<ADMIN_PATH>/api/push).
import { NextResponse, type NextRequest } from "next/server";
import { error, sameOrigin } from "./http";
import { deviceName, isSubscribed, notifyDevice, parseSubscription, publicKey, pushConfigured, removeSubscription, saveSubscription } from "./push";

type Who = { audience: "customer" | "staff"; userId: string | null };
type Resolve = () => Promise<Who | NextResponse>;

const device = (req: NextRequest) => deviceName(req.headers.get("user-agent"));

export function pushRoutes(resolve: Resolve, welcome: { title: string; body: string; url: string }) {
  /** The key browsers subscribe with, and whether this device (?endpoint=) is already on. */
  async function GET(req: NextRequest) {
    const who = await resolve();
    if (who instanceof NextResponse) return who;
    const endpoint = req.nextUrl.searchParams.get("endpoint");
    return NextResponse.json({
      available: pushConfigured(),
      publicKey: publicKey(),
      subscribed: endpoint ? await isSubscribed(endpoint, who.audience, who.userId) : false,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  /** Turns notifications on for this device. Body: { subscription } from PushManager.subscribe(). */
  async function POST(req: NextRequest) {
    if (!sameOrigin(req)) return error("Request blocked.", 403);
    const who = await resolve();
    if (who instanceof NextResponse) return who;
    if (!pushConfigured()) return error("Notifications aren't set up on this server yet.", 503);
    const body = await req.json().catch(() => null);
    const sub = parseSubscription(body?.subscription);
    if (!sub) return error("That subscription isn't valid.", 400);
    await saveSubscription(sub, who.audience, who.userId, device(req));
    await notifyDevice(sub.endpoint, { ...welcome, tag: "welcome" });
    return NextResponse.json({ ok: true });
  }

  /** Turns notifications off for this device. Body: { endpoint }. */
  async function DELETE(req: NextRequest) {
    if (!sameOrigin(req)) return error("Request blocked.", 403);
    const who = await resolve();
    if (who instanceof NextResponse) return who;
    const body = await req.json().catch(() => null);
    if (typeof body?.endpoint === "string") await removeSubscription(body.endpoint, who.audience, who.userId);
    return NextResponse.json({ ok: true });
  }

  return { GET, POST, DELETE };
}
