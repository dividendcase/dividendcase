"use client";

import { m } from "motion/react";
import { ArrowUpRight } from "@phosphor-icons/react";
import { GitHubIcon } from "./icons";
import { DATA_FOLDERS, GITHUB_URL } from "./site";

const code = "font-mono text-[0.92em] text-ink";

/** Short, plain answers; each one true of the app as it ships */
const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Is it really free?",
    a: <>Yes. It&apos;s open source under the AGPL, with no account and no subscription, and the app stays free.</>,
  },
  {
    q: "Where is my data stored?",
    a: (
      <>
        In one SQLite file in your data folder: <span className={code}>{DATA_FOLDERS.macos}</span> on a Mac,{" "}
        <span className={code}>{DATA_FOLDERS.windows}</span> on Windows, <span className={code}>{DATA_FOLDERS.linux}</span> on
        Linux. Copy the folder to back it up.
      </>
    ),
  },
  {
    q: "Where does the market data come from?",
    a: (
      <>
        Yahoo Finance, fetched by your own computer for your personal use. DividendCase never ships market data and
        isn&apos;t affiliated with Yahoo. Exchange rates are the European Central Bank&apos;s.
      </>
    ),
  },
  {
    q: "Which markets does it cover?",
    a: <>Stocks on NYSE, Nasdaq, LSE, Euronext Dublin, NSE, BSE, TSX and ASX, and ETFs such as SPY or VTI.</>,
  },
  {
    q: "Does it work offline?",
    a: <>Everything you&apos;ve added and fetched is on your computer. New prices and dividends need the internet.</>,
  },
  {
    q: "Is this financial advice?",
    a: <>No. It shows what your holdings have paid and are expected to pay. The decisions are yours.</>,
  },
  {
    q: "I had an account on dividendcase.com.",
    a: (
      <>
        Hosted accounts closed on 1 November 2026. If you exported your data, choose Import in the app and pick that
        file: your portfolios and watchlists come back as they were.
      </>
    ),
  },
];

/** Frame 11: the code is public, and the questions people ask, with every answer in view. */
export function OpenSource() {
  return (
    <section id="faq" aria-labelledby="open-title" className="container-page border-t border-line py-28 md:py-36">
      <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
        <div>
          <h2 id="open-title" className="heading text-[clamp(32px,3.4vw,48px)]">
            The code is public, and it stays that way.
          </h2>
          <p className="mt-4 max-w-[440px] text-[17px] leading-[1.6] text-pretty text-ink-2 md:text-[19px]">
            Licensed under the AGPL. Read every line, run it on your own machine, change it for yourself.
          </p>
          <ul className="mt-10 space-y-4 text-[15px]">
            <li>
              <a href={GITHUB_URL} className="inline-flex items-center gap-2.5 font-medium text-ink transition-colors hover:text-sprout-hi">
                <GitHubIcon className="size-[18px]" />
                View on GitHub
              </a>
            </li>
            <li>
              <a href={`${GITHUB_URL}/releases`} className="inline-flex items-center gap-1.5 text-ink-2 transition-colors hover:text-ink">
                Release notes
                <ArrowUpRight className="size-3.5" aria-hidden />
              </a>
            </li>
            <li>
              <a href={`${GITHUB_URL}/issues/new/choose`} className="inline-flex items-center gap-1.5 text-ink-2 transition-colors hover:text-ink">
                Report a problem or suggest an idea
                <ArrowUpRight className="size-3.5" aria-hidden />
              </a>
            </li>
          </ul>
        </div>

        <dl className="space-y-9">
          {FAQS.map((f, i) => (
            <m.div
              key={f.q}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.6, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)] md:gap-10"
            >
              <dt className="text-[16px] leading-[1.45] font-medium text-ink md:text-[17px]">{f.q}</dt>
              <dd className="text-[15px] leading-[1.65] text-ink-2 md:text-[16px]">{f.a}</dd>
            </m.div>
          ))}
        </dl>
      </div>
    </section>
  );
}
