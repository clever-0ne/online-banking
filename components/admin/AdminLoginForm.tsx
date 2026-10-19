"use client";

import { useState } from "react";
import { PasswordField } from "../AuthShell";
import { LogoMark } from "../Logo";

/** Staff sign-in for the admin area. There is no sign-up: the credential is set in the environment. */
export function AdminLoginForm({ base }: { base: string }) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) { setError("Enter the admin password."); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch(`${base}/api/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Couldn't sign in."); setBusy(false); return; }
      window.location.href = base;
    } catch {
      setError("Couldn't reach the server. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="adm-login">
      <form className="adm-login-card" onSubmit={submit} noValidate>
        <div className="adm-login-head">
          <LogoMark size={44} />
          <div><b>Anchor</b><span>Staff console</span></div>
        </div>
        <h1>Admin sign in</h1>
        <p className="muted">Authorized staff only. Every action is logged.</p>
        <PasswordField id="ad-pw" label="Password" value={password} onChange={setPassword} autoComplete="current-password" show={show} onToggle={() => setShow((s) => !s)} />
        {error && <p className="hint bad" role="alert">{error}</p>}
        <button className="btn wide" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
