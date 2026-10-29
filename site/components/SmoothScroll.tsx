"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** The element a page was opened at (/#hosted-account, where the hosted app's old addresses redirect) */
function hashTarget(): HTMLElement | null {
  const id = decodeURIComponent(window.location.hash.slice(1));
  return id ? document.getElementById(id) : null;
}

/**
 * Smooth, slightly weighted scrolling (Lenis), driven by GSAP's clock so scroll-linked scenes and
 * the scroll itself move in the same frame. Off for visitors who ask for less motion.
 *
 * A page opened at an anchor is scrolled there once the scroll scenes are set up: the browser's own
 * jump happens first and gets reset to the top while they measure the page.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let lenis: Lenis | null = null;
    let tick: ((time: number) => void) | null = null;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Anchor links stop below the fixed nav: Lenis reads scroll-padding-top from globals.css
      lenis = new Lenis({ lerp: 0.1, anchors: true });
      lenis.on("scroll", ScrollTrigger.update);
      const l = lenis;
      tick = (time: number) => l.raf(time * 1000);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
    }

    const jump = () => {
      const target = hashTarget();
      if (!target) return;
      if (!lenis) return target.scrollIntoView();
      // The position the browser's own jump would use: below the nav (scroll-padding-top on html)
      // and the element's scroll-margin-top. Lenis given the element itself overshoots here.
      const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      const y = target.getBoundingClientRect().top + window.scrollY - padding - margin;
      lenis.scrollTo(y, { immediate: true, force: true });
    };
    // After the scenes have measured the page (ScrollTrigger refreshes on load)
    const timer = window.setTimeout(jump, 300);
    window.addEventListener("load", jump, { once: true });

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("load", jump);
      if (tick) gsap.ticker.remove(tick);
      lenis?.destroy();
    };
  }, []);
  return <>{children}</>;
}
