"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell, PasswordField } from "@/components/AuthShell";
import { passwordStrength, signupProblem } from "@/lib/validate";

export default function SignupPage() {
  const [v, setV] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [agree, setAgree] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<{ field?: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(v.password);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const local = signupProblem(v);
    if (local) return setError(local);
    if (v.password !== v.confirm) return setError({ field: "confirm", message: "The passwords don't match." });
    if (!agree) return setError({ field: "agree", message: "Agree to the Terms of Service to open an account." });
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: v.name, email: v.email, phone: v.phone, password: v.password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError({ field: data.field, message: data.error || "Something went wrong. Try again." }); setBusy(false); return; }
      window.location.href = "/dashboard";
    } catch {
      setError({ message: "Couldn't reach the server. Check your connection and try again." });
      setBusy(false);
    }
  }

  const bad = (f: string) => error?.field === f || undefined;

  return (
    <AuthShell
      title="Open an account"
      sub="It takes about a minute. Your checking and savings accounts open right away."
      aside={<p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>}
    >
      <form className="form auth-form" onSubmit={submit} noValidate>
        <div className="field"><label htmlFor="su-name">Full name</label><input className="input" id="su-name" autoComplete="name" value={v.name} onChange={set("name")} aria-invalid={bad("name")} /></div>
        <div className="row-2">
          <div className="field"><label htmlFor="su-email">Email</label><input className="input" id="su-email" type="email" autoComplete="email" value={v.email} onChange={set("email")} aria-invalid={bad("email")} /></div>
          <div className="field"><label htmlFor="su-phone">Mobile phone</label><input className="input" id="su-phone" type="tel" autoComplete="tel" placeholder="(555) 123-4567" value={v.phone} onChange={set("phone")} aria-invalid={bad("phone")} /></div>
        </div>
        <PasswordField id="su-pw" label="Password" value={v.password} onChange={(x) => setV({ ...v, password: x })} autoComplete="new-password" show={show} onToggle={() => setShow((s) => !s)} invalid={bad("password")} />
        {v.password && (
          <div className="strength" aria-live="polite">
            <span className="segments">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < strength.score ? `on s${strength.score}` : ""} />)}</span>
            <span className="hint">{strength.label}</span>
          </div>
        )}
        <PasswordField id="su-pw2" label="Confirm password" value={v.confirm} onChange={(x) => setV({ ...v, confirm: x })} autoComplete="new-password" show={show} onToggle={() => setShow((s) => !s)} invalid={bad("confirm")} />
        <p className="hint">At least 12 characters, mixing upper and lower case with numbers or symbols.</p>
        <label className="check-row"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} aria-invalid={bad("agree")} />I agree to the Terms of Service and Privacy Policy.</label>
        {error && <p className="hint bad" role="alert">{error.message}</p>}
        <button className="btn wide" type="submit" disabled={busy}>{busy ? "Creating your account…" : "Create account"}</button>
      </form>
    </AuthShell>
  );
}
