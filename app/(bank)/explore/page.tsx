"use client";

// Explore: global markets today (indexes, commodities, crypto, currencies), market headlines, and what
// customers can do with Anchor.
import Link from "next/link";
import { useEffect, useState } from "react";
import { useBank } from "@/components/BankProvider";
import { ICONS } from "@/components/nav";
import { PageHead } from "@/components/ui";
import type { MarketSnapshot, Quote } from "@/lib/server/markets";

const num = (n: number, digits = 2) => n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 10 ? 4 : 2 });

function ago(iso: string | null) {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} hr ago` : new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="mk-chg muted">—</span>;
  const up = pct >= 0;
  return <span className={`mk-chg ${up ? "pos" : "neg"}`}>{up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%</span>;
}

function QuoteTile({ q }: { q: Quote }) {
  return (
    <div className="mk-tile">
      <span className="mk-name">{q.name}</span>
      <span className="mk-price num">{q.price === null ? "—" : q.unit === "usd" ? usd(q.price) : num(q.price)}</span>
      <Change pct={q.changePct} />
    </div>
  );
}

const FEATURES: [string, string, string, React.ReactNode][] = [
  ["/deposit", "Deposit with a card", "Buy BTC, ETH or USDC with your card and add it to your balance.", ICONS.topup],
  ["/withdraw", "Withdraw to your wallet", "Send money to your own wallet, reviewed by our team.", ICONS.request],
  ["/goals", "Savings goals", "Set money aside in High-Yield Savings and watch it grow.", ICONS.note],
  ["/budget", "Budgets", "See where your money goes and set limits by category.", ICONS.bill],
  ["/credit", "Credit score", "Track your score and what affects it.", ICONS.shield],
  ["/profile", "Passkey sign-in", "Add a passkey so every sign-in needs your fingerprint or face.", ICONS.user],
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

  return (
    <>
      <PageHead title="Explore" sub="Global markets, the latest money news, and more you can do with Anchor." />

      <div className="sec-row"><h2 className="sec-title">Markets today</h2>{data && <span className="muted small">Updated {new Date(data.updatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>}</div>
      {!data ? (
        <section className="panel"><p className="empty">{error ? "Market data isn't available right now. Try again in a few minutes." : "Loading markets…"}</p></section>
      ) : (
        <>
          <div className="mk-grid">{data.indexes.map((q) => <QuoteTile key={q.symbol} q={q} />)}</div>

          <div className="mk-split">
            <section className="panel">
              <div className="side-head"><h2 className="side-title">Crypto</h2>{can("/deposit") && <Link className="more-link" href="/deposit">Deposit</Link>}</div>
              <ul className="mk-list">
                {data.crypto.map((q) => (
                  <li key={q.symbol}><span><b>{q.name}</b><span className="muted small block">{q.symbol}</span></span><span className="mk-right"><span className="num">{q.price === null ? "—" : usd(q.price)}</span><Change pct={q.changePct} /></span></li>
                ))}
                {data.commodities.map((q) => (
                  <li key={q.symbol}><span><b>{q.name}</b><span className="muted small block">{q.symbol === "GC=F" ? "per ounce" : "per barrel"}</span></span><span className="mk-right"><span className="num">{q.price === null ? "—" : usd(q.price)}</span><Change pct={q.changePct} /></span></li>
                ))}
              </ul>
            </section>
            <section className="panel">
              <h2 className="side-title">Currencies</h2>
              <ul className="mk-list">
                {data.rates.map((r) => (
                  <li key={r.code}><span><b>{r.code}</b><span className="muted small block">{r.name}</span></span><span className="num">1 USD = {num(r.perUsd, r.perUsd >= 100 ? 0 : 4)}</span></li>
                ))}
              </ul>
            </section>
          </div>

          <div className="sec-row"><h2 className="sec-title">Market news</h2></div>
          <section className="panel flush">
            {data.news.length === 0 ? <p className="empty">No headlines right now.</p> : (
              <ul className="news-list">
                {data.news.map((n) => (
                  <li key={n.link}>
                    <a href={n.link} target="_blank" rel="noopener noreferrer">
                      <b>{n.title}</b>
                      <span className="muted small">{n.source}{n.at ? ` · ${ago(n.at)}` : ""}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="hint">Market data may be delayed and is for information only, not investment advice. Headlines link to the publishers&apos; own sites.</p>
        </>
      )}

      <div className="sec-row"><h2 className="sec-title">Explore Anchor</h2></div>
      <div className="feat-grid">
        {FEATURES.filter(([href]) => can(href)).map(([href, title, body, icon]) => (
          <Link key={href} href={href} className="feat-card">
            <span className="quick-ico">{icon}</span>
            <b>{title}</b>
            <span className="muted">{body}</span>
            <span className="more-link">Get started</span>
          </Link>
        ))}
      </div>
    </>
  );
}
