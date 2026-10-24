"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { AuthShell } from "@/components/AuthShell";
import { LogoMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ICONS } from "@/components/nav";

/** Only allow redirects back into this site. */
function nextPath(): string {
  const n = new URLSearchParams(window.location.search).get("next") ?? "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard";
}

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong. Try again."), { status: res.status });
  return data;
}
const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"password" | "passkey" | "email">("password");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [note, setNote] = useState("");
  const [greeting, setGreeting] = useState("Welcome");

  // Coming from the sign-on box on the home page: keep what was entered there.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const e = q.get("email");
    if (e) { setEmail(e); document.getElementById("li-pw")?.focus(); }
    if (q.get("remember") === "1") setRemember(true);
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
  }, []);

  async function usePasskey() {
    setBusy(true); setError("");
    try {
      const { options } = await call("/api/auth/passkey", { cache: "no-store" });
      const response = await startAuthentication({ optionsJSON: options });
      await call("/api/auth/passkey", json(response));
      window.location.href = nextPath();
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401 && /timed out/.test(e.message)) { setStep("password"); setPassword(""); }
      setError(
        e.name === "NotAllowedError" || e.name === "AbortError" ? "The passkey request was canceled or timed out. Try again." :
        e.name === "SecurityError" ? "Passkeys can't be used on this web address. Open Anchor Bank at its main address and try again." :
        e.message);
      setBusy(false);
    }
  }

  // The other way to finish sign-in: a six-digit code sent to the account's email.
  async function sendCode() {
    setBusy(true); setError(""); setNote("");
    try {
      const data = await call("/api/auth/email-code", json({ action: "send" }));
      setSentTo(data.to); setStep("email"); setCode("");
      if (step === "email") setNote("We sent a new code. Use the newest email.");
      setTimeout(() => document.getElementById("li-code")?.focus(), 50);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401) { setStep("password"); setPassword(""); }
      setError(e.message);
    }
    setBusy(false);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (code.replace(/\D/g, "").length !== 6) { setError("Enter the 6-digit code from the email."); return; }
    setBusy(true); setError(""); setNote("");
    try {
      await call("/api/auth/email-code", json({ action: "verify", code }));
      window.location.href = nextPath();
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401 && /timed out/.test(e.message)) { setStep("password"); setPassword(""); }
      setError(e.message); setBusy(false);
    }
  }

  // "Sign on with a passkey": no email or password, the passkey alone says who it is.
  async function passkeyOnly() {
    setBusy(true); setError("");
    try {
      const { options } = await call("/api/auth/passkey/direct", { cache: "no-store" });
      const response = await startAuthentication({ optionsJSON: options });
      await call("/api/auth/passkey/direct", json({ response, remember }));
      window.location.href = nextPath();
    } catch (err) {
      const e = err as Error;
      setError(
        e.name === "NotAllowedError" || e.name === "AbortError" ? "The passkey request was canceled or timed out. Try again, or sign on with your email and password." :
        e.name === "SecurityError" ? "Passkeys can't be used on this web address. Open Anchor Bank at its main address and try again." :
        e.message);
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    setBusy(true); setError("");
    try {
      const data = await call("/api/auth/login", json({ email, password, remember }));
      if (data.passkey) { setStep("passkey"); setBusy(false); void usePasskey(); return; }
      window.location.href = nextPath();
    } catch (err) {
      setError((err as Error).message); setBusy(false);
    }
  }

  if (step === "email") {
    return (
      <AuthShell title="Check your email" sub={`We sent a 6-digit code to ${sentTo}.`}>
        <form className="form auth-form" onSubmit={verifyCode} noValidate>
          <div className="passkey-step">
            <span className="row-ico">{ICONS.bell}</span>
            <p className="muted">Your password was correct. Enter the code from the email to finish signing in. It expires in 10 minutes.</p>
          </div>
          <div className="field">
            <label htmlFor="li-code">Sign-in code</label>
            <input className="input code-input" id="li-code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="123456"
              value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))} />
          </div>
          {note && <p className="hint" role="status">{note}</p>}
          {error && <p className="hint bad" role="alert">{error}</p>}
          <button className="btn wide" type="submit" disabled={busy}>{busy ? "Checking…" : "Sign in"}</button>
          <button className="btn ghost wide" type="button" onClick={sendCode} disabled={busy}>Send a new code</button>
          <button className="link-btn" type="button" onClick={() => { setStep("passkey"); setError(""); setNote(""); }} disabled={busy}>Use my passkey instead</button>
          <p className="hint">Didn't get it? Check your spam folder. The email comes from Anchor Bank.</p>
        </form>
      </AuthShell>
    );
  }

  if (step === "passkey") {
    return (
      <AuthShell title="Confirm it's you" sub="Use the passkey on your phone, computer or security key.">
        <div className="form auth-form">
          <div className="passkey-step">
            <span className="row-ico">{ICONS.shield}</span>
            <p className="muted">Your password was correct. Approve the sign-in with your fingerprint, face or device PIN.</p>
          </div>
          {error && <p className="hint bad" role="alert">{error}</p>}
          <button className="btn wide" type="button" onClick={usePasskey} disabled={busy}>{busy ? "Waiting for your passkey…" : "Use passkey"}</button>
          <button className="btn ghost wide" type="button" onClick={sendCode} disabled={busy}>Email me a code instead</button>
          <button className="btn ghost wide" type="button" onClick={() => { setStep("password"); setPassword(""); setError(""); }} disabled={busy}>Back</button>
          <p className="hint">Don&apos;t have your passkey with you? Get a code by email instead.</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <div className="so">
      <header className="so-top">
        <Link href="/" className="so-brand" translate="no" aria-label="Anchor Bank home"><LogoMark size={30} /><span>ANCHOR BANK</span></Link>
        <ThemeToggle />
      </header>
      <h1 className="so-greet">{greeting}</h1>
      <main className="so-main">
        <form className="so-card" onSubmit={submit} noValidate>
          <label className="so-field">
            <span className="sr-only">Email</span>
            <input id="li-email" type="email" autoComplete="username webauthn" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="so-field">
            <span className="sr-only">Password</span>
            <input id="li-pw" type={show ? "text" : "password"} autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="so-show" onClick={() => setShow((v) => !v)} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
          </label>
          <div className="so-checks">
            <label><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Keep me signed in</label>
          </div>
          {error && <p className="hint bad" role="alert">{error}</p>}
          <div className="so-btns">
            <Link href="/signup" className="so-btn ghost">Enroll</Link>
            <button type="submit" className="so-btn" disabled={busy || !email.trim() || !password}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z" /></svg>
              {busy ? "Signing on…" : "Sign On"}
            </button>
          </div>
          <div className="so-links">
            <button type="button" onClick={passkeyOnly} disabled={busy}>→ Sign on with a passkey</button>
            <Link href={`/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""}`}>→ Forgot password?</Link>
          </div>
        </form>
        <div className="so-promos">
          <Link href="/#accounts" className="so-promo">
            <span className="so-promo-ico">{ICONS.compass}</span>
            <b>Explore our accounts</b>
            <span>Find your fit ›</span>
          </Link>
          <Link href="/signup" className="so-promo">
            <span className="so-promo-ico">{ICONS.card}</span>
            <b>Earn 3.75% APY on savings</b>
            <span>Learn more ›</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
