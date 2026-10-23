import { NextResponse, type NextRequest } from "next/server";
import { COUNTRIES, DEFAULT_LOCALE, type VisitorLocale } from "@/lib/locale";

// The visitor's country from the host's location header (Vercel, Cloudflare, CloudFront), or the region in their
// browser language as a fallback; then that country's language, currency and today's exchange rate from USD.

type Rates = { at: number; date: string | null; rates: Record<string, number> };
const g = globalThis as unknown as { __anchorRates?: Rates };
const SIX_HOURS = 6 * 60 * 60 * 1000;

async function usdRates(): Promise<Rates | null> {
  if (g.__anchorRates && Date.now() - g.__anchorRates.at < SIX_HOURS) return g.__anchorRates;
  try {
    // Free daily rates, no key needed. Attribution: https://www.exchangerate-api.com
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(5000), cache: "no-store" });
    const d = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
    if (d.result !== "success" || !d.rates) throw new Error("no rates");
    return (g.__anchorRates = { at: Date.now(), date: d.time_last_update_utc ?? null, rates: d.rates });
  } catch {
    return g.__anchorRates ?? null; // keep using the last good rates if the service is down
  }
}

function countryOf(req: NextRequest): string | null {
  const h = req.headers;
  const fromHost = h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry") ?? h.get("cloudfront-viewer-country") ?? h.get("x-country-code");
  if (fromHost && /^[A-Z]{2}$/i.test(fromHost) && fromHost.toUpperCase() !== "XX") return fromHost.toUpperCase();
  // Fallback: the region in the browser's first language, e.g. "fr-CA" → CA.
  const m = (h.get("accept-language") ?? "").match(/^[a-z]{2,3}-([A-Z]{2})/i);
  return m ? m[1].toUpperCase() : null;
}

export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country")?.toUpperCase() || countryOf(req);
  const [language, currency] = (country && COUNTRIES[country]) || ["en", "USD"];
  let out: VisitorLocale = { ...DEFAULT_LOCALE, country, language };
  if (currency !== "USD") {
    const r = await usdRates();
    const rate = r?.rates[currency];
    if (rate && rate > 0) out = { ...out, currency, rate, ratesDate: r!.date };
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "private, max-age=3600" } });
}
