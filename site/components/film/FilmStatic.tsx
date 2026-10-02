"use client";

import { useRef } from "react";
import { Dial } from "./Dial";
import { EXCHANGE_COUNT, GROSS_TOTAL, HOLDINGS, NET_TOTAL, WITHHELD_TOTAL, formatEuro } from "./example";
import { HeroCopy, HoldingCard, IncomeChart, RateChips } from "./parts";
import { PaymentTrails } from "./PaymentTrails";

/**
 * The film for visitors who ask for less motion: the same words and pictures, still and in order.
 * Each scene shows its final frame.
 */
export function FilmStatic() {
  const hero = useRef<HTMLElement>(null);
  const dial = useRef<SVGSVGElement>(null);
  return (
    <>
      <section ref={hero} aria-labelledby="hero-title" className="relative overflow-hidden">
        <PaymentTrails stageRef={hero} dialRef={dial} still />
        <div className="container-page relative grid min-h-dvh grid-cols-1 items-center gap-10 pt-28 pb-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <HeroCopy />
          <Dial ref={dial} glow className="mx-auto w-full max-w-[480px]" />
        </div>
      </section>

      <section id="how-it-works" aria-label="How it works" className="container-page space-y-28 py-24">
        <div>
          <h2 className="heading max-w-[640px] text-[clamp(30px,3.6vw,52px)]">Add what you own, from any market.</h2>
          <p className="mt-3 max-w-[560px] text-[17px] leading-[1.6] text-ink-2 md:text-[19px]">
            You enter your holdings and purchase lots, by hand or from a spreadsheet; nothing connects to your broker or
            bank. No account to create: your portfolio is one file on your computer.
          </p>
          <p className="mt-6 text-[14px] text-ink-3">
            Example portfolio: {HOLDINGS.length} holdings across {EXCHANGE_COUNT} exchanges
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4">
            {HOLDINGS.map((h) => (
              <HoldingCard key={h.ticker} holding={h} />
            ))}
          </div>
        </div>

        <div>
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="heading max-w-[640px] text-[clamp(30px,3.6vw,52px)]">
                See what to expect, month by month, and what&apos;s left after tax.
              </h2>
              <p className="mt-3 max-w-[560px] text-[17px] leading-[1.6] text-ink-2 md:text-[19px]">
                An estimate for the next 12 months, from the shares you entered and each company&apos;s past dividends.
                Then the tax each country usually keeps at source, for where you live, and everything in your currency
                at ECB rates.
              </p>
            </div>
            <div className="md:text-right">
              <p className="text-[14px] text-ink-3">Expected after tax, next 12 months</p>
              <p className="num mt-1 text-[clamp(30px,3.4vw,48px)] font-medium tracking-[-0.035em] text-sprout-hi">
                {formatEuro(NET_TOTAL)}
              </p>
              <p className="text-[14px] text-ink-2">
                About <span className="num">{formatEuro(WITHHELD_TOTAL)}</span> kept at source from{" "}
                <span className="num">{formatEuro(GROSS_TOTAL)}</span>, for a resident of Ireland
              </p>
              <RateChips className="mt-3 md:max-w-[440px] md:justify-end md:ml-auto" />
            </div>
          </div>
          <div className="mt-16">
            <IncomeChart afterTax />
          </div>
        </div>
      </section>
    </>
  );
}
