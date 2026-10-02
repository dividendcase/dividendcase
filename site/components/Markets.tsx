"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Globe } from "./globe/Globe";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Facts about the app as it ships; `to` is what the number counts up to */
const STATS = [
  { prefix: "~", to: 700, suffix: "", label: "stocks in the screener" },
  { prefix: "", to: 10, suffix: " yrs", label: "of payout history" },
  { prefix: "", to: 0, suffix: "", label: "accounts needed" },
];

/**
 * Frame 7: the exchanges. A sticky stage holds the words and the globe while the section scrolls
 * past (about a screen), so the globe turns under your scroll.
 */
export function Markets() {
  const section = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const q = gsap.utils.selector(section);
      gsap.from(q("[data-reveal]"), {
        autoAlpha: 0,
        y: 28,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.08,
        scrollTrigger: { trigger: section.current, start: "top 70%", once: true },
      });
      q("[data-count]").forEach((el, i) => {
        const stat = STATS[i];
        const n = { v: 0 };
        el.textContent = `${stat.prefix}0${stat.suffix}`;
        gsap.to(n, {
          v: stat.to,
          duration: 1.4,
          ease: "power2.out",
          delay: 0.2 + i * 0.12,
          scrollTrigger: { trigger: section.current, start: "top 60%", once: true },
          onUpdate: () => (el.textContent = `${stat.prefix}${Math.round(n.v)}${stat.suffix}`),
        });
      });
    },
    { scope: section },
  );

  return (
    <section ref={section} id="markets" aria-labelledby="markets-title" className="relative h-[200dvh]">
      <div className="sticky top-0 flex h-dvh items-center overflow-hidden">
        <div className="container-page grid w-full grid-cols-1 items-center gap-6 pt-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10 lg:pt-0">
          <div>
            <h2 id="markets-title" data-reveal="" className="heading text-[clamp(32px,3.6vw,52px)]">
              Payers from eight exchanges.
            </h2>
            <p data-reveal="" className="mt-4 max-w-[480px] text-[17px] leading-[1.6] text-pretty text-ink-2 md:text-[19px]">
              About 700 dividend stocks to screen, from New York to Sydney, and any other ticker you add.
            </p>
            <dl className="mt-8 grid max-w-[480px] grid-cols-3 gap-6 md:mt-12">
              {STATS.map((s) => (
                <div key={s.label} data-reveal="">
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <span data-count="" className="num block text-[clamp(26px,2.4vw,34px)] font-medium tracking-[-0.03em] text-ink">
                      {`${s.prefix}${s.to}${s.suffix}`}
                    </span>
                    <span aria-hidden="true" className="mt-1 block text-[13px] leading-snug text-ink-3 md:text-[14px]">
                      {s.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <Globe className="mx-auto aspect-square w-full max-w-[min(680px,58vh)] lg:max-w-[min(680px,86vh)]" />
        </div>
      </div>
    </section>
  );
}
