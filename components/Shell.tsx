"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useBank } from "./BankProvider";
import { LogoMark } from "./Logo";
import { ICONS, NAV_GROUPS, OPEN_MENU_EVENT } from "./nav";
import { InstallApp } from "./InstallApp";
import { PushReminder } from "./PushReminder";
import { ThemeToggle } from "./ThemeToggle";
import { Avatar } from "./Avatar";
import { alertFeed } from "@/lib/logic";

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { state, user, signOut, can } = useBank();
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const alertCount = alertFeed(state).filter((a) => a.tone === "warn").length;

  // Close the menu after navigating; open it when another component asks.
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const openMenu = () => setOpen(true);
    window.addEventListener(OPEN_MENU_EVENT, openMenu);
    return () => window.removeEventListener(OPEN_MENU_EVENT, openMenu);
  }, []);
  const tabs = [
    { href: "/dashboard", label: "Accounts", icon: ICONS.home, match: ["/dashboard", "/activity", "/statements", "/cards"] },
    { href: "/deposit", label: "Deposit", icon: ICONS.deposit, match: ["/deposit", "/withdraw"] },
    { href: "/transfer", label: "Pay & Transfer", icon: ICONS.payments, match: ["/transfer", "/send", "/bills"] },
    { href: "/budget", label: "Explore", icon: ICONS.compass, match: ["/budget", "/goals", "/credit"] },
  ].filter((t) => can(t.href));
  // Only the pages this customer can use appear in the menu.
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((n) => can(n.href)) })).filter((g) => g.items.length > 0);

  // While open: Escape closes, the page behind doesn't scroll, focus moves into the menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const btn = menuBtnRef.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      btn?.focus();
    };
  }, [open]);

  return (
    <div className="app">
      <header className="topbar mast">
        <div className="topbar-in">
          <button ref={menuBtnRef} type="button" className="icon-btn mast-menu" aria-label="Open menu" aria-expanded={open} aria-controls="drawer" onClick={() => setOpen(true)}>
            {ICONS.menu}
          </button>
          <Link href="/dashboard" className="brand" translate="no"><LogoMark size={28} /><span>Anchor Bank</span></Link>
          {/* Desktop: the menu across the top, each heading opening its pages below it. */}
          <nav className="mast-nav" aria-label="Main">
            {groups.map((g) => {
              const here = g.items.some((n) => path === n.href);
              return (
                <div className="mn-group" key={g.title}>
                  <Link href={g.items[0].href} className="mn-top" aria-current={here ? "true" : undefined}>{g.title}</Link>
                  <div className="mn-drop">
                    {g.items.map((n) => (
                      <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined}>{n.icon}<span>{n.label}</span></Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
          <div className="topbar-end">
            <ThemeToggle />
            {can("/alerts") && <Link href="/alerts" className="icon-btn" aria-label={`Alerts${alertCount ? `, ${alertCount} need attention` : ""}`}>
              {ICONS.bell}
              {alertCount > 0 && <span className="dot">{alertCount > 9 ? "9+" : alertCount}</span>}
            </Link>}
            <Link href={can("/profile") ? "/profile" : "/dashboard"} className="avatar-link" aria-label={can("/profile") ? "Your profile" : "Dashboard"}>
              <Avatar name={state.customer.name} photo={state.profile.photo} />
            </Link>
            <button type="button" className="mast-signoff" onClick={signOut}>Sign off</button>
          </div>
        </div>
      </header>

      <div className={`scrim${open ? " show" : ""}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside id="drawer" ref={drawerRef} className={`drawer${open ? " open" : ""}`} aria-label="Menu" aria-hidden={!open} inert={!open}>
        <div className="drawer-head">
          <Link href="/dashboard" className="brand" translate="no"><LogoMark size={28} /><span>Anchor</span></Link>
          <button type="button" className="icon-btn" aria-label="Close menu" onClick={() => setOpen(false)}>{ICONS.close}</button>
        </div>
        <Link href={can("/profile") ? "/profile" : "/dashboard"} className="who">
          <Avatar name={state.customer.name} photo={state.profile.photo} size="lg" />
          <span className="muted">Welcome back</span>
          <b>{state.customer.name}</b>
          {can("/profile") && <span className="muted">View profile</span>}
        </Link>
        <nav className="nav" aria-label="Main">
          {groups.map((g) => (
            <div className="nav-group" key={g.title}>
              <span className="nav-title">{g.title}</span>
              {g.items.map((n) => (
                <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined}>
                  {n.icon}
                  <span>{n.label}</span>
                  {n.href === "/alerts" && alertCount > 0 && <span className="badge">{alertCount}</span>}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="drawer-foot">
          <InstallApp variant="menu" />
          <button type="button" className="btn ghost block" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <main>
        <div className="wrap">{children}</div>
      </main>

      <PushReminder />

      <nav className="tabbar" aria-label="Quick navigation">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} aria-current={t.match.includes(path) ? "page" : undefined}>{t.icon}<span>{t.label}</span></Link>
        ))}
        <button type="button" className="tab-menu" aria-expanded={open} aria-controls="drawer" onClick={() => setOpen(true)}>{ICONS.menu}<span>Menu</span></button>
      </nav>
    </div>
  );
}
