"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { PAYMENTS } from "./example";

const SVG = "http://www.w3.org/2000/svg";
/** The dial's steel rim as a share of the dial's drawn width (viewBox 680, rim radius 274) */
const RIM = 274 / 680;

type Point = { x: number; y: number };

/**
 * Dividend payments arriving at the dial: a curved trail drawn in from the edge of the screen,
 * with the ticker and amount riding along it, absorbed into the dial's rim. New payments keep
 * arriving while `active()` is true (the hero is on screen). `still` draws three finished trails
 * instead, for visitors who ask for less motion.
 */
export function PaymentTrails({
  stageRef,
  dialRef,
  active = () => true,
  still = false,
}: {
  stageRef: React.RefObject<HTMLElement | null>;
  dialRef: React.RefObject<SVGSVGElement | null>;
  active?: () => boolean;
  still?: boolean;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const svg = svgRef.current;
    if (!layer || !svg) return;
    let count = 0;
    let live = 0;
    let stopped = false;
    const timers = new Set<gsap.core.Animation>();

    /** A trail's geometry from the dial's current place on screen */
    const geometry = (n: number) => {
      const stage = stageRef.current?.getBoundingClientRect();
      const dial = dialRef.current?.getBoundingClientRect();
      if (!stage || !dial || !dial.width || getComputedStyle(dialRef.current!).visibility === "hidden") return null;
      const centre = { x: dial.left + dial.width / 2 - stage.left, y: dial.top + dial.height / 2 - stage.top };
      const radius = dial.width * RIM;
      // Come in from the side away from the headline: the right half on wide screens, the sides on phones
      const phone = stage.width < 768;
      const angles = phone ? [-25, 205, 15, 165, -40, 220] : [-62, 28, -18, 66, -88, 4, 48, -40];
      const angle = ((angles[n % angles.length] + (Math.random() - 0.5) * 14) * Math.PI) / 180;
      const end = { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius };
      const reach = Math.max(stage.width, stage.height) * 0.7;
      const start = { x: centre.x + Math.cos(angle) * reach, y: centre.y + Math.sin(angle) * reach };
      // Bow the line: alternate sides so trails don't all curl the same way
      const bend = (n % 2 ? 1 : -1) * (0.16 + Math.random() * 0.1);
      const ctrl = {
        x: (start.x + end.x) / 2 - (end.y - start.y) * bend,
        y: (start.y + end.y) / 2 + (end.x - start.x) * bend,
      };
      return { start, ctrl, end, width: stage.width, height: stage.height };
    };

    const make = (n: number) => {
      const g = geometry(n);
      if (!g) return null;
      svg.setAttribute("viewBox", `0 0 ${g.width} ${g.height}`);
      const id = `trail-${n}`;
      const gradient = document.createElementNS(SVG, "linearGradient");
      gradient.id = id;
      gradient.setAttribute("gradientUnits", "userSpaceOnUse");
      gradient.setAttribute("x1", String(g.start.x));
      gradient.setAttribute("y1", String(g.start.y));
      gradient.setAttribute("x2", String(g.end.x));
      gradient.setAttribute("y2", String(g.end.y));
      for (const [offset, opacity] of [["0", "0"], ["0.55", "0.35"], ["1", "0.95"]]) {
        const stop = document.createElementNS(SVG, "stop");
        stop.setAttribute("offset", offset);
        stop.setAttribute("stop-color", "#9bd96b");
        stop.setAttribute("stop-opacity", opacity);
        gradient.appendChild(stop);
      }
      const path = document.createElementNS(SVG, "path");
      path.setAttribute("d", `M${g.start.x},${g.start.y} Q${g.ctrl.x},${g.ctrl.y} ${g.end.x},${g.end.y}`);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", `url(#${id})`);
      path.setAttribute("stroke-width", "1.6");
      path.setAttribute("stroke-linecap", "round");
      const halo = document.createElementNS(SVG, "circle");
      halo.setAttribute("r", "11");
      halo.setAttribute("fill", "#9bd96b");
      halo.setAttribute("opacity", "0.16");
      const dot = document.createElementNS(SVG, "circle");
      dot.setAttribute("r", "4");
      dot.setAttribute("fill", "#b6ec8a");
      svg.append(gradient, path, halo, dot);

      const payment = PAYMENTS[n % PAYMENTS.length];
      const label = document.createElement("div");
      label.className =
        "absolute top-0 left-0 flex items-baseline gap-2.5 rounded-[7px] border border-line bg-surface/90 px-2.5 py-1.5 font-mono text-[12px] whitespace-nowrap";
      const ticker = document.createElement("span");
      ticker.className = "text-ink";
      ticker.textContent = payment.ticker;
      const amount = document.createElement("span");
      amount.className = "text-sprout-hi";
      amount.textContent = payment.amount;
      label.append(ticker, amount);
      layer.appendChild(label);

      const length = path.getTotalLength();
      /** Draw the trail up to share t of its length, with the dot and the label at its head */
      const draw = (t: number, labelAt = t) => {
        path.style.strokeDasharray = `${length} ${length}`;
        path.style.strokeDashoffset = String(length * (1 - t));
        const head = path.getPointAtLength(t * length);
        dot.setAttribute("cx", String(head.x));
        dot.setAttribute("cy", String(head.y));
        halo.setAttribute("cx", String(head.x));
        halo.setAttribute("cy", String(head.y));
        const at = path.getPointAtLength(labelAt * length);
        // Keep the label on screen and to the outside of the curve
        const x = Math.min(Math.max(at.x + 14, 8), g.width - label.offsetWidth - 8);
        const y = Math.min(Math.max(at.y - 34, 76), g.height - 40);
        gsap.set(label, { x, y });
      };
      const remove = () => {
        gradient.remove();
        path.remove();
        halo.remove();
        dot.remove();
        label.remove();
      };
      return { draw, remove, path, halo, dot, label };
    };

    if (still) {
      const drawn = [0, 1, 2].map((n) => make(n));
      drawn.forEach((t) => t?.draw(0.92, 0.6));
      return () => drawn.forEach((t) => t?.remove());
    }

    const spawn = () => {
      if (stopped) return;
      if (live < 4 && active() && document.visibilityState === "visible") {
        const trail = make(count++);
        if (trail) {
          live++;
          const progress = { t: 0 };
          const tl = gsap.timeline({
            onComplete: () => {
              trail.remove();
              live--;
              timers.delete(tl);
            },
          });
          tl.to(progress, { t: 1, duration: 2.8, ease: "power1.inOut", onUpdate: () => trail.draw(progress.t) })
            .fromTo(trail.label, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45 }, 0.55)
            .to(trail.label, { autoAlpha: 0, scale: 0.85, duration: 0.35 }, 2.5)
            .to([trail.path, trail.halo, trail.dot], { opacity: 0, duration: 0.7 }, 2.6);
          timers.add(tl);
        }
      }
      const next = gsap.delayedCall(0.9 + Math.random() * 0.7, spawn);
      timers.add(next);
    };
    const first = gsap.delayedCall(1.2, spawn);
    timers.add(first);

    return () => {
      stopped = true;
      timers.forEach((t) => t.kill());
      svg.replaceChildren();
      layer.querySelectorAll(":scope > div").forEach((d) => d.remove());
    };
  }, [stageRef, dialRef, active, still]);

  return (
    <div ref={layerRef} data-trails="" className="pointer-events-none absolute inset-0" aria-hidden="true">
      <svg ref={svgRef} className="absolute inset-0 size-full overflow-visible" />
    </div>
  );
}
