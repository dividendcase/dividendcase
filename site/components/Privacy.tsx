"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { LogoMark } from "@dividendcase/brand/logo";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Everything the app downloads, and from where (see SECURITY.md). Nothing goes the other way. */
const SOURCES = [
  { name: "Yahoo Finance", what: "Prices and dividend history" },
  { name: "European Central Bank", what: "Exchange rates" },
  { name: "Wikipedia", what: "Index member lists" },
  { name: "PyPI", what: "New versions, once a day (you can turn it off)", optional: true },
];

const SVG = "http://www.w3.org/2000/svg";

/**
 * Frame 8: what comes in, and that nothing goes out. Lines draw in from each source to the data
 * file as the section scrolls into view, then payments of data keep flowing along them.
 */
export function Privacy() {
  const section = useRef<HTMLElement>(null);
  const wires = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const root = section.current!;
      const svg = wires.current!;
      const q = gsap.utils.selector(root);
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const drawn = { share: still ? 1 : 0 };
      let lines: { path: SVGPathElement; dot: SVGCircleElement; length: number }[] = [];

      /** Rebuild the wires from where the sources and the file are on screen now */
      const build = () => {
        svg.replaceChildren();
        const box = svg.getBoundingClientRect();
        const file = q("[data-file]")[0].getBoundingClientRect();
        // On phones the sources sit above the box and one arrow stands in for the wires
        const wide = box.width >= 768;
        if (!wide) {
          lines = [];
          return;
        }
        lines = q("[data-source]").map((el, i) => {
          const s = el.getBoundingClientRect();
          const start = { x: s.right - box.left + 16, y: s.top + s.height / 2 - box.top };
          const end = { x: file.left - box.left - 10, y: file.top + file.height * (0.3 + i * 0.13) - box.top };
          const d = `M${start.x},${start.y} C${start.x + 120},${start.y} ${end.x - 140},${end.y} ${end.x},${end.y}`;
          const path = document.createElementNS(SVG, "path");
          path.setAttribute("d", d);
          path.setAttribute("fill", "none");
          path.setAttribute("stroke", "#5c5c70");
          path.setAttribute("stroke-width", "1.5");
          path.setAttribute("marker-end", "url(#privacy-arrow)");
          if (SOURCES[i].optional) path.setAttribute("stroke-dasharray", "5 5");
          const dot = document.createElementNS(SVG, "circle");
          dot.setAttribute("r", "3.5");
          dot.setAttribute("fill", "#ececf3");
          dot.setAttribute("opacity", "0");
          svg.append(path, dot);
          return { path, dot, length: path.getTotalLength() };
        });
        const defs = document.createElementNS(SVG, "defs");
        defs.innerHTML =
          '<marker id="privacy-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#a9a9bd"/></marker>';
        svg.prepend(defs);
        paint();
      };

      /** Show each wire up to the drawn share (the dashed one stays dashed once it's complete) */
      const paint = () => {
        lines.forEach(({ path, length }, i) => {
          const share = gsap.utils.clamp(0, 1, drawn.share * 1.6 - i * 0.2);
          if (SOURCES[i].optional && share >= 1) {
            path.setAttribute("stroke-dasharray", "5 5");
            path.style.strokeDashoffset = "0";
          } else {
            path.setAttribute("stroke-dasharray", `${length} ${length}`);
            path.style.strokeDashoffset = String(length * (1 - share));
          }
          path.setAttribute("marker-end", share > 0.98 ? "url(#privacy-arrow)" : "none");
        });
      };

      build();
      const resized = new ResizeObserver(build);
      resized.observe(root);
      if (still) return () => resized.disconnect();

      gsap.to(drawn, {
        share: 1,
        ease: "none",
        onUpdate: paint,
        scrollTrigger: { trigger: q("[data-diagram]")[0], start: "top 80%", end: "center 55%", scrub: 0.8 },
      });
      gsap.from(q("[data-reveal]"), {
        autoAlpha: 0,
        y: 24,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.08,
        scrollTrigger: { trigger: root, start: "top 70%", once: true },
      });

      // Once drawn, data keeps arriving along the wires
      const flow = { t: 0 };
      const tween = gsap.to(flow, {
        t: 1,
        duration: 2.4,
        ease: "none",
        repeat: -1,
        onUpdate: () => {
          lines.forEach(({ path, dot, length }, i) => {
            const t = (flow.t + i * 0.27) % 1;
            const ready = drawn.share >= 0.99;
            const at = path.getPointAtLength(t * length);
            dot.setAttribute("cx", String(at.x));
            dot.setAttribute("cy", String(at.y));
            dot.setAttribute("opacity", ready ? String(Math.sin(t * Math.PI) * 0.9) : "0");
          });
        },
      });
      return () => {
        resized.disconnect();
        tween.kill();
      };
    },
    { scope: section },
  );

  return (
    <section ref={section} id="privacy" aria-labelledby="privacy-title" className="container-page py-28 md:py-40">
      <h2 id="privacy-title" data-reveal="" className="heading max-w-[760px] text-[clamp(32px,3.6vw,52px)]">
        Your holdings stay on your computer.
      </h2>
      <p data-reveal="" className="mt-4 max-w-[600px] text-[17px] leading-[1.6] text-pretty text-ink-2 md:text-[19px]">
        The app only downloads public market data and never connects to your broker or bank. There&apos;s no account,
        no tracking, and nothing is sent to us.
      </p>

      <div data-diagram="" className="relative mt-14 grid grid-cols-1 gap-12 md:mt-20 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] md:items-center md:gap-28">
        <ul className="space-y-7 md:space-y-10">
          {SOURCES.map((s) => (
            <li key={s.name} data-source="" data-reveal="" className="w-fit">
              <p className="text-[17px] font-medium text-ink">{s.name}</p>
              <p className="mt-0.5 text-[14px] text-ink-3">{s.what}</p>
            </li>
          ))}
        </ul>

        <div className="-my-4 flex justify-center md:hidden" aria-hidden="true">
          <svg viewBox="0 0 16 48" className="h-12 w-4 text-ink-3">
            <path d="M8 0 V40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4" />
            <path d="M3 36 L8 44 L13 36" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>

        <div className="relative min-h-[380px] rounded-[28px] border-[1.5px] border-line-strong bg-[radial-gradient(ellipse_55%_55%_at_50%_42%,rgb(122_191_80/0.08)_0%,var(--color-well)_70%)] p-7 md:min-h-[460px]">
          <p className="font-mono text-[12px] text-ink-3">Your computer</p>
          <div data-file="" className="mx-auto mt-10 flex w-fit flex-col items-center gap-3 px-6 text-center md:mt-14">
            <LogoMark className="size-20 md:size-24" />
            <p className="font-mono text-[16px] text-ink md:text-[17px]">dividendcase.db</p>
            <p className="text-[14px] text-ink-2 md:text-[15px]">Holdings, purchase lots, watchlists and settings</p>
          </div>
          <p className="absolute right-7 bottom-6 left-7 text-[13px] text-ink-3 md:text-[14px]">
            Listens on <span className="num text-ink-2">127.0.0.1</span>, so only this computer can reach it.
          </p>
        </div>

        <svg ref={wires} className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden="true" />
      </div>
    </section>
  );
}
