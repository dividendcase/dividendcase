"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { LogoMark } from "@dividendcase/brand/logo";
import { landPoints } from "./land";

gsap.registerPlugin(ScrollTrigger);

/** The exchanges the screener covers, by city. Close neighbours put their label on the other side. */
const EXCHANGES = [
  { label: "NYSE, Nasdaq", city: "New York", lat: 40.71, lon: -74.01, left: false, dy: 10 },
  { label: "TSX", city: "Toronto", lat: 43.65, lon: -79.38, left: true, dy: -8 },
  { label: "LSE", city: "London", lat: 51.51, lon: -0.13, left: false, dy: 10 },
  { label: "Euronext Dublin", city: "Dublin", lat: 53.35, lon: -6.26, left: true, dy: -8 },
  { label: "NSE, BSE", city: "Mumbai", lat: 19.08, lon: 72.88, left: false, dy: 0 },
  { label: "ASX", city: "Sydney", lat: -33.87, lon: 151.21, left: false, dy: 0 },
].map((e, i) => ({ ...e, lat: (e.lat * Math.PI) / 180, lon: (e.lon * Math.PI) / 180, phase: i * 0.37 }));

const TILT = (18 * Math.PI) / 180;
const DEG = Math.PI / 180;

/**
 * A dotted globe on a 2D canvas (no WebGL, so it works everywhere). It turns as the section
 * scrolls past and drifts slowly on its own; each exchange lights up as it comes round to the
 * front and sends a stream of payments to "Your computer". With reduced motion it is drawn once.
 */
export function Globe({ className = "" }: { className?: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    const node = nodeRef.current;
    const ctx = canvas?.getContext("2d");
    if (!box || !canvas || !node || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { lat, lon } = landPoints();
    const mono = getComputedStyle(node).fontFamily;

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = box.clientWidth;
      h = box.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();

    let scrolled = 0; // smoothed scroll progress through the section
    let target = 0;
    const trigger = ScrollTrigger.create({
      trigger: box,
      start: "top bottom",
      end: "bottom top",
      onUpdate: (self) => (target = self.progress),
    });

    const project = (pLat: number, pLon: number, lon0: number) => {
      const cosLat = Math.cos(pLat);
      const dl = pLon - lon0;
      return {
        x: cosLat * Math.sin(dl),
        y: Math.cos(TILT) * Math.sin(pLat) - Math.sin(TILT) * cosLat * Math.cos(dl),
        z: Math.sin(TILT) * Math.sin(pLat) + Math.cos(TILT) * cosLat * Math.cos(dl),
      };
    };

    const draw = (time: number) => {
      scrolled += (target - scrolled) * 0.08;
      // Start over the Atlantic; scrolling and time turn it eastwards, past Mumbai to Sydney
      const lon0 = (-38 + scrolled * 200 + (still ? 0 : time * 0.5)) * DEG;
      const R = Math.min(w * 0.4, h * 0.42);
      const cx = w * 0.56;
      const cy = h * 0.44;
      const nodeBox = node.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      const home = { x: nodeBox.left + nodeBox.width / 2 - boxRect.left, y: nodeBox.top - boxRect.top + 4 };

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Halo and the sphere itself
      const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.25);
      halo.addColorStop(0, "rgba(122,191,80,0.10)");
      halo.addColorStop(1, "rgba(122,191,80,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);
      const sphere = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      sphere.addColorStop(0, "#262632");
      sphere.addColorStop(0.6, "#13131a");
      sphere.addColorStop(1, "#0a0a0e");
      ctx.fillStyle = sphere;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();

      // Land, brighter towards the front
      const size = Math.max(1.3, R / 170);
      for (let i = 0; i < lat.length; i++) {
        const p = project(lat[i], lon[i], lon0);
        if (p.z <= 0) continue;
        ctx.fillStyle = `rgba(150,150,180,${0.12 + p.z * 0.5})`;
        ctx.fillRect(cx + p.x * R - size / 2, cy - p.y * R - size / 2, size, size);
      }
      ctx.strokeStyle = "rgba(155,217,107,0.22)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // Exchanges facing us send payments to "Your computer": the arcs first, then the points and
      // labels over them
      ctx.font = `12px ${mono}`;
      const facingNow = EXCHANGES.map((e) => {
        const p = project(e.lat, e.lon, lon0);
        return { e, x: cx + p.x * R, y: cy - p.y * R, facing: Math.max(0, Math.min(1, (p.z - 0.05) / 0.3)) };
      }).filter((f) => f.facing > 0);
      for (const { e, x, y, facing } of facingNow) {
        const ctrl = { x: (x + home.x) / 2 - R * 0.25, y: Math.min(y, home.y) - R * 0.1 };
        const arc = ctx.createLinearGradient(x, y, home.x, home.y);
        arc.addColorStop(0, `rgba(155,217,107,${0.75 * facing})`);
        arc.addColorStop(1, `rgba(155,217,107,${0.15 * facing})`);
        ctx.strokeStyle = arc;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(ctrl.x, ctrl.y, home.x, home.y);
        ctx.stroke();
        // A payment travelling down the arc
        const t = still ? 0.55 : (time * 0.32 + e.phase) % 1;
        const bx = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * ctrl.x + t * t * home.x;
        const by = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * ctrl.y + t * t * home.y;
        ctx.fillStyle = `rgba(182,236,138,${facing})`;
        ctx.beginPath();
        ctx.arc(bx, by, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const { e, x, y, facing } of facingNow) {
        ctx.fillStyle = `rgba(155,217,107,${0.18 * facing})`;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(182,236,138,${facing})`;
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.textAlign = e.left ? "right" : "left";
        const lx = e.left ? x - 12 : x + 12;
        // A dark halo behind the words keeps them readable over the arcs
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(14,14,19,0.85)";
        ctx.strokeText(e.label, lx, y - 10 + e.dy);
        ctx.strokeText(e.city, lx, y + 5 + e.dy);
        ctx.fillStyle = `rgba(236,236,243,${facing})`;
        ctx.fillText(e.label, lx, y - 10 + e.dy);
        ctx.fillStyle = `rgba(128,128,154,${facing})`;
        ctx.fillText(e.city, lx, y + 5 + e.dy);
      }
    };

    let frame = 0;
    let running = false;
    const loop = (ms: number) => {
      draw(ms / 1000);
      if (running) frame = requestAnimationFrame(loop);
    };
    const play = () => {
      if (still) return draw(0);
      if (running) return;
      running = true;
      frame = requestAnimationFrame(loop);
    };
    const pause = () => {
      running = false;
      cancelAnimationFrame(frame);
    };
    const visible = new IntersectionObserver(([entry]) => (entry.isIntersecting ? play() : pause()));
    visible.observe(box);
    const sized = new ResizeObserver(() => {
      resize();
      if (!running) draw(0);
    });
    sized.observe(box);

    return () => {
      pause();
      visible.disconnect();
      sized.disconnect();
      trigger.kill();
    };
  }, []);

  return (
    <div ref={boxRef} className={`relative ${className}`} aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      <div
        ref={nodeRef}
        className="absolute bottom-[4%] left-[6%] inline-flex items-center gap-2.5 rounded-[11px] border border-sprout/45 bg-surface py-2 pr-3.5 pl-2.5 font-mono text-[13px] shadow-[0_0_0_4px_rgb(122_191_80/0.08)]"
      >
        <LogoMark className="size-6" />
        <span className="font-sans font-medium text-ink">Your computer</span>
      </div>
    </div>
  );
}
