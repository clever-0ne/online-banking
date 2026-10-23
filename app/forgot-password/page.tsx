"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const e = new URLSearchParams(window.location.search).get("email");
    if (e) setEmail(e);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Enter the email address you use to sign in."); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally { setBusy(false); }
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" sub={`If ${email.trim()} has an Anchor Bank account, we've sent it a link to reset your password.`}
        aside={<p className="auth-switch"><Link href="/login">Back to sign in</Link></p>}>
        <div className="form auth-form">
          <p className="hint">The link works once and expires in 30 minutes. Don&apos;t see it? Check your spam or junk folder, or <button type="button" className="link-inline" onClick={() => setSent(false)}>send it again</button>.</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Forgot your password?" sub="Enter your email and we'll send you a link to choose a new one."
      aside={<p className="auth-switch">Remembered it? <Link href="/login">Sign in</Link></p>}>
      <form className="form auth-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="fp-email">Email</label>
          <input className="input" id="fp-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {error && <p className="hint bad" role="alert">{error}</p>}
        <button className="btn wide" type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
      </form>
    </AuthShell>
  );
}
