import { useId } from "react";

/**
 * Anchor Bank mark: an anchor held inside a shield, for "your money, kept safe".
 * Same drawing as app/icon.svg (the favicon).
 */
export function LogoMark({ size = 28, animated = false }: { size?: number; animated?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={animated ? "logo-anim" : undefined}>
      <defs>
        <linearGradient id={`ag${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0B3D91" />
          <stop offset=".55" stopColor="#1557C0" />
          <stop offset="1" stopColor="#2E7FE6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#ag${id})`} />
      <path
        d="M32 7.5 51.5 14v15.5c0 14.2-8.3 23-19.5 27-11.2-4-19.5-12.8-19.5-27V14z"
        fill="#fff" fillOpacity=".14" stroke="#fff" strokeWidth="4" strokeLinejoin="round"
        className="lg-shield" pathLength={1}
      />
      <g fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="32" cy="19.5" r="3.2" className="lg-ring" pathLength={1} />
        <path d="M32 22.7V47.5" className="lg-stem" pathLength={1} />
        <path d="M25.2 28.5h13.6" className="lg-bar" pathLength={1} />
        <path d="M21.2 37.2c2 7 6.6 10.3 10.8 10.3s8.8-3.3 10.8-10.3" className="lg-leg" pathLength={1} />
      </g>
    </svg>
  );
}

export const BRAND = "Anchor";
export const BRAND_FULL = "Anchor Bank";
