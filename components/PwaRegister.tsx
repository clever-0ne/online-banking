"use client";

import { useEffect } from "react";
import { registerSw } from "./pwa";

/** Registers the service worker that makes Anchor Bank installable and lets it show notifications. In development
 *  it's registered only when someone turns notifications on, and it never caches there. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") void registerSw();
  }, []);
  return null;
}
