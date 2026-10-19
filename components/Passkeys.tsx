"use client";

// Profile → Security: the customer's passkeys, the only second step at sign-in.
import { useEffect, useState } from "react";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import { useBank } from "./BankProvider";
import { longDate } from "@/lib/format";

interface Passkey { id: string; name: string; createdAt: string; lastUsedAt: string | null }

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

/** A starting name for a new passkey, from the device it's made on. */
function deviceName() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android phone" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows PC" : "This device";
  return os;
}

const day = (iso: string) => longDate(iso.slice(0, 10));
const shieldIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>;

export function Passkeys() {
  const { toast } = useBank();
  const [keys, setKeys] = useState<Passkey[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [removing, setRemoving] = useState<Passkey | null>(null);
  const [password, setPassword] = useState("");
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
    call("/api/passkeys").then((d) => setKeys(d.passkeys)).catch((e) => setError(e.message));
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const { options } = await call("/api/passkeys?options=1");
      const response = await startRegistration({ optionsJSON: options });
      const d = await call("/api/passkeys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, response }) });
      setKeys(d.passkeys);
      setAdding(false);
      toast(keys?.length ? "Passkey added" : "Passkey added. You'll use it each time you sign in");
    } catch (err) {
      const x = err as Error;
      setError(x.name === "NotAllowedError" || x.name === "AbortError" ? "The passkey wasn't created. The request was canceled or timed out." : x.name === "InvalidStateError" ? "This device already has a passkey for your account." : x.message);
    } finally { setBusy(false); }
  }

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    if (!removing) return;
    setBusy(true); setError("");
    try {
      const d = await call(`/api/passkeys/${removing.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      setKeys(d.passkeys);
      toast(d.passkeys.length ? `Removed ${removing.name}` : "Passkey removed. Sign-in now needs only your password");
      setRemoving(null); setPassword("");
    } catch (err) {
      setError((err as Error).message);
    } finally { setBusy(false); }
  }

  const on = !!keys?.length;
  return (
    <>
      <div className="tk-row">
        <span className="row-ico" aria-hidden="true">{shieldIcon}</span>
        <div className="tk-row-main">
          <b>2-step verification with a passkey{keys && <span className={`tk-pill sm ${on ? "teal" : "mauve"}`}>{on ? "On" : "Off"}</span>}</b>
          <span>{on ? "After your password, you confirm with your fingerprint, face or device PIN." : "Add a passkey so a stolen password alone can't open your account."}</span>
        </div>
        {supported && !adding && <button type="button" className="tk-btn" disabled={busy || !keys} onClick={() => { setAdding(true); setName(deviceName()); setError(""); }}>{on ? "Add another" : "Add passkey"}</button>}
      </div>
      {!supported && <p className="hint tk-sub">This browser can&apos;t create passkeys. Try a current version of Safari, Chrome, Edge or Firefox.</p>}

      {adding && (
        <form className="form tk-form tk-sub" onSubmit={add} noValidate>
          <div className="field"><label htmlFor="pk-name">Name it</label><input className="input" id="pk-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></div>
          <p className="hint">Your device will ask you to confirm with your fingerprint, face, PIN or security key.</p>
          <div className="actions"><button className="btn" type="submit" disabled={busy}>{busy ? "Waiting for your device…" : "Create passkey"}</button><button type="button" className="btn ghost" onClick={() => setAdding(false)} disabled={busy}>Cancel</button></div>
        </form>
      )}

      {keys?.map((k) => (
        <div className="tk-row tk-sub" key={k.id}>
          <div className="tk-row-main"><b>{k.name}</b><span>Added {day(k.createdAt)} · {k.lastUsedAt ? `Last used ${day(k.lastUsedAt)}` : "Not used yet"}</span></div>
          <button type="button" className="tk-btn" disabled={busy} onClick={() => { setRemoving(k); setPassword(""); setError(""); }}>Remove</button>
        </div>
      ))}

      {removing && (
        <form className="form tk-form tk-sub" onSubmit={remove} noValidate>
          <b>Remove {removing.name}?</b>
          <p className="hint">{keys?.length === 1 ? "It's your only passkey, so signing in will need just your password." : "You'll still have your other passkeys."} Enter your password to confirm.</p>
          <div className="field"><label htmlFor="pk-pw">Password</label><input className="input" id="pk-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div className="actions"><button className="btn danger" type="submit" disabled={busy || !password}>Remove passkey</button><button type="button" className="btn ghost" onClick={() => setRemoving(null)} disabled={busy}>Cancel</button></div>
        </form>
      )}
      {error && <p className="hint bad tk-sub" role="alert">{error}</p>}
    </>
  );
}
