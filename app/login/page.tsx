"use client";

import Link from "next/link";
import { useState } from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { AuthShell, PasswordField } from "@/components/AuthShell";
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
  const [step, setStep] = useState<"password" | "passkey">("password");

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
      setError(e.name === "NotAllowedError" || e.name === "AbortError" ? "The passkey request was canceled or timed out. Try again." : e.message);
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
          <button className="btn ghost wide" type="button" onClick={() => { setStep("password"); setPassword(""); setError(""); }} disabled={busy}>Back</button>
          <p className="hint">Lost the device with your passkey? Contact Anchor Bank support to verify your identity and reset it.</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      sub="Sign in to see your accounts."
      aside={<p className="auth-switch">New to Anchor? <Link href="/signup">Open an account</Link></p>}
    >
      <form className="form auth-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="li-email">Email</label>
          <input className="input" id="li-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <PasswordField id="li-pw" label="Password" value={password} onChange={setPassword} autoComplete="current-password" show={show} onToggle={() => setShow((s) => !s)} />
        <label className="check-row"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Keep me signed in for 30 days</label>
        {error && <p className="hint bad" role="alert">{error}</p>}
        <button className="btn wide" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </AuthShell>
  );
}
