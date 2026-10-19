"use client";

// Small SVG charts drawn at their container's real width, so labels stay readable on phones.
import { useEffect, useRef, useState } from "react";
import { fmt } from "@/lib/format";

function useWidth<T extends HTMLElement>(initial = 600) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(220, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** A "nice" axis: steps of 1, 2, 2.5 or 5 × 10ⁿ, at most 4 of them. */
function niceTicks(max: number) {
  const m = Math.max(1, max);
  const mag = Math.pow(10, Math.floor(Math.log10(m)));
  const step = [1, 2, 2.5, 5, 10].map((x) => x * mag).find((s) => m / s <= 4)!;
  const top = Math.ceil(m / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-6; v += step) ticks.push(v);
  return { top, ticks };
}
const kfmt = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k` : `$${v}`);

// ---------- Grouped bars: income vs spending ----------
export function GroupedBars({ data, label }: { data: { label: string; a: number; b: number }[]; label: string }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const H = 210, P = { l: 44, r: 8, t: 14, b: 26 };
  const { top, ticks } = niceTicks(Math.max(...data.map((d) => Math.max(d.a, d.b))));
  const y = (v: number) => P.t + (1 - v / top) * (H - P.t - P.b);
  const slot = (W - P.l - P.r) / data.length;
  const bw = Math.min(26, slot * 0.28);
  const shown = active ?? data.length - 1;
  return (
    <div className="chart-box" ref={ref} onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray={v ? "3 5" : undefined} />
            <text x={P.l - 8} y={y(v) + 4} textAnchor="end">{kfmt(v)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = P.l + slot * i + slot / 2;
          return (
            <g key={d.label} opacity={active === null || active === i ? 1 : 0.45} onMouseEnter={() => setActive(i)} onClick={() => setActive(i)}>
              <rect x={cx - slot / 2} y={P.t} width={slot} height={H - P.t - P.b} fill="transparent" />
              <rect x={cx - bw - 2} y={y(d.a)} width={bw} height={Math.max(2, H - P.b - y(d.a))} rx={Math.min(8, bw / 2)} fill="var(--accent)" />
              <rect x={cx + 2} y={y(d.b)} width={bw} height={Math.max(2, H - P.b - y(d.b))} rx={Math.min(8, bw / 2)} fill="var(--mauve-strong)" />
              <text x={cx} y={H - 6} textAnchor="middle" fontWeight={i === shown ? 700 : 400}>{d.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="chart-readout">
        <span><i className="sw" style={{ background: "var(--accent)" }} />In <b>{fmt(data[shown].a)}</b></span>
        <span><i className="sw" style={{ background: "var(--mauve-strong)" }} />Out <b>{fmt(data[shown].b)}</b></span>
        <span className="muted">{data[shown].label}</span>
      </div>
    </div>
  );
}

// ---------- Donut ----------
export const DONUT_COLORS = ["var(--accent)", "var(--mauve-strong)", "var(--teal-strong)", "#F5A524", "#5BC0EB", "#F472B6", "var(--muted)"];

export function Donut({ data, total, label }: { data: [string, number][]; total: number; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const R = 70, r = 48, C = 90;
  let acc = 0;
  const sum = data.reduce((a, [, v]) => a + v, 0) || 1;
  const arcs = data.map(([name, v], i) => {
    const a0 = (acc / sum) * Math.PI * 2 - Math.PI / 2;
    acc += v;
    const a1 = (acc / sum) * Math.PI * 2 - Math.PI / 2 - 0.02;
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad: number, a: number) => `${C + rad * Math.cos(a)},${C + rad * Math.sin(a)}`;
    const d = `M${p(R, a0)} A${R},${R} 0 ${big} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${big} 0 ${p(r, a0)} Z`;
    return { name, v, d, color: DONUT_COLORS[i % DONUT_COLORS.length] };
  });
  const a = active !== null ? arcs[active] : null;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 180 180" className="donut" role="img" aria-label={label} onMouseLeave={() => setActive(null)}>
        {arcs.map((s, i) => (
          <path key={s.name} d={s.d} fill={s.color} opacity={active === null || active === i ? 1 : 0.35} onMouseEnter={() => setActive(i)} onClick={() => setActive(i)} style={{ cursor: "pointer", transition: "opacity .15s" }} />
        ))}
        <text x={C} y={C - 4} textAnchor="middle" className="donut-big">{a ? fmt(a.v).replace(/\.\d+$/, "") : fmt(total).replace(/\.\d+$/, "")}</text>
        <text x={C} y={C + 16} textAnchor="middle" className="donut-sub">{a ? a.name : "spent"}</text>
      </svg>
      <ul className="legend-list">
        {arcs.map((s, i) => (
          <li key={s.name} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
            <i className="sw" style={{ background: s.color }} /><span>{s.name}</span><b>{Math.round((s.v / sum) * 100)}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Balance line ----------
export function BalanceLine({ points, label, height = 150 }: { points: { date: string; bal: number }[]; label: string; height?: number }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const H = height, P = { l: 6, r: 6, t: 16, b: 8 };
  const vals = points.map((p) => p.bal);
  const lo = Math.min(...vals), hi = Math.max(...vals), span = Math.max(1, hi - lo);
  const x = (i: number) => P.l + (i / (points.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - lo) / span) * (H - P.t - P.b);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.bal).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${H} L${x(0)},${H} Z`;
  const i = active ?? points.length - 1;
  const colW = (W - P.l - P.r) / (points.length - 1);
  return (
    <div className="chart-box" ref={ref} onMouseLeave={() => setActive(null)}>
      <div className="line-readout"><b>{fmt(points[i].bal)}</b><span className="muted">{new Date(points[i].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        <defs>
          <linearGradient id="bl-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity=".35" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#bl-fill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
        <line x1={x(i)} x2={x(i)} y1={P.t} y2={H} stroke="var(--line-strong)" strokeDasharray="3 4" />
        <circle cx={x(i)} cy={y(points[i].bal)} r="5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2.5" />
        {points.map((p, k) => <rect key={p.date} x={x(k) - colW / 2} y={0} width={colW} height={H} fill="transparent" onMouseEnter={() => setActive(k)} onClick={() => setActive(k)} />)}
      </svg>
    </div>
  );
}

// ---------- Progress ring ----------
export function Ring({ value, max, size = 64, color = "var(--accent)", children }: { value: number; max: number; size?: number; color?: string; children?: React.ReactNode }) {
  const r = 26, c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 32 32)" />
      </svg>
      <span className="ring-in">{children}</span>
    </span>
  );
}
