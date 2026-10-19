"use client";

// "Install the app": the browser's own install prompt where there is one (Chrome, Edge, Android), and the
// Add to Home Screen steps on iPhone. Hidden once Anchor Bank is running as an installed app.
import { useEffect, useState } from "react";
import { canPromptInstall, isIos, isStandalone, onInstallChange, promptInstall } from "./pwa";

export function InstallApp({ variant = "row" }: { variant?: "row" | "menu" }) {
  const [installed, setInstalled] = useState(true);
  const [canPrompt, setCanPrompt] = useState(false);
  const [ios, setIos] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIos(isIos());
    setCanPrompt(canPromptInstall());
    return onInstallChange(() => { setCanPrompt(canPromptInstall()); setInstalled(isStandalone()); });
  }, []);

  if (installed || (!canPrompt && !ios)) return null;
  const install = () => (canPrompt ? void promptInstall() : setShowSteps((s) => !s));

  if (variant === "menu") {
    return (
      <>
        <button type="button" className="btn ghost block install-btn" onClick={install}>
          <img src="/icon-192.png" alt="" width={20} height={20} />Install Anchor app
        </button>
        {showSteps && <p className="hint install-steps">Tap <b>Share</b> <span aria-hidden="true">⎋</span>, then <b>Add to Home Screen</b>.</p>}
      </>
    );
  }
  return (
    <>
      <div className="tk-row">
        <img className="row-ico app-ico" src="/icon-192.png" alt="" width={42} height={42} />
        <div className="tk-row-main"><b>Install the app</b><span>Open Anchor Bank from your home screen, full-screen, like any other app</span></div>
        <button type="button" className="tk-btn" onClick={install}>{canPrompt ? "Install" : "How"}</button>
      </div>
      {showSteps && <p className="hint tk-sub">In Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>. Then open Anchor Bank from your Home Screen.</p>}
    </>
  );
}
