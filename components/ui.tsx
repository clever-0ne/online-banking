"use client";

// Small shared building blocks used across pages.

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}

export function Switch({ id, checked, disabled, onChange, label }: { id: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <span className="switch">
      <input type="checkbox" id={id} checked={checked} disabled={disabled} aria-label={label} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </span>
  );
}

export function Tabs<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>
      ))}
    </div>
  );
}

export function AmountInput({ id, value, onChange, label }: { id: string; value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div className="amount-in">
      <span>$</span>
      <input className="input" id={id} inputMode="decimal" autoComplete="off" placeholder="0.00" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function Progress({ value, max, tone }: { value: number; max: number; tone?: "warn" | "bad" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <i className={tone} style={{ width: `${pct.toFixed(1)}%` }} />
    </div>
  );
}

export function Success({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="success">
      <div className="check">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </div>
      <h2>{title}</h2>
      <p className="muted">{body}</p>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}
