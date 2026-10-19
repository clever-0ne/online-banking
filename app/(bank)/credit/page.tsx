"use client";

import { useBank } from "@/components/BankProvider";
import { PageHead } from "@/components/ui";
import { fromISO } from "@/lib/format";
import { acct, available, bandOf, SCORE_BANDS as BANDS } from "@/lib/logic";

const MIN = 300, MAX = 850;

function Gauge({ score }: { score: number }) {
  const cx = 150, cy = 140, r = 110;
  const angle = (v: number) => Math.PI * (1 - (v - MIN) / (MAX - MIN));
  const pt = (v: number, rad = r) => [cx + rad * Math.cos(angle(v)), cy - rad * Math.sin(angle(v))];
  const arc = (a: number, b: number) => { const [x1, y1] = pt(a); const [x2, y2] = pt(b); return `M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`; };
  const [nx, ny] = pt(score, r - 26);
  return (
    <svg viewBox="0 0 300 170" className="gauge" role="img" aria-label={`Credit score ${score} out of 850`}>
      {BANDS.map(([lo, hi], i) => (
        <path key={lo} d={arc(lo, hi + (i < BANDS.length - 1 ? 1 : 0))} stroke={`var(--band-${i})`} strokeWidth="16" fill="none" />
      ))}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="6" fill="var(--ink)" />
      <text x={pt(MIN, r)[0]} y={cy + 22} textAnchor="middle">300</text>
      <text x={pt(MAX, r)[0]} y={cy + 22} textAnchor="middle">850</text>
    </svg>
  );
}

function History({ points }: { points: { month: string; score: number }[] }) {
  const W = 560, H = 170, P = { l: 36, r: 12, t: 12, b: 24 };
  const lo = Math.floor((Math.min(...points.map((p) => p.score)) - 10) / 20) * 20;
  const hi = Math.ceil((Math.max(...points.map((p) => p.score)) + 10) / 20) * 20;
  const x = (i: number) => P.l + (i / (points.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += 20) ticks.push(v);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.score)}`).join(" ");
  const last = points.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Credit score over the last 12 months">
      {ticks.map((v) => (
        <g key={v}><line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={P.l - 6} y={y(v) + 3} textAnchor="end">{v}</text></g>
      ))}
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {points.map((p, i) => <circle key={p.month} cx={x(i)} cy={y(p.score)} r={i === last ? 4.5 : 2.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={i === last ? 2 : 0} />)}
      {points.map((p, i) => (i % 3 === 0 || i === last) && (
        <text key={"l" + p.month} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}>{fromISO(p.month + "-01").toLocaleDateString("en-US", { month: "short" })}</text>
      ))}
    </svg>
  );
}

export default function CreditPage() {
  const { state } = useBank();
  const { score, history } = state.credit;
  const cc = acct(state, "cc");
  const used = (cc.limit ?? 0) - available(state, "cc");
  const utilization = cc.limit ? Math.round((used / cc.limit) * 100) : 0;
  const change = score !== null && history.length > 1 ? score - history[0].score : null;

  const factors: [string, string, string, "good" | "ok" | "warn"][] = [
    ["Payment history", "Pay on time", "The biggest factor. Keep paying at least the minimum by the due date.", "ok"],
    ["Credit card use", `${utilization}% of limits`, utilization <= 10 ? "Under 10% is ideal." : utilization <= 30 ? "Under 30% is good. Under 10% is even better." : "Above 30% can lower your score. Paying down your balance helps.", utilization <= 30 ? "good" : "warn"],
    ["Age of credit", "Grows over time", "Average age of your accounts. Keeping older accounts open helps.", "ok"],
    ["Hard inquiries", "Apply sparingly", "Each application for new credit can lower your score a little for a while.", "ok"],
  ];

  return (
    <>
      <PageHead title="Credit score" sub="Checking your own score doesn't affect it. Updated monthly." />
      {score === null ? (
        <section className="panel center">
          <span className="score">—</span>
          <span className="label">Not available yet</span>
          <p className="hint">Your score appears here once your credit file is available, usually within one statement cycle of opening your account.</p>
        </section>
      ) : (
        <div className="grid-2">
          <section className="panel center">
            <Gauge score={score} />
            <span className="score">{score}</span>
            <span className="label">{bandOf(score)}</span>
            {change !== null && <p className="hint">{change >= 0 ? "Up" : "Down"} {Math.abs(change)} points over {history.length} months</p>}
          </section>
          <section className="panel chart">
            <div className="panel-head"><h2>Score history</h2></div>
            {history.length > 1 ? <History points={history} /> : <p className="empty">History builds month by month.</p>}
          </section>
        </div>
      )}
      <section className="panel">
        <div className="panel-head"><h2>What affects your score</h2></div>
        <ul className="plain-list factors">
          {factors.map(([t, v, d, tone]) => (
            <li key={t}>
              <div><b>{t}</b><span className="muted">{d}</span></div>
              <span className={`pill ${tone === "good" ? "good" : tone === "warn" ? "pending" : ""}`}>{v}</span>
            </li>
          ))}
        </ul>
        <p className="hint" style={{ marginTop: 12 }}>Scores use the 300–850 scale.</p>
      </section>
    </>
  );
}
