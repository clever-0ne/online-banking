"use client";

// Floating "Download the app" button on the landing page. Uses the browser's own install prompt where there is one
// (Chrome, Edge, Android); otherwise shows the steps for the visitor's device. Hidden once Anchor runs as an app.
import { useEffect, useState } from "react";
import { canPromptInstall, isIos, isStandalone, onInstallChange, promptInstall } from "../pwa";

const HIDE_KEY = "anchor-download-hidden";

export function FloatingDownload() {
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    let hidden = false;
    try { hidden = sessionStorage.getItem(HIDE_KEY) === "1"; } catch {}
    setIos(isIos());
    setShow(!isStandalone() && !hidden);
    return onInstallChange(() => { if (isStandalone()) setShow(false); });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!show) return null;

  async function download() {
    if (canPromptInstall()) {
      try {
        if (await promptInstall()) setShow(false);
        return;
      } catch {
        // The browser refused its install prompt: show the steps instead.
      }
    }
    setOpen(true);
  }

  function hide() {
    setShow(false);
    try { sessionStorage.setItem(HIDE_KEY, "1"); } catch {}
  }

  return (
    <>
      <div className="wf-fab">
        <button type="button" className="wf-fab-btn" onClick={download}>
          <img src="/icon-192.png" alt="" width={30} height={30} />
          <span><b>Download the app</b><small>Free · iPhone, Android &amp; desktop</small></span>
        </button>
        <button type="button" className="wf-fab-close" aria-label="Hide the download button" onClick={hide}>×</button>
      </div>

      {open && (
        <div className="wf-modal-scrim" onClick={() => setOpen(false)}>
          <div className="wf-modal" role="dialog" aria-modal="true" aria-labelledby="dl-title" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="wf-modal-x" aria-label="Close" onClick={() => setOpen(false)}>×</button>
            <img src="/icon-192.png" alt="" width={64} height={64} className="wf-modal-icon" />
            <h2 id="dl-title">Get the Anchor Bank app</h2>
            <p>Anchor installs straight from your browser. No app store needed. It opens full-screen and can send you notifications.</p>
            <ol className="wf-modal-steps">
              {ios ? (
                <>
                  <li>Open this page in <b>Safari</b>.</li>
                  <li>Tap the <b>Share</b> button at the bottom of the screen.</li>
                  <li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
                </>
              ) : (
                <>
                  <li><b>Android:</b> open this page in Chrome, tap the <b>⋮</b> menu, then <b>Install app</b>.</li>
                  <li><b>iPhone:</b> open it in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>.</li>
                  <li><b>Computer:</b> in Chrome or Edge, click the <b>install</b> icon at the right of the address bar.</li>
                </>
              )}
            </ol>
            <button type="button" className="wf-btn wf-btn-primary wf-btn-block" onClick={() => setOpen(false)}>Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
