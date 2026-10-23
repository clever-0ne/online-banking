"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthShell, PasswordField } from "@/components/AuthShell";
import { passwordProblem } from "@/lib/validate";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [state, setState] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(t);
    // Keep the token out of the address bar, browser history and the Referer header.
    window.history.replaceState(null, "", "/reset-password");
    fetch(`/api/auth/reset?token=${encodeURIComponent(t)}`, { cache: "no-store" })
      .then(async (r) => { if (!r.ok) throw new Error(); setEmail((await r.json()).email); setState("ready"); })
      .catch(() => setState("invalid"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(password, email ?? "") || (password !== confirm ? "The passwords don't match." : "");
    if (problem) { setError(problem); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const data = await res.json().catch(() => ({}));
      if (res.status === 410) { setState("invalid"); return; }
      if (!res.ok) throw new Error(data.error || "Your password wasn't changed. Try again.");
      setState("done");
    } catch (err) {
      setError((err as Error).message);
    } finally { setBusy(false); }
  }

  if (state === "checking") return <AuthShell title="Reset your password" sub="Checking your link…">{null}</AuthShell>;

  if (state === "invalid") {
    return (
      <AuthShell title="This link has expired" sub="Reset links work once and expire after 30 minutes. Ask for a new one and use it straight away."
        aside={<p className="auth-switch"><Link href="/login">Back to sign in</Link></p>}>
        <div className="form auth-form"><Link className="btn wide" href="/forgot-password">Send a new link</Link></div>
      </AuthShell>
    );
  }

  if (state === "done") {
    return (
      <AuthShell title="Password changed" sub="You've been signed out everywhere. Sign in with your new password.">
        <div className="form auth-form"><Link className="btn wide" href={`/login${email ? `?email=${encodeURIComponent(email)}` : ""}`}>Sign in</Link></div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" sub={email ? `For ${email}.` : "For your Anchor Bank account."}>
      <form className="form auth-form" onSubmit={submit} noValidate>
        <input type="email" autoComplete="username" value={email ?? ""} readOnly hidden />
        <PasswordField id="rp-pw" label="New password" value={password} onChange={setPassword} autoComplete="new-password" show={show} onToggle={() => setShow((s) => !s)} />
        <PasswordField id="rp-confirm" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" show={show} onToggle={() => setShow((s) => !s)} />
        <p className="hint">At least 12 characters, mixing upper and lower case with numbers or symbols.</p>
        {error && <p className="hint bad" role="alert">{error}</p>}
        <button className="btn wide" type="submit" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
      </form>
    </AuthShell>
  );
}
