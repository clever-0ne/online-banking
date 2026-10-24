"use client";

// Explore: global markets today (indexes with 1-month trend lines, crypto, commodities, currencies), market
// headlines with their pictures, and what customers can do with Anchor.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useBank } from "@/components/BankProvider";
import { ICONS } from "@/components/nav";
import type { Headline, MarketSnapshot, Quote } from "@/lib/server/markets";

const num = (n: number, digits = 2) => n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 10 ? 4 : 2 });
const price = (q: Quote) => (q.price === null ? "—" : q.unit === "usd" ? usd(q.price) : num(q.price));

function ago(iso: string | null) {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} hr ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="mk-pill">—</span>;
  const up = pct >= 0;
  return <span className={`mk-pill ${up ? "up" : "down"}`}>{up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%</span>;
}

// A small trend line with a soft fill, green when the period ended higher, red when lower.
function Spark({ data, id }: { data: number[]; id: string }) {
  if (data.length < 2) return <div className="mk-spark" />;
  const w = 160, h = 48, min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 4 - ((v - min) / span) * (h - 8)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const up = data[data.length - 1] >= data[0];
  const gid = `sg-${id.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg className={`mk-spark ${up ? "up" : "down"}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".28" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const COIN_COLORS: Record<string, string> = { BTC: "#F7931A", ETH: "#627EEA", USDC: "#2775CA", "GC=F": "#D4A017", "CL=F": "#3A3A55" };
const FLAGS: Record<string, string> = { EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵", CAD: "🇨🇦", CNY: "🇨🇳", INR: "🇮🇳", NGN: "🇳🇬", BRL: "🇧🇷" };

function Story({ n, lead }: { n: Headline; lead?: boolean }) {
  return (
    <a className={`story${lead ? " lead" : ""}`} href={n.link} target="_blank" rel="noopener noreferrer">
      <span className="story-img" data-src={n.source}>
        {n.image ? <img src={n.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => e.currentTarget.remove()} /> : <span className="story-ph">{n.source}</span>}
      </span>
      <span className="story-body">
        <span className="story-src">{n.source}{n.at ? ` · ${ago(n.at)}` : ""}</span>
        <b>{n.title}</b>
      </span>
    </a>
  );
}

const FEATURES: [string, string, string, React.ReactNode, string][] = [
  ["/deposit", "Deposit with a card", "Buy BTC, ETH or USDC with your card and add it to your balance.", ICONS.topup, "violet"],
  ["/withdraw", "Withdraw to your wallet", "Send money to your own wallet, reviewed by our team.", ICONS.request, "blue"],
  ["/goals", "Savings goals", "Set money aside in High-Yield Savings and watch it grow.", ICONS.note, "green"],
  ["/budget", "Budgets", "See where your money goes and set limits by category.", ICONS.bill, "amber"],
  ["/credit", "Credit score", "Track your score and what affects it.", ICONS.shield, "pink"],
  ["/profile", "Passkey sign-in", "Add a passkey so every sign-in needs your fingerprint or face.", ICONS.user, "teal"],
];

export default function ExplorePage() {
  const { can } = useBank();
  const [data, setData] = useState<MarketSnapshot | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let stop = false;
    const load = () => fetch("/api/markets", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: MarketSnapshot) => { if (!stop) { setData(d); setError(false); } })
      .catch(() => { if (!stop) setError(true); });
    void load();
    const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 5 * 60 * 1000);
    return () => { stop = true; clearInterval(t); };
  }, []);

  // Lead with a story that has a picture; the rest follow newest first.
  const news = data?.news ?? [];
  const lead = news.find((n) => n.image) ?? news[0];
  const rest = news.filter((n) => n !== lead);
  const ticker = data ? [...data.indexes, ...data.commodities, ...data.crypto].filter((q) => q.price !== null) : [];

  return (
    <div className="explore">
      <section className="ex-hero">
        <div className="ex-hero-copy">
          <span className="ex-eyebrow">Explore</span>
          <h1>The world&apos;s markets, at a glance</h1>
          <p>Live indexes, crypto and currencies, the day&apos;s money news, and more you can do with Anchor.</p>
        </div>
        <svg className="ex-hero-art" viewBox="0 0 400 160" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0,130 C40,120 60,90 100,96 C140,102 150,60 190,64 C230,68 240,30 280,38 C320,46 340,14 400,10 L400,160 L0,160 Z" fill="rgb(255 255 255 / .12)" />
          <path d="M0,130 C40,120 60,90 100,96 C140,102 150,60 190,64 C230,68 240,30 280,38 C320,46 340,14 400,10" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="2.5" />
        </svg>
        {ticker.length > 0 && (
          <div className="ex-ticker" aria-label="Market ticker">
            <div className="ex-ticker-run">
              {[...ticker, ...ticker].map((q, i) => (
                <span key={i} aria-hidden={i >= ticker.length}>
                  <b>{q.name}</b> {price(q)} <em className={q.changePct !== null && q.changePct < 0 ? "down" : "up"}>{q.changePct === null ? "" : `${q.changePct >= 0 ? "▲" : "▼"} ${Math.abs(q.changePct).toFixed(2)}%`}</em>
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="sec-row"><h2 className="sec-title">Markets today</h2>{data && <span className="muted small">Updated {new Date(data.updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>}</div>
      {!data ? (
        <section className="panel"><p className="empty">{error ? "Market data isn't available right now. Try again in a few minutes." : "Loading markets…"}</p></section>
      ) : (
        <>
          <div className="mk-grid">
            {data.indexes.map((q) => (
              <div className="mk-tile" key={q.symbol}>
                <div className="mk-top"><span className="mk-name">{q.name}</span><Change pct={q.changePct} /></div>
                <span className="mk-price num">{price(q)}</span>
                <Spark data={q.spark} id={q.symbol} />
                <span className="mk-foot">Past month</span>
              </div>
            ))}
          </div>

          <div className="mk-split">
            <section className="panel mk-panel">
              <div className="side-head"><h2 className="side-title">Crypto &amp; commodities</h2>{can("/deposit") && <Link className="more-link" href="/deposit">Buy crypto</Link>}</div>
              <ul className="mk-list">
                {[...data.crypto, ...data.commodities].map((q) => (
                  <li key={q.symbol}>
                    <span className="mk-who">
                      <span className="mk-badge" style={{ background: COIN_COLORS[q.symbol] ?? "var(--accent)" }}>{q.symbol === "GC=F" ? "Au" : q.symbol === "CL=F" ? "Oil" : q.symbol.slice(0, 3)}</span>
                      <span><b>{q.name}</b><span className="muted small block">{q.symbol === "GC=F" ? "per ounce" : q.symbol === "CL=F" ? "per barrel" : q.symbol}</span></span>
                    </span>
                    <span className="mk-right"><span className="num">{price(q)}</span><Change pct={q.changePct} /></span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="panel mk-panel">
              <div className="side-head"><h2 className="side-title">Currencies</h2><span className="muted small">per 1 US dollar</span></div>
              <ul className="mk-list">
                {data.rates.map((r) => (
                  <li key={r.code}>
                    <span className="mk-who"><span className="mk-flag" aria-hidden="true">{FLAGS[r.code] ?? "💱"}</span><span><b>{r.code}</b><span className="muted small block">{r.name}</span></span></span>
                    <span className="num mk-rate">{num(r.perUsd, r.perUsd >= 100 ? 0 : 4)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="sec-row"><h2 className="sec-title">Market news</h2></div>
          {!lead ? <section className="panel"><p className="empty">No headlines right now.</p></section> : (
            <div className="news-grid">
              <Story n={lead} lead />
              {rest.map((n) => <Story key={n.link} n={n} />)}
            </div>
          )}
          <p className="hint">Market data may be delayed and is for information only, not investment advice. Headlines and pictures link to the publishers&apos; own sites.</p>
        </>
      )}

      <div className="sec-row"><h2 className="sec-title">Explore Anchor</h2></div>
      <div className="feat-grid">
        {FEATURES.filter(([href]) => can(href)).map(([href, title, body, icon, tone]) => (
          <Link key={href} href={href} className={`feat-card tone-${tone}`}>
            <span className="feat-ico">{icon}</span>
            <b>{title}</b>
            <span className="muted">{body}</span>
            <span className="feat-go">Get started →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
