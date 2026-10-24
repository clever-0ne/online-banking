// Global market snapshot for the Explore page: major stock indexes and commodities (Yahoo Finance chart data),
// crypto prices (CoinGecko), exchange rates (open.er-api.com) and market headlines (publishers' RSS feeds).
// Fetched on the server, kept for 10 minutes, and each part fails on its own without breaking the page.

export interface Quote { symbol: string; name: string; price: number | null; changePct: number | null; unit: "points" | "usd"; spark: number[] }
export interface Rate { code: string; name: string; perUsd: number }
export interface Headline { title: string; link: string; source: string; at: string | null; image: string | null }
export interface MarketSnapshot { indexes: Quote[]; commodities: Quote[]; crypto: Quote[]; rates: Rate[]; news: Headline[]; updatedAt: string }

const TEN_MIN = 10 * 60 * 1000;
const g = globalThis as unknown as { __anchorMarkets2?: { at: number; data: MarketSnapshot } };
const UA = "Mozilla/5.0 (compatible; AnchorBank/1.0)";

const INDEXES: [string, string][] = [["^GSPC", "S&P 500"], ["^DJI", "Dow Jones"], ["^IXIC", "Nasdaq"], ["^FTSE", "FTSE 100"], ["^GDAXI", "DAX"], ["^N225", "Nikkei 225"], ["^HSI", "Hang Seng"]];
const COMMODITIES: [string, string][] = [["GC=F", "Gold"], ["CL=F", "Crude oil"]];
const RATES: [string, string][] = [["EUR", "Euro"], ["GBP", "British pound"], ["JPY", "Japanese yen"], ["CAD", "Canadian dollar"], ["CNY", "Chinese yuan"], ["INR", "Indian rupee"], ["NGN", "Nigerian naira"], ["BRL", "Brazilian real"]];
const FEEDS: [string, string][] = [
  ["https://www.ft.com/markets?format=rss", "Financial Times"],
  ["https://feeds.content.dowjones.io/public/rss/mw_topstories", "MarketWatch"],
  ["https://feeds.bbci.co.uk/news/business/rss.xml", "BBC News"],
];

async function get(url: string): Promise<Response> {
  return fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6000), cache: "no-store" });
}

async function yahoo([symbol, name]: [string, string], unit: Quote["unit"]): Promise<Quote> {
  try {
    const d = await (await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`)).json();
    const m = d?.chart?.result?.[0]?.meta;
    const price = typeof m?.regularMarketPrice === "number" ? m.regularMarketPrice : null;
    const prev = typeof m?.chartPreviousClose === "number" ? m.chartPreviousClose : typeof m?.previousClose === "number" ? m.previousClose : null;
    const changePct = typeof m?.regularMarketChangePercent === "number" ? m.regularMarketChangePercent : price !== null && prev ? ((price - prev) / prev) * 100 : null;
    const closes: unknown[] = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    const spark = closes.filter((c): c is number => typeof c === "number");
    return { symbol, name, price, changePct, unit, spark };
  } catch {
    return { symbol, name, price: null, changePct: null, unit, spark: [] };
  }
}

async function crypto(): Promise<Quote[]> {
  const coins: [string, string, string][] = [["bitcoin", "BTC", "Bitcoin"], ["ethereum", "ETH", "Ether"], ["usd-coin", "USDC", "USD Coin"]];
  try {
    const d = await (await get(`https://api.coingecko.com/api/v3/simple/price?ids=${coins.map((c) => c[0]).join(",")}&vs_currencies=usd&include_24hr_change=true`)).json();
    return coins.map(([id, symbol, name]) => ({ symbol, name, price: d?.[id]?.usd ?? null, changePct: d?.[id]?.usd_24h_change ?? null, unit: "usd" as const, spark: [] }));
  } catch {
    return coins.map(([, symbol, name]) => ({ symbol, name, price: null, changePct: null, unit: "usd" as const, spark: [] }));
  }
}

async function rates(): Promise<Rate[]> {
  try {
    const d = await (await get("https://open.er-api.com/v6/latest/USD")).json();
    return RATES.filter(([c]) => d?.rates?.[c]).map(([code, name]) => ({ code, name, perUsd: d.rates[code] }));
  } catch {
    return [];
  }
}

const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).trim();
const tag = (item: string, name: string) => { const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1]) : ""; };

// A story's picture from media:thumbnail, media:content or an enclosure; BBC's small thumbnails are swapped for a larger size.
function image(item: string): string | null {
  const m = item.match(/<(?:media:thumbnail|media:content|enclosure)[^>]*\burl="(https:\/\/[^"]+)"/);
  return m ? decode(m[1]).replace(/(ichef\.bbci\.co\.uk\/ace\/standard\/)\d+\//, "$1800/") : null;
}

async function feed([url, source]: [string, string]): Promise<Headline[]> {
  try {
    const xml = await (await get(url)).text();
    return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)].slice(0, 8).map(([item]) => {
      const date = tag(item, "pubDate");
      const t = date ? new Date(date) : null;
      return { title: tag(item, "title"), link: tag(item, "link"), source, at: t && !isNaN(t.getTime()) ? t.toISOString() : null, image: image(item) };
    }).filter((h) => h.title && /^https:\/\//.test(h.link));
  } catch {
    return [];
  }
}

export async function marketSnapshot(): Promise<MarketSnapshot> {
  if (g.__anchorMarkets2 && Date.now() - g.__anchorMarkets2.at < TEN_MIN) return g.__anchorMarkets2.data;
  const [indexes, commodities, coins, fx, feeds] = await Promise.all([
    Promise.all(INDEXES.map((i) => yahoo(i, "points"))),
    Promise.all(COMMODITIES.map((c) => yahoo(c, "usd"))),
    crypto(),
    rates(),
    Promise.all(FEEDS.map(feed)),
  ]);
  const seen = new Set<string>();
  const news = feeds.flat()
    .filter((h) => { const k = h.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""))
    .slice(0, 14);
  const data: MarketSnapshot = { indexes, commodities, crypto: coins, rates: fx, news, updatedAt: new Date().toISOString() };
  // Don't keep a snapshot where everything failed; try again next time.
  if (indexes.some((q) => q.price !== null) || news.length) g.__anchorMarkets2 = { at: Date.now(), data };
  return data;
}
