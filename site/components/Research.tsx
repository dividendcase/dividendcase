"use client";

import { m } from "motion/react";
import { ArrowRight } from "@phosphor-icons/react";

type Tile = {
  title: string;
  body: string;
  shot: string;
  alt: string;
  /** Grid placement on wide screens */
  area: string;
  /** How wide the screenshot is drawn, as a share of the tile, so its text stays readable */
  zoom: number;
  /** Where the screenshot is pinned when it's wider than the tile */
  focus: string;
};

/** Real screenshots of the app, taken with an example portfolio of invented numbers */
const TILES: Tile[] = [
  {
    title: "Screen about 700 payers",
    body: "Filter by yield, how often they pay, and whether they beat their own market's index.",
    shot: "/shots/screener.webp",
    alt: "The screener: dividend payers with their market, payment frequency, consistency, result against their index and yield",
    area: "lg:col-span-2 lg:row-span-2",
    zoom: 165,
    focus: "top-0 left-0",
  },
  {
    title: "See what reinvesting does",
    body: "Years of dividends, reinvested or taken as cash.",
    shot: "/shots/drip.webp",
    alt: "The DRIP calculator: portfolio value over the years with dividends reinvested and without",
    area: "sm:col-span-2 lg:col-span-2",
    zoom: 112,
    focus: "top-0 left-0",
  },
  {
    title: "Side by side",
    body: "Up to four stocks, measure by measure.",
    shot: "/shots/compare.webp",
    alt: "Two stocks compared measure by measure: yield, safety, consistency and growth",
    area: "",
    zoom: 150,
    focus: "top-0 left-0",
  },
  {
    title: "Ten years of payouts",
    body: "Every dividend a stock has paid, and how fast it grew.",
    shot: "/shots/history.webp",
    alt: "A stock's dividend per share each year for ten years",
    area: "",
    zoom: 150,
    focus: "top-0 left-0",
  },
];

/**
 * Frame 9: the research tools, as a grid of five tiles with real screenshots. Each tile lifts a
 * little under the pointer and its picture eases forward.
 */
export function Research() {
  return (
    <section id="features" aria-labelledby="features-title" className="container-page py-28 md:py-36">
      <h2 id="features-title" className="heading text-[clamp(32px,3.6vw,52px)]">
        Research before you buy.
      </h2>
      <p className="mt-4 max-w-[560px] text-[17px] leading-[1.6] text-pretty text-ink-2 md:text-[19px]">
        Everything below is the app itself, with an example portfolio.
      </p>

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:grid-rows-[300px_260px_auto] lg:gap-5">
        {TILES.map((t, i) => (
          <m.article
            key={t.title}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            whileHover="hover"
            className={`group relative flex min-h-[300px] flex-col overflow-hidden rounded-[20px] border border-line bg-surface ${t.area} ${
              i === 0 ? "sm:col-span-2 lg:col-span-2" : ""
            }`}
          >
            <div className="relative z-10 p-6 pb-0 md:p-7 md:pb-0">
              <h3 className="text-[19px] font-semibold tracking-[-0.02em] text-ink md:text-[21px]">{t.title}</h3>
              <p className="mt-1.5 max-w-[440px] text-[14.5px] leading-[1.55] text-ink-2">{t.body}</p>
            </div>
            <m.div
              variants={{ hover: { y: -6, scale: 1.02 } }}
              transition={{ type: "spring", stiffness: 160, damping: 22 }}
              className="relative mt-5 ml-6 flex-1 overflow-hidden rounded-tl-xl border-t border-l border-line-strong md:ml-7"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- a static export serves images as files */}
              <img
                src={t.shot}
                alt={t.alt}
                loading="lazy"
                style={{ width: `${t.zoom}%` }}
                className={`absolute h-auto max-w-none ${t.focus}`}
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,var(--color-surface)_100%)]" />
            </m.div>
          </m.article>
        ))}

        <m.article
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-6 rounded-[20px] border border-line bg-[linear-gradient(90deg,var(--color-surface)_40%,rgb(45_96_16/0.22)_100%)] p-6 sm:col-span-2 md:p-7 lg:col-span-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div>
            <h3 className="text-[19px] font-semibold tracking-[-0.02em] text-ink md:text-[21px]">
              Bring a spreadsheet in, take everything out.
            </h3>
            <p className="mt-1.5 text-[14.5px] leading-[1.55] text-ink-2">
              Excel import and export, so your data is never stuck here.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[12.5px]">
            <span className="rounded-lg border border-line-strong bg-well px-3 py-2 text-ink-2">my-portfolio.xlsx</span>
            <ArrowRight className="size-4 text-sprout" aria-hidden />
            <span className="rounded-lg border border-sprout/45 bg-sprout/10 px-3 py-2 text-sprout-hi">DividendCase</span>
            <ArrowRight className="size-4 text-sprout" aria-hidden />
            <span className="rounded-lg border border-line-strong bg-well px-3 py-2 text-ink-2">dividendcase_export.xlsx</span>
          </div>
        </m.article>
      </div>
    </section>
  );
}
