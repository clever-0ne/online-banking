// Staff console: which server settings are right and which need fixing. Opens by itself when something's wrong.
import type { SetupItem } from "@/lib/server/health";

export function SetupCheck({ items }: { items: SetupItem[] }) {
  const problems = items.filter((i) => !i.ok).length;
  return (
    <details className="panel glass setup" open={problems > 0}>
      <summary>
        <b>Setup check</b>
        <span className={`pill ${problems ? "bad" : "good"}`}>{problems ? `${problems} to fix` : "All good"}</span>
      </summary>
      <ul className="setup-list">
        {items.map((i) => (
          <li key={i.name}>
            <span className={`setup-dot ${i.ok ? "ok" : "bad"}`} aria-hidden="true">{i.ok ? "✓" : "!"}</span>
            <div><b>{i.name}</b><span className="muted small block">{i.detail}</span></div>
          </li>
        ))}
      </ul>
      {problems > 0 && <p className="muted small">After changing settings on your host, redeploy so the site picks them up.</p>}
    </details>
  );
}
