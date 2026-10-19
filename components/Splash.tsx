import { LogoMark } from "./Logo";

/** Full-screen loading screen: the logo draws itself, then the wing lifts while a ring spins. */
export function Splash({ label = "Loading your accounts" }: { label?: string }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="splash-mark">
        <span className="splash-ring" aria-hidden="true" />
        <LogoMark size={76} animated />
      </div>
      <span className="splash-name">Anchor</span>
      <span className="splash-label">{label}</span>
    </div>
  );
}
