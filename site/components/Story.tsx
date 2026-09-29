"use client";

import { useRef, useState } from "react";
import NumberFlow from "@number-flow/react";
import {
  m,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { MARKETS, SAMPLE_INCOME, SAMPLE_MONTHS } from "./site";

/*
 * "How it works": three steps told with the logo's vault.
 *
 * Desktop (>= 1024px, motion allowed): the step texts scroll normally on the left while a sticky
 * stage on the right plays one scroll-linked timeline (progress p from 0 to 1 across the steps).
 * Phones, tablets and reduced motion: each step shows its finished illustration under the text.
 * The text itself is never hidden or faded.
 */

const STEPS = [
  {
    word: "Unlock",
    title: "Add what you own",
    body:
      "Import your broker export with the Excel template, or add purchase lots by hand, in any currency. " +
      "Stocks from eight exchanges are covered, and ETFs such as SPY or VTI too.",
    points: ["Up to 4 portfolios", "Individual purchase lots", "Excel import and export"],
  },
  {
    word: "Open",
    title: "See every payment coming",
    body:
      "A 12-month income calendar is projected from each holding's payment history, in each currency. " +
      "Diversification charts show where the income comes from.",
    points: ["12-month calendar", "Sector, industry and country", "Payment frequency"],
  },
  {
    word: "Grow",
    title: "Watch it compound",
    body:
      "Model reinvestment with the DRIP calculator, and check a stock's dividend growth, growth streak " +
      "and safety score before you buy more.",
    points: ["DRIP calculator", "3, 5 and 10-year growth", "Safety score 0–100"],
  },
] as const;

/* The timeline, as fractions of the scroll through the three steps */
const T = {
  dial: [0, 0.28],
  markets: [0.03, 0.23],
  toOpen: [0.29, 0.36],
  door: [0.35, 0.43],
  cards: [0.4, 0.5],
  calendar: [0.47, 0.55],
  toGrow: [0.62, 0.69],
  bars: [0.67, 0.8],
  leaves: [0.78, 0.86],
} as const;

export function Story() {
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ["start center", "end center"] });
  const [active, setActive] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(Math.min(2, Math.max(0, Math.floor(v * 3))));
  });

  // Finished state, for the stacked illustrations on small screens and for reduced motion
  const done = useMotionValue(1);
  const staticScenes = [<SceneUnlock key="u" p={done} />, <SceneOpen key="o" p={done} />, <SceneGrow key="g" p={done} />];

  return (
    <section id="how-it-works" aria-labelledby="how-title" className="relative overflow-x-clip py-24 sm:py-28">
      <div className="container-page">
        <div className="max-w-[640px]">
          <p className="eyebrow">How it works</p>
          <h2 id="how-title" className="heading mt-4 text-[34px] sm:text-[44px]">
            Add it once. Watch it <em className="serif-accent text-[1.1em]">grow</em>.
          </h2>
          <p className="mt-4 text-[17px] leading-[1.6] text-ink-2">
            Three steps from a broker export to a year of dividend income you can see coming.
          </p>
        </div>

        <div
          ref={trackRef}
          className="relative mt-14 lg:motion-safe:mt-6 lg:motion-safe:grid lg:motion-safe:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:motion-safe:gap-16"
        >
          <ol className="space-y-20 lg:space-y-24 lg:motion-safe:space-y-0">
            {STEPS.map((s, i) => (
              <li
                key={s.word}
                className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center lg:gap-14 lg:motion-safe:flex lg:motion-safe:min-h-[78vh]"
              >
                <div
                  data-active={active === i}
                  className="border-l-2 border-line pl-5 transition-colors duration-300 sm:pl-6 lg:motion-safe:data-[active=true]:border-sprout"
                >
                  <p className="eyebrow">
                    <span className="num text-ink-2">{String(i + 1).padStart(2, "0")}</span> · {s.word}
                  </p>
                  <h3 className="heading mt-3 text-[26px] sm:text-[30px]">{s.title}</h3>
                  <p className="mt-3 max-w-[460px] text-[16.5px] leading-[1.6] text-ink-2">{s.body}</p>
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {s.points.map((pt) => (
                      <li
                        key={pt}
                        className="rounded-full border border-line bg-surface px-3 py-1 text-[13px] text-ink-2"
                      >
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
                <div
                  aria-hidden="true"
                  className="@container min-h-[340px] rounded-2xl border border-line bg-surface shadow-card lg:min-h-[400px] lg:motion-safe:hidden"
                >
                  {staticScenes[i]}
                </div>
              </li>
            ))}
          </ol>

          <div className="hidden lg:motion-safe:block">
            <div
              className="sticky"
              style={{ top: "max(5.5rem, calc(50vh - 17rem))", height: "min(34rem, calc(100vh - 7rem))" }}
            >
              <Stage p={scrollYProgress} active={active} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ stage */

function Stage({ p, active }: { p: MotionValue<number>; active: number }) {
  // Each scene fades out fully before the next one fades in, so the two never overlap
  const [a1, b1] = T.toOpen;
  const [a2, b2] = T.toGrow;
  const m1 = (a1 + b1) / 2;
  const m2 = (a2 + b2) / 2;
  const o1 = useTransform(p, [a1, m1], [1, 0]);
  const y1 = useTransform(p, [a1, m1], [0, -14]);
  const o2 = useTransform(p, [m1, b1, a2, m2], [0, 1, 1, 0]);
  const y2 = useTransform(p, [m1, b1, a2, m2], [14, 0, 0, -14]);
  const o3 = useTransform(p, [m2, b2], [0, 1]);
  const y3 = useTransform(p, [m2, b2], [14, 0]);
  const fill = useTransform(p, [0.02, 0.88], [0, 1]);

  return (
    <div aria-hidden="true" className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
      <div className="border-b border-line px-5 pt-4 pb-3.5">
        <div className="flex items-center justify-between gap-3">
          {STEPS.map((s, i) => (
            <span
              key={s.word}
              className={`flex items-center gap-2 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors duration-300 ${
                i === active ? "text-ink" : "text-ink-3"
              }`}
            >
              <span
                className={`size-1.5 rounded-full transition-colors duration-300 ${
                  i <= active ? "bg-sprout" : "bg-line-strong"
                }`}
              />
              {String(i + 1).padStart(2, "0")} {s.word}
            </span>
          ))}
        </div>
        <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-line">
          <m.div className="h-full rounded-full bg-sprout" style={{ scaleX: fill, originX: 0 }} />
        </div>
      </div>

      <div className="@container relative flex-1">
        <m.div className="absolute inset-0" style={{ opacity: o1, y: y1 }}>
          <SceneUnlock p={p} />
        </m.div>
        <m.div className="absolute inset-0" style={{ opacity: o2, y: y2 }}>
          <SceneOpen p={p} />
        </m.div>
        <m.div className="absolute inset-0" style={{ opacity: o3, y: y3 }}>
          <SceneGrow p={p} />
        </m.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ 1 · unlock */

const DIAL_TICKS = Array.from({ length: 24 }, (_, i) => i * 15);

function SceneUnlock({ p }: { p: MotionValue<number> }) {
  const rotate = useTransform(p, [...T.dial], [-50, 250]);
  const step = (T.markets[1] - T.markets[0]) / MARKETS.length;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-7 px-5 py-8">
      <div className="relative size-[170px] @md:size-[200px]">
        {/* fixed pointer above the dial */}
        <svg viewBox="0 0 20 12" className="absolute -top-3 left-1/2 w-4 -translate-x-1/2" focusable="false">
          <path d="M2 1h16l-8 10z" fill="#ececf3" />
        </svg>
        <m.svg viewBox="-110 -110 220 220" className="size-full" style={{ rotate }} focusable="false">
          <circle r="106" fill="#2c2c3c" />
          <circle r="100" fill="#3a3a4e" />
          <circle r="90" fill="#7070a0" />
          {DIAL_TICKS.map((deg) => (
            <rect
              key={deg}
              x={deg % 45 === 0 ? -3 : -1.8}
              y={-88}
              width={deg % 45 === 0 ? 6 : 3.6}
              height={deg % 45 === 0 ? 17 : 11}
              rx={1.6}
              fill="#c0c0d8"
              transform={`rotate(${deg})`}
            />
          ))}
          <circle r="60" fill="#d0d0e0" />
          <circle r="56" fill="none" stroke="#9090b0" strokeWidth="1.5" />
          <circle r="22" fill="#707090" />
          <circle r="13" fill="#9090b0" />
          <circle r="6" fill="#d0d0e0" />
          <rect x="-3" y="-58" width="6" height="16" rx="3" fill="#2a2a38" />
        </m.svg>
      </div>

      <ul className="flex max-w-[400px] flex-wrap justify-center gap-2">
        {MARKETS.map((mk, i) => (
          <MarketChip key={mk} p={p} from={T.markets[0] + i * step} label={mk} />
        ))}
      </ul>
    </div>
  );
}

function MarketChip({ p, from, label }: { p: MotionValue<number>; from: number; label: string }) {
  const lit = useTransform(p, [from, from + 0.02], [0, 1]);
  const color = useTransform(lit, [0, 1], ["#80809a", "#ececf3"]);
  return (
    <li className="relative flex items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-1 font-mono text-[10.5px] tracking-[0.06em] uppercase @md:text-[11px]">
      <m.span className="absolute inset-0 rounded-full border border-line-strong bg-overlay" style={{ opacity: lit }} />
      <span className="relative size-1.5 rounded-full bg-line-strong">
        <m.span className="absolute inset-0 rounded-full bg-sprout" style={{ opacity: lit }} />
      </span>
      <m.span className="relative whitespace-nowrap" style={{ color }}>
        {label}
      </m.span>
    </li>
  );
}

/* -------------------------------------------------------------- 2 · open */

const HOLDINGS = [
  { ticker: "KO", name: "Coca-Cola", currency: "USD", date: "Oct 1", amount: "$46.20" },
  { ticker: "ENB", name: "Enbridge", currency: "CAD", date: "Dec 1", amount: "C$61.02" },
  { ticker: "ULVR", name: "Unilever", currency: "GBP", date: "Dec 5", amount: "£38.64" },
] as const;

/* How many payments land in each month of the sample calendar */
const PAYMENTS_PER_MONTH = [4, 2, 3, 2, 2, 4, 2, 2, 4, 2, 3, 4] as const;

function SceneOpen({ p }: { p: MotionValue<number> }) {
  const door = useTransform(p, [...T.door], [0, -104]);
  const shade = useTransform(p, [...T.door], [0, 0.35]);
  const calendar = useTransform(p, [...T.calendar], [0, 1]);
  const span = (T.cards[1] - T.cards[0]) / HOLDINGS.length;

  return (
    <div className="mx-auto flex h-full w-full max-w-[540px] flex-col justify-center gap-7 px-5 py-8 @md:px-8">
      <div className="flex flex-col items-center gap-5 @md:flex-row @md:gap-6">
        {/* The vault, with a door that swings open on its hinges */}
        <div className="relative w-[120px] flex-none @md:w-[150px]">
          <div className="relative aspect-[170/108]">
            <div className="absolute inset-0 rounded-[12%/18%] bg-[#343444]" />
            <div className="absolute inset-[5%] overflow-hidden rounded-[9%/14%] bg-well">
              <div className="absolute inset-x-[12%] top-[18%] h-[14%] rounded-sm bg-raised" />
              <div className="absolute inset-x-[12%] top-[42%] h-[14%] rounded-sm bg-raised" />
              <div className="absolute inset-x-[12%] top-[66%] h-[14%] rounded-sm bg-raised" />
              <m.div className="absolute inset-0 bg-black" style={{ opacity: shade }} />
            </div>
            {/* hinges */}
            <div className="absolute top-[16%] -left-[3.5%] h-[20%] w-[7%] rounded-[3px] bg-[#8888a0]" />
            <div className="absolute top-[52%] -left-[3.5%] h-[20%] w-[7%] rounded-[3px] bg-[#8888a0]" />
            <m.div
              className="absolute inset-[5%]"
              style={{ rotateY: door, originX: 0, transformPerspective: 700, transformStyle: "preserve-3d" }}
            >
              <div className="absolute inset-0 rounded-[9%/14%] bg-[#5c5c70] [backface-visibility:hidden]">
                <svg
                  viewBox="-32 -32 64 64"
                  className="absolute top-1/2 left-[62%] h-[62%] -translate-x-1/2 -translate-y-1/2"
                  focusable="false"
                >
                  <circle r="31" fill="#3a3a4e" />
                  <circle r="27" fill="#7070a0" />
                  {DIAL_TICKS.filter((d) => d % 30 === 0).map((deg) => (
                    <rect key={deg} x="-2" y="-26" width="4" height="7" rx="1.5" fill="#c0c0d8" transform={`rotate(${deg})`} />
                  ))}
                  <circle r="18" fill="#d0d0e0" />
                  <circle r="7" fill="#707090" />
                  <circle r="3" fill="#d0d0e0" />
                </svg>
              </div>
              <div className="absolute inset-0 rounded-[9%/14%] bg-[#454558] [backface-visibility:hidden] [transform:rotateY(180deg)]" />
            </m.div>
          </div>
          <div className="mx-[14%] flex justify-between">
            <span className="h-2 w-[22%] rounded-b bg-[#888898]" />
            <span className="h-2 w-[22%] rounded-b bg-[#888898]" />
          </div>
        </div>

        <ul className="w-full min-w-0 space-y-2 @md:flex-1">
          {HOLDINGS.map((h, i) => (
            <HoldingCard key={h.ticker} p={p} from={T.cards[0] + i * span} to={T.cards[0] + (i + 1.4) * span} {...h} />
          ))}
        </ul>
      </div>

      <m.div style={{ opacity: calendar }}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="eyebrow">Income calendar</p>
          <p className="font-mono text-[10.5px] tracking-[0.06em] text-ink-3 uppercase">USD · CAD · GBP</p>
        </div>
        <div className="mt-3 grid grid-cols-12 gap-1">
          {SAMPLE_MONTHS.map((mo, i) => (
            <div key={mo} className="flex flex-col items-center gap-1.5">
              <div className="flex h-[34px] flex-col-reverse items-center gap-[3px]">
                {Array.from({ length: PAYMENTS_PER_MONTH[i] }, (_, j) => (
                  <span key={j} className="size-[6px] rounded-full bg-sprout" style={{ opacity: 1 - j * 0.18 }} />
                ))}
              </div>
              <span className="font-mono text-[9.5px] text-ink-3 @md:text-[10px]">{mo[0]}</span>
            </div>
          ))}
        </div>
      </m.div>
    </div>
  );
}

function HoldingCard({
  p,
  from,
  to,
  ticker,
  name,
  currency,
  date,
  amount,
}: {
  p: MotionValue<number>;
  from: number;
  to: number;
  ticker: string;
  name: string;
  currency: string;
  date: string;
  amount: string;
}) {
  const opacity = useTransform(p, [from, to], [0, 1]);
  const x = useTransform(p, [from, to], [-48, 0], { ease: (t) => 1 - Math.pow(1 - t, 3) });
  return (
    <m.li
      className="flex items-center gap-2.5 rounded-xl border border-line bg-raised px-2.5 py-2 @md:gap-3 @md:px-3"
      style={{ opacity, x }}
    >
      <span className="grid h-7 w-9 flex-none place-items-center rounded-md border border-line bg-surface font-mono text-[10px] font-medium text-ink @md:h-8 @md:w-11 @md:text-[11px]">
        {ticker}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] text-ink @md:text-[13.5px]">{name}</span>
        <span className="block truncate font-mono text-[10px] tracking-[0.04em] text-ink-3 @md:text-[10.5px]">
          {currency} · {date}
        </span>
      </span>
      <span className="num flex-none text-[12.5px] text-sprout-hi @md:text-[13.5px]">{amount}</span>
    </m.li>
  );
}

/* -------------------------------------------------------------- 3 · grow */

const usd = { style: "currency", currency: "USD", maximumFractionDigits: 0 } as const;

function barsGrown(v: number) {
  const [a, b] = T.bars;
  const per = (b - a) / SAMPLE_INCOME.length;
  return Math.max(0, Math.min(SAMPLE_INCOME.length, Math.floor((v - a) / per + 0.6)));
}

function totalFor(n: number) {
  return SAMPLE_INCOME.slice(0, n).reduce((s, x) => s + x, 0);
}

function SceneGrow({ p }: { p: MotionValue<number> }) {
  const [grown, setGrown] = useState(() => barsGrown(p.get()));
  useMotionValueEvent(p, "change", (v) => setGrown(barsGrown(v)));

  const W = 400;
  const H = 170;
  const LEAF = 0.46;
  const gap = 8;
  const bw = (W - gap * 11) / 12;
  const max = Math.max(...SAMPLE_INCOME);
  const barH = (v: number) => (v / max) * (H - 50);
  const last = SAMPLE_INCOME.length - 1;
  const leafX = last * (bw + gap) + bw / 2;
  const leafY = H - barH(SAMPLE_INCOME[last]);

  const leaves = useTransform(p, [...T.leaves], [0, 1]);
  const leafFill = useTransform(p, [T.leaves[0] + 0.03, T.leaves[1]], [0, 1]);

  return (
    <div className="mx-auto flex h-full w-full max-w-[540px] flex-col justify-center px-5 py-8 @md:px-8">
      <p className="eyebrow">Sample portfolio · next 12 months</p>
      <p className="mt-2 flex items-baseline gap-1 font-mono text-[34px] leading-none font-medium tracking-[-0.03em] text-ink @md:text-[42px]">
        <NumberFlow value={totalFor(grown)} locales="en-US" format={usd} className="num" />
        <span className="text-[16px] text-ink-3 @md:text-[18px]">/yr</span>
      </p>

      <svg viewBox={`0 0 ${W} ${H + 16}`} className="mt-5 block h-auto w-full" focusable="false">
        <line x1="0" x2={W} y1={H + 0.5} y2={H + 0.5} stroke="#282834" />
        {SAMPLE_INCOME.map((v, i) => (
          <GrowBar
            key={SAMPLE_MONTHS[i]}
            p={p}
            i={i}
            x={i * (bw + gap)}
            y={H - barH(v)}
            w={bw}
            h={barH(v)}
            highlight={i === last}
          />
        ))}
        {SAMPLE_MONTHS.map((mo, i) => (
          <text
            key={mo}
            x={i * (bw + gap) + bw / 2}
            y={H + 13}
            textAnchor="middle"
            className="font-mono"
            fontSize="9.5"
            fill="#80809a"
          >
            {mo[0]}
          </text>
        ))}
        {/* The logo's three leaves sprout from the last bar */}
        <g transform={`translate(${leafX - 100 * LEAF} ${leafY - 90 * LEAF - 1}) scale(${LEAF})`}>
          <m.g style={{ scale: leaves, originX: 0.5, originY: 1 }}>
            <Leaf d="M87,89 C80,76 68,56 73,34 C82,50 86,70 94,87Z" fill="#4a8c1a" p={leaves} fillOpacity={leafFill} />
            <Leaf d="M113,89 C120,76 132,56 127,34 C118,50 114,70 106,87Z" fill="#4a8c1a" p={leaves} fillOpacity={leafFill} />
            <Leaf d="M100,90 C88,68 84,38 100,5 C116,38 112,68 100,90Z" fill="#2d6010" p={leaves} fillOpacity={leafFill} />
          </m.g>
        </g>
      </svg>

    </div>
  );
}

function GrowBar({
  p,
  i,
  x,
  y,
  w,
  h,
  highlight,
}: {
  p: MotionValue<number>;
  i: number;
  x: number;
  y: number;
  w: number;
  h: number;
  highlight: boolean;
}) {
  const per = (T.bars[1] - T.bars[0]) / SAMPLE_INCOME.length;
  const from = T.bars[0] + i * per;
  const scaleY = useTransform(p, [from, from + per * 2.2], [0, 1], { ease: (t) => 1 - Math.pow(1 - t, 3) });
  return (
    <m.rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={3}
      fill={highlight ? "#9bd96b" : "#7abf50"}
      fillOpacity={highlight ? 1 : 0.72}
      style={{ scaleY, originY: 1 }}
    />
  );
}

function Leaf({
  d,
  fill,
  p,
  fillOpacity,
}: {
  d: string;
  fill: string;
  p: MotionValue<number>;
  fillOpacity: MotionValue<number>;
}) {
  return (
    <m.path
      d={d}
      fill={fill}
      stroke="#7abf50"
      strokeWidth={3}
      strokeLinejoin="round"
      style={{ pathLength: p, fillOpacity }}
    />
  );
}
