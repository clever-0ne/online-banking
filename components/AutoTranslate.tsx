"use client";

// Translates the site into the visitor's language with Google Translate, picked from their location (or their own
// choice in Profile). English pages are left alone. Pages marked <meta name="google" content="notranslate">
// (the staff console) are never translated.
import { useEffect } from "react";
import { targetLanguage } from "./visitorLocale";

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: { translate?: { TranslateElement: new (opts: object, id: string) => unknown } };
  }
}

const COOKIE = "googtrans";
const readCookie = () => document.cookie.split("; ").find((c) => c.startsWith(COOKIE + "="))?.split("=")[1] ?? null;

function writeCookie(value: string | null) {
  const host = location.hostname;
  const domains = [""].concat(host.includes(".") ? [`; domain=${host}`, `; domain=.${host.split(".").slice(-2).join(".")}`] : []);
  for (const d of domains) {
    document.cookie = value === null ? `${COOKIE}=; path=/; max-age=0${d}` : `${COOKIE}=${value}; path=/; max-age=31536000${d}`;
  }
}

/** Google Translate swaps text for its own elements; this stops React from crashing when it later updates them. */
let patched = false;
function tolerateTranslatedDom() {
  if (patched || typeof Node !== "function") return;
  patched = true;
  const remove = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return remove.call(this, child) as T;
  };
  const insert = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (ref && ref.parentNode !== this) return node;
    return insert.call(this, node, ref) as T;
  };
}

export function AutoTranslate() {
  useEffect(() => {
    if (document.querySelector('meta[name="google"][content="notranslate"]')) return;
    let cancelled = false;
    targetLanguage().then((lang) => {
      if (cancelled) return;
      const want = lang && lang !== "en" ? `/en/${lang}` : null;
      const have = readCookie();
      if (!want) {
        // Back to English: drop Google's cookie and show the original page.
        if (have) { writeCookie(null); location.reload(); }
        return;
      }
      if (have !== want) writeCookie(want);
      tolerateTranslatedDom();
      if (document.getElementById("gt-script")) return;
      window.googleTranslateElementInit = () => {
        if (window.google?.translate) new window.google.translate.TranslateElement({ pageLanguage: "en", autoDisplay: false }, "gt-holder");
      };
      const s = document.createElement("script");
      s.id = "gt-script";
      s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      s.async = true;
      document.body.appendChild(s);
    });
    return () => { cancelled = true; };
  }, []);
  return <div id="gt-holder" hidden aria-hidden="true" translate="no" />;
}
