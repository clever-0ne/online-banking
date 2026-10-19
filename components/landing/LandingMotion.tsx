"use client";

import { useEffect } from "react";

/**
 * Wires up the landing page's effects through data attributes, so the page itself stays a server component:
 *  data-reveal            fade/slide in when scrolled into view (data-delay="120" in ms)
 *  data-count="25"        count up from 0 (data-decimals, data-prefix, data-suffix)
 *  data-tilt              3D tilt toward the pointer
 *  .spot                  cursor spotlight on cards (sets --mx / --my)
 *  data-parallax="0.15"   drifts at a different speed while scrolling
 *  data-step="n"          showcase steps; the active one is written to [data-showcase]
 * Content is visible without JavaScript; hidden starting states only apply once .motion is on <html>.
 */
export function LandingMotion() {
  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.classList.add("motion");
    const cleanups: (() => void)[] = [() => root.classList.remove("motion")];

    // Reveal on scroll
    const revealIO = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        el.style.setProperty("--delay", `${el.dataset.delay ?? 0}ms`);
        el.classList.add("in");
        revealIO.unobserve(el);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => (reduce ? el.classList.add("in") : revealIO.observe(el)));
    cleanups.push(() => revealIO.disconnect());

    // Count-up numbers
    const countIO = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        countIO.unobserve(el);
        const to = Number(el.dataset.count), dec = Number(el.dataset.decimals ?? 0);
        const pre = el.dataset.prefix ?? "", suf = el.dataset.suffix ?? "";
        const show = (v: number) => (el.textContent = pre + v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf);
        if (reduce) { show(to); continue; }
        const t0 = performance.now(), dur = 1600;
        const step = (now: number) => {
          const k = Math.min(1, (now - t0) / dur);
          show(to * (1 - Math.pow(1 - k, 4)));
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.6 });
    document.querySelectorAll<HTMLElement>("[data-count]").forEach((el) => countIO.observe(el));
    cleanups.push(() => countIO.disconnect());

    // Pointer effects (skip on touch and reduced motion)
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (fine && !reduce) {
      const onMove = (e: PointerEvent) => {
        const t = e.target as HTMLElement;
        const spot = t.closest<HTMLElement>(".spot");
        if (spot) {
          const b = spot.getBoundingClientRect();
          spot.style.setProperty("--mx", `${e.clientX - b.left}px`);
          spot.style.setProperty("--my", `${e.clientY - b.top}px`);
        }
        document.querySelectorAll<HTMLElement>("[data-tilt]").forEach((el) => {
          const b = el.getBoundingClientRect();
          const near = e.clientX > b.left - 200 && e.clientX < b.right + 200 && e.clientY > b.top - 200 && e.clientY < b.bottom + 200;
          if (!near) { el.style.transform = ""; return; }
          const rx = ((e.clientY - (b.top + b.height / 2)) / b.height) * -10;
          const ry = ((e.clientX - (b.left + b.width / 2)) / b.width) * 12;
          el.style.transform = `perspective(1000px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
        });
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      cleanups.push(() => window.removeEventListener("pointermove", onMove));
    }

    // Scroll: nav state, progress bar, parallax
    const nav = document.querySelector<HTMLElement>(".lp-nav");
    const bar = document.querySelector<HTMLElement>(".lp-progress");
    const para = reduce ? [] : [...document.querySelectorAll<HTMLElement>("[data-parallax]")];
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        nav?.classList.toggle("scrolled", y > 24);
        const max = document.documentElement.scrollHeight - innerHeight;
        if (bar) bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
        for (const el of para) el.style.translate = `0 ${(y * Number(el.dataset.parallax)).toFixed(1)}px`;
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    cleanups.push(() => window.removeEventListener("scroll", onScroll));

    // Showcase: whichever step is mid-screen drives the phone
    const show = document.querySelector<HTMLElement>("[data-showcase]");
    if (show) {
      const stepIO = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const n = (e.target as HTMLElement).dataset.step!;
          show.dataset.showcase = n;
          document.querySelectorAll<HTMLElement>("[data-step]").forEach((s) => s.classList.toggle("active", s.dataset.step === n));
        }
      }, { rootMargin: "-45% 0px -45% 0px" });
      document.querySelectorAll<HTMLElement>("[data-step]").forEach((el) => stepIO.observe(el));
      cleanups.push(() => stepIO.disconnect());
    }

    return () => cleanups.forEach((c) => c());
  }, []);

  return null;
}
