"use client";

// The sign-on box in the landing hero. Email first, then the full sign-in page (password and, if set up, passkey).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function HeroSignOn({ name }: { name: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [remember, setRemember] = useState(false);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  if (name) {
    return (
      <div className="wf-signon">
        <h2>{greeting}, {name.split(" ")[0]}</h2>
        <p className="wf-muted">You&apos;re signed in.</p>
        <Link className="wf-btn wf-btn-primary wf-btn-block" href="/dashboard">Go to your accounts</Link>
      </div>
    );
  }

  function go(e: React.FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams();
    if (email.trim()) q.set("email", email.trim());
    if (remember) q.set("remember", "1");
    router.push(`/login${q.size ? `?${q}` : ""}`);
  }

  return (
    <form className="wf-signon" onSubmit={go}>
      <h2>{greeting}</h2>
      <p className="wf-muted">Sign on to manage your accounts.</p>
      <label className="wf-field">
        <span>Email</span>
        <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </label>
      <label className="wf-check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Keep me signed in</label>
      <button className="wf-btn wf-btn-primary wf-btn-block" type="submit">Sign on</button>
      <div className="wf-signon-links">
        <span>New to Anchor?</span>
        <Link href="/signup">Open an account</Link>
      </div>
    </form>
  );
}
