import Link from "next/link";
import { LogoMark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

/** Standalone sign-in / sign-up page: one focused card, nothing from the marketing site. */
export function AuthShell({ title, sub, children, aside }: { title: string; sub: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-bg" aria-hidden="true"><span /><span /></div>
      <header className="auth-top">
        <Link href="/" className="auth-home" aria-label="Anchor Bank home"><LogoMark size={30} /><span>Anchor</span></Link>
        <ThemeToggle />
      </header>
      <main className="auth-center">
        <section className="auth-card glass">
          <LogoMark size={52} />
          <h1>{title}</h1>
          <p className="muted">{sub}</p>
          {children}
          {aside}
        </section>
        <p className="auth-foot">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          Encrypted connection · Your information is protected
        </p>
      </main>
    </div>
  );
}

export function PasswordField({ id, label, value, onChange, autoComplete, show, onToggle, invalid }: {
  id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; show: boolean; onToggle: () => void; invalid?: boolean;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="pw-wrap">
        <input className="input" id={id} type={show ? "text" : "password"} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || undefined} />
        <button type="button" className="pw-toggle" onClick={onToggle} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>{show ? "Hide" : "Show"}</button>
      </div>
    </div>
  );
}
