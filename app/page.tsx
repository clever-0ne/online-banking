import Link from "next/link";
import { HeroSignOn } from "@/components/landing/HeroSignOn";
import { LogoMark } from "@/components/Logo";
import { currentUser } from "@/lib/server/current";
import "./landing.css";

export const dynamic = "force-dynamic";

/** Free-licence photos from Unsplash, served by their image CDN at the size each slot needs. */
const photo = (id: string, w: number, h?: number) =>
  `https://images.unsplash.com/photo-${id}?w=${w}${h ? `&h=${h}` : ""}&fit=crop&q=75&auto=format`;
const PHOTOS = {
  hero: "1556742049-0cfed4f6a45d", // shop owner taking a phone payment
  checking: "1563013544-824ae1b704d3", // paying online with a card
  savings: "1579621970563-ebec7560ff3e", // seedling growing from coins
  card: "1556745757-8d76bdb6984b", // card payment at a counter
  deposit: "1571867424488-4565932edb41", // two phones paying each other
  help: "1551836022-d5d88e9218df", // a conversation across a table
};

const ico = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);
const I = {
  checking: ico(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>),
  savings: ico(<><path d="M19 9c1.5.5 2 2 2 3s-.5 2-2 2v3h-3l-1-2H9l-1 2H5v-3.5C3.5 12.5 3 11 3 10c0-3 3.5-5 8-5 2.5 0 4.5.6 6 1.7L19 5v4z" /><circle cx="15.5" cy="10" r=".6" fill="currentColor" /></>),
  card: ico(<><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6 15h3" /></>),
  deposit: ico(<><path d="M12 3v12M7 10l5 5 5-5" /><path d="M4 21h16" /></>),
  withdraw: ico(<><path d="M12 15V3M7 8l5-5 5 5" /><path d="M4 21h16" /></>),
  send: ico(<><path d="M21 3 10 14" /><path d="M21 3l-7 18-4-7-7-4z" /></>),
  shield: ico(<><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>),
  bell: ico(<><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>),
  lock: ico(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  key: ico(<><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3" /></>),
  phone: ico(<><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>),
  chev: ico(<path d="M9 6l6 6-6 6" />),
  tick: ico(<path d="M5 12.5l4.5 4.5L19 7.5" />),
};

const FAQ: [string, string][] = [
  ["How do I open an account?", "Select Open an account and enter your name, email, mobile number and a password. It takes about a minute, and your checking, savings and card are ready right away."],
  ["Are there monthly fees?", "No. Everyday Checking and High-Yield Savings have no monthly service fee and no minimum balance."],
  ["How do I add money?", "Go to Deposit. You can buy with your debit or credit card through our partner Ramp, or send from your own wallet. Each deposit is reviewed by our team, then added to your balance."],
  ["How do withdrawals work?", "Go to Withdraw, enter your wallet address and the amount. We hold the amount while our team reviews it, then send it. If a withdrawal is declined, the hold is released right away."],
  ["How is my account protected?", "Add a passkey in Profile and every sign-in also needs your fingerprint, face or device PIN. You can lock your card in one tap and get notified about sign-ins, deposits and withdrawals."],
  ["Can I use Anchor on my phone?", "Yes. Open Anchor Bank in your phone's browser and add it to your Home Screen. It opens full-screen like any other app and can send you notifications."],
];

export default async function Landing() {
  const user = await currentUser();
  const signedIn = !!user;
  const open = signedIn ? "/dashboard" : "/signup";
  const go = (path: string) => (signedIn ? path : "/signup");

  return (
    <div className="wf">
      <a className="wf-skip" href="#main">Skip to content</a>

      {/* Utility bar */}
      <div className="wf-util">
        <div className="wf-wrap wf-util-in">
          <nav aria-label="Banking for">
            <a href="#" aria-current="page">Personal</a>
          </nav>
          <nav aria-label="Help" className="wf-util-end">
            <a href="#security">Security center</a>
            <a href="#help">Help</a>
            <a href="#app">Get the app</a>
          </nav>
        </div>
      </div>

      {/* Masthead */}
      <header className="wf-mast">
        <div className="wf-wrap wf-mast-in">
          <Link href="/" className="wf-brand" aria-label="Anchor Bank home"><LogoMark size={34} /><span>Anchor Bank</span></Link>
          <nav className="wf-nav" aria-label="Main">
            <a href="#accounts">Checking</a>
            <a href="#accounts">Savings</a>
            <a href="#accounts">Credit cards</a>
            <a href="#deposit">Deposit &amp; withdraw</a>
            <a href="#security">Security</a>
          </nav>
          <div className="wf-mast-end">
            {signedIn ? (
              <Link className="wf-btn wf-btn-light" href="/dashboard">My accounts</Link>
            ) : (
              <>
                <Link className="wf-btn wf-btn-ghost" href="/login">Sign on</Link>
                <Link className="wf-btn wf-btn-light" href="/signup">Open account</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="wf-hero" aria-label="Welcome">
          <img className="wf-hero-img" src={photo(PHOTOS.hero, 1920)} srcSet={`${photo(PHOTOS.hero, 960)} 960w, ${photo(PHOTOS.hero, 1920)} 1920w`} sizes="100vw" alt="A smiling shop owner taking a customer's payment by phone" fetchPriority="high" />
          <div className="wf-wrap wf-hero-in">
            <HeroSignOn name={user?.name ?? null} />
            <div className="wf-hero-copy">
              <p className="wf-eyebrow">Everyday Checking</p>
              <h1>Banking that works as hard as you do</h1>
              <p>Open an account in about a minute. No monthly fee, no minimum balance.</p>
              <Link className="wf-btn wf-btn-primary" href={open}>{signedIn ? "Go to your accounts" : "Open an account"}</Link>
            </div>
          </div>
        </section>

        {/* Shortcuts */}
        <nav className="wf-shortcuts" aria-label="What would you like to do?">
          <div className="wf-wrap wf-shortcuts-in">
            {[
              ["Checking", I.checking, go("/dashboard")],
              ["Savings", I.savings, go("/goals")],
              ["Credit cards", I.card, go("/cards")],
              ["Deposit", I.deposit, go("/deposit")],
              ["Withdraw", I.withdraw, go("/withdraw")],
              ["Send money", I.send, go("/send")],
            ].map(([label, icon, href]) => (
              <Link key={label as string} href={href as string} className="wf-shortcut">
                <span className="wf-shortcut-ico">{icon}</span>
                <span>{label as string}</span>
              </Link>
            ))}
          </div>
        </nav>

        {/* Accounts */}
        <section id="accounts" className="wf-section">
          <div className="wf-wrap">
            <div className="wf-head">
              <h2>Find the account that fits</h2>
              <p>Everything you need for everyday money, all in one place.</p>
            </div>
            <div className="wf-cards">
              <article className="wf-card">
                <img src={photo(PHOTOS.checking, 720, 400)} alt="Someone paying online with a card" loading="lazy" />
                <div className="wf-card-body">
                  <h3>Everyday Checking</h3>
                  <p>The account for daily spending, bills and transfers.</p>
                  <ul className="wf-ticks">
                    <li>{I.tick}No monthly service fee</li>
                    <li>{I.tick}Free debit card with one-tap lock</li>
                    <li>{I.tick}Bill pay and scheduled transfers</li>
                  </ul>
                  <Link className="wf-link" href={open}>Open checking {I.chev}</Link>
                </div>
              </article>
              <article className="wf-card">
                <img src={photo(PHOTOS.savings, 720, 400)} alt="A seedling growing from a pile of coins" loading="lazy" />
                <div className="wf-card-body">
                  <h3>High-Yield Savings</h3>
                  <p>Grow your money and track savings goals as you go.</p>
                  <ul className="wf-ticks">
                    <li>{I.tick}<b>3.75% APY</b>&nbsp;on every dollar</li>
                    <li>{I.tick}No minimum balance</li>
                    <li>{I.tick}Savings goals with progress</li>
                  </ul>
                  <Link className="wf-link" href={open}>Start saving {I.chev}</Link>
                </div>
              </article>
              <article className="wf-card">
                <img src={photo(PHOTOS.card, 720, 400)} alt="A card payment at a shop counter" loading="lazy" />
                <div className="wf-card-body">
                  <h3>Cash Back Visa</h3>
                  <p>A credit card you manage right next to your accounts.</p>
                  <ul className="wf-ticks">
                    <li>{I.tick}Lock, unlock and set limits instantly</li>
                    <li>{I.tick}Turn online or abroad use on and off</li>
                    <li>{I.tick}Pay your balance from checking</li>
                  </ul>
                  <Link className="wf-link" href={open}>See the card {I.chev}</Link>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Deposit & withdraw */}
        <section id="deposit" className="wf-split">
          <div className="wf-wrap wf-split-in">
            <img src={photo(PHOTOS.deposit, 960, 720)} alt="Two people paying each other with their phones" loading="lazy" />
            <div className="wf-split-copy">
              <p className="wf-eyebrow">Deposit &amp; withdraw</p>
              <h2>Add money with your card in minutes</h2>
              <p>Buy with your debit or credit card through our partner Ramp, or send from your own wallet. Withdraw to your wallet whenever you like.</p>
              <ul className="wf-ticks">
                <li>{I.tick}Every deposit and withdrawal is reviewed by our team</li>
                <li>{I.tick}See each request&apos;s status as it happens</li>
                <li>{I.tick}Get notified the moment it&apos;s approved</li>
              </ul>
              <Link className="wf-btn wf-btn-primary" href={go("/deposit")}>Make a deposit</Link>
            </div>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="wf-section wf-tint">
          <div className="wf-wrap">
            <div className="wf-head">
              <h2>Security that works in the background</h2>
              <p>Your account is protected at every step, and you stay in control.</p>
            </div>
            <div className="wf-features">
              {[
                [I.key, "Passkey sign-in", "Add a passkey and every sign-in also needs your fingerprint, face or device PIN."],
                [I.bell, "Instant alerts", "Get notified about sign-ins, deposits, withdrawals and security changes."],
                [I.lock, "Card controls", "Lock your card, block online or international use, and set spending limits."],
                [I.shield, "Protected sign-on", "Encrypted sessions, and sign-in pauses after repeated wrong passwords."],
              ].map(([icon, t, d]) => (
                <div className="wf-feature" key={t as string}>
                  <span className="wf-feature-ico">{icon}</span>
                  <h3>{t as string}</h3>
                  <p>{d as string}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* App */}
        <section id="app" className="wf-section">
          <div className="wf-wrap wf-app">
            <div className="wf-app-icon"><img src="/icon-512.png" alt="" width={120} height={120} /></div>
            <div className="wf-app-copy">
              <h2>Take Anchor with you</h2>
              <p>Add Anchor Bank to your phone&apos;s Home Screen. It opens full-screen like any other app and can notify you about your money.</p>
              <ol className="wf-steps">
                <li><b>iPhone:</b> open this site in Safari, tap Share, then Add to Home Screen.</li>
                <li><b>Android:</b> open it in Chrome, tap the menu, then Install app.</li>
              </ol>
            </div>
            <span className="wf-app-phone" aria-hidden="true">{I.phone}</span>
          </div>
        </section>

        {/* Help */}
        <section id="help" className="wf-split wf-tint">
          <div className="wf-wrap wf-split-in wf-split-rev">
            <img src={photo(PHOTOS.help, 960, 720)} alt="Two people talking across a table" loading="lazy" />
            <div className="wf-split-copy">
              <h2>Questions? We&apos;re here to help</h2>
              <div className="wf-faq">
                {FAQ.map(([q, a]) => (
                  <details key={q}>
                    <summary>{q}{I.chev}</summary>
                    <p>{a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="wf-cta">
          <div className="wf-wrap wf-cta-in">
            <h2>{signedIn ? "Your accounts are a tap away" : "Ready to bank with Anchor?"}</h2>
            <Link className="wf-btn wf-btn-light" href={open}>{signedIn ? "Go to your accounts" : "Open an account"}</Link>
          </div>
        </section>
      </main>

      <footer className="wf-foot">
        <div className="wf-wrap wf-foot-grid">
          <div className="wf-foot-brand">
            <Link href="/" className="wf-brand wf-brand-dark"><LogoMark size={30} /><span>Anchor Bank</span></Link>
            <p>Checking, savings and cards in one place.</p>
          </div>
          <div><b>Accounts</b><a href="#accounts">Checking</a><a href="#accounts">Savings</a><a href="#accounts">Credit cards</a></div>
          <div><b>Ways to bank</b><Link href="/login">Online banking</Link><a href="#app">Mobile app</a><a href="#deposit">Deposit &amp; withdraw</a></div>
          <div><b>Help</b><a href="#help">Questions</a><a href="#security">Security center</a><Link href="/signup">Open an account</Link></div>
        </div>
        <div className="wf-wrap wf-foot-legal">
          <p>Deposits and withdrawals are reviewed before they&apos;re credited or sent. Card purchases through Ramp are provided by Ramp Network and subject to its terms and fees. APY is the annual percentage yield and may change.</p>
          <p>© {new Date().getFullYear()} Anchor Bank. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
