"use client";

import { useCallback, useEffect, useState } from "react";

/** Shows sensitive details for a limited time, then hides them again. */
export function useReveal(seconds = 30) {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  // Hide when the tab is put in the background.
  useEffect(() => {
    const onHide = () => { if (document.hidden) setLeft(0); };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  const show = useCallback(() => setLeft(seconds), [seconds]);
  const hide = useCallback(() => setLeft(0), []);
  return { revealed: left > 0, left, show, hide };
}
