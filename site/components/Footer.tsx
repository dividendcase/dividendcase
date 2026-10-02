"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowRight } from "@phosphor-icons/react";
import { GITHUB_URL, buttonPrimary } from "./site";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const LINKS = [
  { href: GITHUB_URL, label: "GitHub" },
  { href: "https://pypi.org/project/dividendcase/", label: "PyPI" },
  { href: `${GITHUB_URL}/pkgs/container/dividendcase`, label: "Docker image" },
  { href: `${GITHUB_URL}/blob/main/SECURITY.md`, label: "Security" },
  { href: "#privacy", label: "Privacy" },
];

/**
 * Frame 12: the end. As you reach the bottom the logo's leaves grow out of the vault and the
 * wordmark rises into place.
 */
export function Footer() {
  const footer = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const q = gsap.utils.selector(footer);
      gsap.from(q("[data-leaf]"), {
        scaleY: 0,
        transformOrigin: "50% 100%",
        duration: 1.1,
        ease: "back.out(1.6)",
        stagger: 0.12,
        scrollTrigger: { trigger: footer.current, start: "top 75%", once: true },
      });
      gsap.fromTo(
        q("[data-wordmark]"),
        { yPercent: 45 },
        { yPercent: 0, ease: "none", scrollTrigger: { trigger: footer.current, start: "top bottom", end: "bottom bottom", scrub: 0.8 } },
      );
    },
    { scope: footer },
  );

  return (
    <footer ref={footer} className="relative overflow-hidden border-t border-line bg-[radial-gradient(ellipse_60%_45%_at_50%_100%,rgb(74_140_26/0.16)_0%,var(--color-ground)_70%)]">
      <div className="container-page pt-24 md:pt-32">
        <div className="flex flex-col gap-10 md:flex-row md:items-center md:gap-14">
          <GrowingMark />
          <div>
            <p className="heading max-w-[620px] text-[clamp(32px,3.8vw,56px)]">Your dividends, on your computer.</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
              <a
                href="#install"
                className={`${buttonPrimary} px-5 py-3 text-[15px] shadow-[0_10px_30px_-12px_rgb(122_191_80/0.55)] active:translate-y-px`}
              >
                Install for free
                <ArrowRight weight="bold" className="size-4" aria-hidden />
              </a>
              <a href={GITHUB_URL} className="border-b border-line-strong pb-0.5 text-[15px] font-medium text-ink hover:border-ink-3">
                View on GitHub
              </a>
            </div>
          </div>
        </div>

        <div className="mt-20 flex flex-col gap-6 border-t border-line pt-7 md:flex-row md:items-center md:justify-between">
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-8 gap-y-3 text-[14px] text-ink-2 md:text-[15px]">
              {LINKS.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="transition-colors hover:text-ink">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="space-y-1 text-[12.5px] leading-[1.6] text-ink-3 md:text-right">
            <p>AGPL-3.0-or-later. Not financial advice. Not affiliated with Yahoo.</p>
            <p>© 2026 DividendCase. The name and logo are not covered by the licence.</p>
          </div>
        </div>
      </div>

      <p
        data-wordmark=""
        aria-hidden="true"
        className="mt-10 -mb-[0.24em] pl-[3vw] text-[clamp(64px,14.6vw,232px)] leading-none font-semibold tracking-[-0.055em] whitespace-nowrap select-none"
      >
        <span className="text-stem">Dividend</span>
        <span className="text-[#1f1f29]">Case</span>
      </p>
    </footer>
  );
}

/** The logo, drawn here so its three leaves can grow */
function GrowingMark() {
  return (
    <svg viewBox="0 0 200 200" className="size-28 flex-none md:size-36" aria-hidden="true">
      <g data-leaf="">
        <path d="M87,89 C80,76 68,56 73,34 C82,50 86,70 94,87Z" fill="#4a8c1a" />
        <path d="M87,89 C84,77 80,60 73,34 C82,50 86,70 94,87Z" fill="#7abf50" opacity="0.4" />
      </g>
      <g data-leaf="">
        <path d="M100,90 C88,68 84,38 100,5 C116,38 112,68 100,90Z" fill="#2d6010" />
        <path d="M100,90 C94,68 90,38 100,5 C100,38 100,68 100,90Z" fill="#5a9e2f" opacity="0.5" />
        <line x1="100" y1="90" x2="100" y2="5" stroke="#639922" strokeWidth="0.9" strokeLinecap="round" opacity="0.4" />
      </g>
      <g data-leaf="">
        <path d="M113,89 C120,76 132,56 127,34 C118,50 114,70 106,87Z" fill="#4a8c1a" />
        <path d="M113,89 C116,77 120,60 127,34 C118,50 114,70 106,87Z" fill="#7abf50" opacity="0.4" />
      </g>
      <rect x="15" y="86" width="170" height="103" rx="13" fill="#343444" />
      <rect x="19" y="90" width="162" height="95" rx="11" fill="#5c5c70" />
      <ellipse cx="63" cy="108" rx="22" ry="9" fill="#ffffff" opacity="0.055" transform="rotate(-18,63,108)" />
      <rect x="10" y="103" width="12" height="20" rx="3.5" fill="#8888a0" />
      <rect x="10" y="133" width="12" height="20" rx="3.5" fill="#8888a0" />
      <circle cx="114" cy="140" r="31" fill="#3a3a4e" />
      <circle cx="114" cy="140" r="27" fill="#7070a0" />
      <circle cx="114" cy="140" r="23" fill="none" stroke="#c0c0d8" strokeWidth="7" strokeDasharray="4 8.04" />
      <circle cx="114" cy="140" r="18" fill="#d0d0e0" />
      <circle cx="114" cy="140" r="17" fill="none" stroke="#9090b0" strokeWidth="1" />
      <circle cx="114" cy="140" r="7" fill="#707090" />
      <circle cx="114" cy="140" r="4" fill="#9090b0" />
      <circle cx="114" cy="140" r="2" fill="#d0d0e0" />
      <rect x="112.5" y="113" width="3" height="7" rx="1.5" fill="#2a2a38" />
      <rect x="30" y="184" width="28" height="11" rx="4" fill="#888898" />
      <rect x="142" y="184" width="28" height="11" rx="4" fill="#888898" />
    </svg>
  );
}
