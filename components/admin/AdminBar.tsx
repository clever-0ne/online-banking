"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "../Avatar";
import { LogoMark } from "../Logo";
import { ThemeToggle } from "../ThemeToggle";

export function AdminBar({ name, base }: { name: string; base: string }) {
  const path = usePathname();
  const onFunding = path.startsWith(`${base}/funding`);
  async function signOut() {
    try { await fetch(`${base}/api/session`, { method: "DELETE" }); } catch {}
    window.location.href = `${base}/login`;
  }
  return (
    <header className="adm-bar">
      <div className="adm-bar-in">
        <Link href={base} className="brand"><LogoMark size={30} /><span>Anchor</span></Link>
        <span className="adm-badge">Staff</span>
        <nav className="adm-nav" aria-label="Admin">
          <Link href={base} aria-current={onFunding ? undefined : "page"}>Customers</Link>
          <Link href={`${base}/funding`} aria-current={onFunding ? "page" : undefined}>Deposits &amp; withdrawals</Link>
        </nav>
        <div className="adm-end">
          <ThemeToggle />
          <span className="adm-me"><Avatar name={name} /><span>{name}</span></span>
          <button type="button" className="btn ghost small" onClick={signOut}>Sign out</button>
        </div>
      </div>
    </header>
  );
}
