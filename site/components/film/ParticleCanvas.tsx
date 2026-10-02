"use client";

import { useEffect, useRef } from "react";
import type { ParticleControls } from "./particles";

/**
 * The payments layer. three.js loads after the page is idle, only on screens at least 768px wide
 * with WebGL; elsewhere this renders an empty canvas and the film works without it.
 */
export function ParticleCanvas({
  controls,
  dialRef,
  className,
}: {
  controls: ParticleControls;
  dialRef: React.RefObject<SVGSVGElement | null>;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !window.matchMedia("(min-width: 768px)").matches) return;
    if (!document.createElement("canvas").getContext("webgl2")) return;

    let field: import("./particles").ParticleField | undefined;
    let cancelled = false;
    const observers: { disconnect(): void }[] = [];

    const start = async () => {
      const [THREE, { ParticleField }] = await Promise.all([import("three"), import("./particles")]);
      if (cancelled) return;
      const dialCenter = () => {
        const dial = dialRef.current?.getBoundingClientRect();
        const box = canvas.getBoundingClientRect();
        if (!dial || !dial.width) return null;
        return { x: dial.left + dial.width / 2 - box.left, y: dial.top + dial.height / 2 - box.top };
      };
      const created = new ParticleField(THREE, canvas, controls, dialCenter, 760);
      field = created;

      const resize = new ResizeObserver(() => created.resize());
      resize.observe(canvas);
      // Draw only while the film is on screen
      const visible = new IntersectionObserver(([entry]) => (entry.isIntersecting ? created.play() : created.pause()));
      visible.observe(canvas);
      observers.push(resize, visible);
    };

    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 300));
    const handle = idle(() => void start());

    return () => {
      cancelled = true;
      (window.cancelIdleCallback ?? window.clearTimeout)(handle as number);
      observers.forEach((o) => o.disconnect());
      field?.dispose();
    };
  }, [controls, dialRef]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
