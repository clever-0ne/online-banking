import { existsSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { Aurora } from "@/components/landing/Aurora";
import { LandingMotion } from "@/components/landing/LandingMotion";
import { LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { currentUser } from "@/lib/server/current";
import "./landing.css";

export const dynamic = "force-dynamic";

const ico = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const I = {
  send: ico(<><path d="M21 3 10 14" /><path d="M21 3l-7 18-4-7-7-4z" /></>),
  chart: ico(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />),
  card: ico(<><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19" /></>),
  bill: ico(<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h4" /></>),
  goal: ico(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></>),
  check: ico(<><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 14h6M16 10h1" /></>),
  lock: ico(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  key: ico(<><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3" /></>),
  eye: ico(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  bell: ico(<><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
  tick: ico(<path d="M5 12.5l4.5 4.5L19 7.5" />),
  arrow: ico(<path d="M5 12h14M13 6l6 6-6 6" />),
};

const MARQUEE = ["Instant transfers", "No monthly fees", "3.75% APY savings", "Card lock in one tap", "Bill pay & autopay", "Mobile check deposit", "Spending insights", "Savings goals", "Credit score tracking", "Real-time alerts"];

const FAQ = [
  ["How long does opening an account take?", "About a minute. You need your name, email, a mobile number and a password. Your checking and savings accounts open right away."],
  ["What does it cost?", "Everyday is free with no monthly fee. Plus adds a higher savings rate and extras for $6 a month. You can switch any time."],
  ["How is my account protected?", "Passwords are hashed and never stored in plain text, sessions use signed cookies your browser's scripts can't read, and repeated wrong passwords pause sign-in."],
  ["Can I lock my card if I lose it?", "Yes. Turn any card off instantly from Cards, block online or international use, set daily limits, or report it lost to get a new number."],
  ["How do I add money?", "Deposit a check from the app, or move money in from an account you have at another bank. Your balance updates as soon as it clears."],
  ["Can I close my account?", "Yes, any time, at no cost. Contact support and we’ll walk you through moving your money out."],
];

export default async function Landing() {
  const user = await currentUser();
  const hasVideo = existsSync(path.join(process.cwd(), "public", "videos", "hero.mp4"));
  const primaryHref = user ? "/dashboard" : "/signup";
  const words = ["Banking", "that", "moves", "at", "your", "speed."];

  return (
    <div className="lp">
      <LandingMotion />
      <div className="lp-progress" aria-hidden="true" />

      {/* ---------- Nav ---------- */}
      <header className="lp-nav">
        <div className="lp-nav-in">
          <Link href="/" className="lp-brand"><LogoMark size={32} /><span>Anchor</span></Link>
          <nav className="lp-links" aria-label="Sections">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#security">Security</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="lp-cta">
            <ThemeToggle />
            {user ? (
              <Link className="btn small" href="/dashboard">Go to dashboard</Link>
            ) : (
              <>
                <Link className="lp-signin" href="/login">Sign in</Link>
                <Link className="btn small shine" href="/signup">Open account</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="lp-hero">
        <div className="hero-media" aria-hidden="true">
          <Aurora />
          {hasVideo && <video className="hero-video" src="/videos/hero.mp4" autoPlay muted loop playsInline preload="auto" />}
          <div className="hero-grid" />
          <div className="hero-vignette" />
        </div>

        <div className="lp-wrap hero-in">
          <div className="hero-copy">
            <span className="lp-tag" data-reveal><span className="tag-dot" />New · Instant transfers with no fees</span>
            <h1 className="hero-title" aria-label={words.join(" ")}>
              {words.map((w, i) => (
                <span key={i} className={`word${i >= 2 ? " grad" : ""}`} style={{ animationDelay: `${150 + i * 90}ms` }} aria-hidden="true">{w}&nbsp;</span>
              ))}
            </h1>
            <p className="hero-sub" data-reveal data-delay="500">Checking, savings, cards and payments in one calm place. Open an account in a minute, send money in seconds, and see exactly where it goes.</p>
            <div className="hero-actions" data-reveal data-delay="650">
              <Link className="btn big shine" href={primaryHref}>{user ? "Open your dashboard" : "Open a free account"}{I.arrow}</Link>
              {!user && <Link className="btn ghost big" href="/login">Sign in</Link>}
            </div>
            <ul className="hero-points" data-reveal data-delay="800">
              <li>{I.tick}No monthly fees</li><li>{I.tick}3.75% APY savings</li><li>{I.tick}Card lock in one tap</li>
            </ul>
          </div>

          <div className="hero-device" data-reveal data-delay="300">
            <div className="device-glow" aria-hidden="true" />
            <div className="phone" data-tilt aria-hidden="true">
              <div className="phone-notch" />
              <div className="phone-head"><span className="ph-av">JE</span><div><small>Welcome back,</small><b>Jordan</b></div></div>
              <div className="phone-card">
                <span>Current balance</span>
                <b data-count="6743.38" data-decimals="2" data-prefix="$">$6,743.38</b>
                <span className="pan">•••• •••• •••• 4417</span>
              </div>
              <div className="phone-actions">{["Top up", "Send", "Request", "More"].map((a) => <span key={a}><i />{a}</span>)}</div>
              <div className="phone-rows">
                {[["Northwind Logistics", "+$2,486.12", true], ["Whole Foods", "−$73.81", false], ["Spotify", "−$11.99", false]].map(([n, a, pos], k) => (
                  <div key={n as string} style={{ animationDelay: `${900 + k * 140}ms` }}><i /><span>{n}</span><b className={pos ? "pos" : ""}>{a}</b></div>
                ))}
              </div>
            </div>
            <div className="float-chip glass one" data-parallax="-0.06"><span className="chip-ico ok">{I.tick}</span><div><b>Sent $25.00</b><small>to Maya · just now</small></div></div>
            <div className="float-chip glass two" data-parallax="-0.12"><span className="chip-ico">{I.chart}</span><div><b>Credit score 742</b><small>Up 38 points this year</small></div></div>
            <div className="float-chip glass three" data-parallax="-0.03"><span className="chip-ico lock">{I.lock}</span><div><b>Card locked</b><small>Debit ••4417</small></div></div>
          </div>
        </div>

        <a className="scroll-cue" href="#features" aria-label="Scroll to features"><span /></a>
      </section>

      {/* ---------- Marquee ---------- */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...MARQUEE, ...MARQUEE].map((m, i) => <span key={i}><LogoMark size={18} />{m}</span>)}
        </div>
      </div>

      <main className="lp-wrap lp-main">
        {/* ---------- Stats ---------- */}
        <section className="lp-stats glass" data-reveal>
          <div><b data-count="60" data-suffix=" sec">60 sec</b><span>to open an account</span></div>
          <div><b data-count="0" data-prefix="$">$0</b><span>monthly fees on Everyday</span></div>
          <div><b data-count="3.75" data-decimals="2" data-suffix="%">3.75%</b><span>APY on savings</span></div>
          <div><b data-count="24" data-suffix="/7">24/7</b><span>card controls</span></div>
        </section>

        {/* ---------- Features ---------- */}
        <section id="features" className="lp-section">
          <div className="sec-intro" data-reveal>
            <span className="eyebrow">Features</span>
            <h2>Everything your bank should do. <span className="grad-text">Nothing it shouldn&apos;t.</span></h2>
            <p>One app for everyday money, from the paycheck to the bills to the trip you&apos;re saving for.</p>
          </div>
          <div className="bento-lp">
            <article className="fcard spot wide" data-reveal>
              <div className="fcard-copy"><span className="f-ico">{I.send}</span><h3>Send money in seconds</h3><p>Pay friends with just an email or mobile number. Get a receipt you can share.</p></div>
              <div className="viz viz-send" aria-hidden="true"><span className="av a">JE</span><span className="track"><i /></span><span className="av b">MC</span><span className="amt">$25.00</span></div>
            </article>
            <article className="fcard spot" data-reveal data-delay="80">
              <span className="f-ico">{I.chart}</span><h3>See where it goes</h3><p>Spending by category and cash-flow charts that update as you spend.</p>
              <div className="viz viz-bars" aria-hidden="true">{[48, 72, 56, 90, 64, 80, 40].map((h, i) => <i key={i} style={{ "--h": `${h}%`, animationDelay: `${i * 90}ms` } as React.CSSProperties} />)}</div>
            </article>
            <article className="fcard spot" data-reveal data-delay="160">
              <span className="f-ico">{I.card}</span><h3>Card controls</h3><p>Turn a card off, block online or international use, set daily limits.</p>
              <div className="viz viz-toggle" aria-hidden="true"><span className="mini-card" /><span className="tgl"><i /></span></div>
            </article>
            <article className="fcard spot" data-reveal>
              <span className="f-ico">{I.bill}</span><h3>Bills on autopilot</h3><p>Schedule one-time or monthly payments and get a heads-up first.</p>
              <div className="viz viz-cal" aria-hidden="true">{["1", "5", "12", "18", "22", "28"].map((d, i) => <span key={d} className={i === 3 ? "on" : ""}>{d}</span>)}</div>
            </article>
            <article className="fcard spot" data-reveal data-delay="80">
              <span className="f-ico">{I.goal}</span><h3>Savings goals</h3><p>Set money aside for what matters and see what to save each month.</p>
              <div className="viz viz-ring" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" /><circle className="prog" cx="32" cy="32" r="26" pathLength={100} /></svg><b>80%</b></div>
            </article>
            <article className="fcard spot wide" data-reveal>
              <div className="fcard-copy"><span className="f-ico">{I.check}</span><h3>Deposit and withdraw</h3><p>Add money with a card or from your own wallet, and withdraw to it. Every request is reviewed by our team.</p></div>
              <div className="viz viz-scan" aria-hidden="true"><span className="chq"><i /><i /><i /></span><span className="beam" /></div>
            </article>
            <article className="fcard spot" data-reveal data-delay="120">
              <span className="f-ico">{I.bell}</span><h3>Real-time alerts</h3><p>Large purchases, deposits and low balances, the moment they happen.</p>
              <div className="viz viz-alerts" aria-hidden="true">
                <span className="note n1"><i className="ok" />Deposit · +$2,486.12</span>
                <span className="note n2"><i />Large purchase · $182.28</span>
                <span className="note n3"><i className="warn" />Low balance alert</span>
              </div>
            </article>
          </div>
        </section>

        {/* ---------- Showcase ---------- */}
        <section className="lp-section showcase">
          <div className="sec-intro" data-reveal>
            <span className="eyebrow">The app</span>
            <h2>Built for the way you <span className="grad-text">actually use money.</span></h2>
          </div>
          <div className="show-grid">
            <div className="show-steps">
              {[
                ["See everything at a glance", "Balances, upcoming bills, budgets and your credit score on one dashboard, in light or dark."],
                ["Pay anyone in three taps", "Pick a person, type the amount on the keypad, send. A receipt is ready to share."],
                ["Stay in control", "Lock a card the moment something looks off. Unlock it just as fast."],
              ].map(([t, d], i) => (
                <div key={t} className={`show-step${i === 0 ? " active" : ""}`} data-step={i}>
                  <span className="step-n">0{i + 1}</span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              ))}
            </div>
            <div className="show-device" data-showcase="0">
              <div className="phone big" aria-hidden="true">
                <div className="phone-notch" />
                <div className="screen s0">
                  <div className="phone-card"><span>Available</span><b>$25,218.71</b><span className="pan">Checking · Savings</span></div>
                  <div className="mini-bars">{[30, 55, 40, 75, 50, 85, 60, 70].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
                  <div className="phone-rows"><div><i /><span>Rent · Nov 1</span><b>$1,850</b></div><div><i /><span>Xfinity · Nov 18</span><b>$79.99</b></div></div>
                </div>
                <div className="screen s1">
                  <div className="recip"><span className="ph-av">MC</span><div><b>Maya Chen</b><small>maya.chen@example.com</small></div></div>
                  <div className="lp-amt">$25.00</div>
                  <div className="lp-pad">{["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"].map((k) => <span key={k}>{k}</span>)}</div>
                  <div className="send-btn">Send Money</div>
                </div>
                <div className="screen s2">
                  <div className="lock-card"><span>Anchor debit</span><b>•••• 4417</b><span className="lock-badge">{I.lock}Locked</span></div>
                  <div className="ctrl"><span>Online purchases</span><i className="lsw off" /></div>
                  <div className="ctrl"><span>International</span><i className="lsw off" /></div>
                  <div className="ctrl"><span>Tap to pay</span><i className="lsw" /></div>
                  <div className="report-btn">Report lost or stolen</div>
                  <div className="phone-rows"><div><i /><span>Declined · Online store</span><b>$129.00</b></div><div><i /><span>Spotify · Oct 15</span><b>$11.99</b></div></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how" className="lp-section">
          <div className="sec-intro" data-reveal>
            <span className="eyebrow">How it works</span>
            <h2>Open an account in <span className="grad-text">about a minute.</span></h2>
          </div>
          <ol className="how">
            {[
              ["Tell us about you", "Name, email and mobile number. That's it."],
              ["Set a strong password", "We check it as you type and store only a secure hash."],
              ["Start banking", "Your dashboard is ready. Add money and you’re set."],
            ].map(([t, d], i) => (
              <li key={t} className="how-step glass spot" data-reveal data-delay={String(i * 120)}>
                <span className="how-n">{i + 1}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- Security ---------- */}
        <section id="security" className="lp-section sec-block glass" data-reveal>
          <div className="shield-viz" aria-hidden="true">
            <span className="orbit o1" /><span className="orbit o2" /><span className="orbit o3" />
            <LogoMark size={120} />
          </div>
          <div>
            <span className="eyebrow">Security</span>
            <h2>Protected at every step.</h2>
            <p className="muted">Your dashboard only opens after you sign in, and every request is checked again on the server.</p>
            <ul className="sec-grid">
              <li><span className="f-ico">{I.key}</span><div><b>Hashed passwords</b><span>Stored with scrypt and a unique salt, never in plain text.</span></div></li>
              <li><span className="f-ico">{I.lock}</span><div><b>Signed sessions</b><span>An httpOnly cookie that page scripts can&apos;t read.</span></div></li>
              <li><span className="f-ico">{I.eye}</span><div><b>Lockout on guessing</b><span>Five wrong passwords pause sign-in for a minute.</span></div></li>
              <li><span className="f-ico">{I.bell}</span><div><b>Instant alerts</b><span>Large purchases, new devices and low balances, as they happen.</span></div></li>
            </ul>
          </div>
        </section>

        {/* ---------- Pricing ---------- */}
        <section id="pricing" className="lp-section">
          <div className="sec-intro" data-reveal>
            <span className="eyebrow">Pricing</span>
            <h2>Simple plans. <span className="grad-text">No surprises.</span></h2>
          </div>
          <div className="plans">
            <article className="plan glass spot" data-reveal>
              <h3>Everyday</h3>
              <p className="muted">All the essentials.</p>
              <div className="price"><b>$0</b><span>/month</span></div>
              <ul>{["Checking and savings", "3.75% APY on savings", "Debit card with full controls", "Send money and bill pay", "Budgets and goals"].map((f) => <li key={f}>{I.tick}{f}</li>)}</ul>
              <Link className="btn ghost wide" href={primaryHref}>Get Everyday</Link>
            </article>
            <article className="plan glass spot featured" data-reveal data-delay="120">
              <span className="plan-tag">Most popular</span>
              <h3>Plus</h3>
              <p className="muted">For people who want more from their money.</p>
              <div className="price"><b>$6</b><span>/month</span></div>
              <ul>{["Everything in Everyday", "4.25% APY on savings", "Cash Back Visa at 2%", "No foreign transaction fees", "Priority support"].map((f) => <li key={f}>{I.tick}{f}</li>)}</ul>
              <Link className="btn wide shine" href={primaryHref}>Get Plus</Link>
            </article>
          </div>
        </section>

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="lp-section faq">
          <div className="sec-intro" data-reveal>
            <span className="eyebrow">FAQ</span>
            <h2>Questions, answered.</h2>
          </div>
          <div className="faq-list">
            {FAQ.map(([q, a], i) => (
              <details key={q} className="glass" data-reveal data-delay={String(i * 60)}>
                <summary>{q}<span className="plus" aria-hidden="true" /></summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className="final-cta" data-reveal>
          <div className="final-glow" aria-hidden="true" />
          <LogoMark size={56} />
          <h2>Drop anchor on better banking.</h2>
          <p>Open an account in a minute. No monthly fees on Everyday.</p>
          <div className="hero-actions">
            <Link className="btn big shine" href={primaryHref}>{user ? "Go to dashboard" : "Open a free account"}{I.arrow}</Link>
            {!user && <Link className="btn ghost big" href="/login">Sign in</Link>}
          </div>
        </section>
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="lp-foot">
        <div className="lp-wrap foot-grid">
          <div className="foot-brand">
            <Link href="/" className="lp-brand"><LogoMark size={30} /><span>Anchor</span></Link>
            <p className="muted">Banking that moves at your speed.</p>
          </div>
          <div><b>Product</b><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#security">Security</a></div>
          <div><b>Account</b><Link href="/signup">Open an account</Link><Link href="/login">Sign in</Link></div>
          <div><b>Help</b><a href="#faq">FAQ</a><a href="#how">How it works</a></div>
        </div>
        <div className="lp-wrap foot-legal">
          <span>© {new Date().getFullYear()} Anchor Bank</span>
          <span>Anchor Bank. Banking that moves at your speed.</span>
        </div>
      </footer>
    </div>
  );
}
