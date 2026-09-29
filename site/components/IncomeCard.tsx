"use client";

import { useEffect, useState } from "react";
import NumberFlow from "@number-flow/react";
import { m } from "motion/react";
import { SAMPLE_INCOME, SAMPLE_MONTHS, SAMPLE_TOTAL } from "./site";

const usd = { style: "currency", currency: "USD", maximumFractionDigits: 0 } as const;

const COMING_UP = [
  { ticker: "KO", name: "Coca-Cola", date: "Oct 1", amount: "$46.20" },
  { ticker: "O", name: "Realty Income", date: "Oct 15", amount: "$18.75" },
  { ticker: "PG", name: "Procter & Gamble", date: "Nov 17", amount: "$51.18" },
];

/** The product card in the hero: a sample portfolio's next 12 months of income. */
export function IncomeCard() {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setTotal(SAMPLE_TOTAL), 350);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="relative rounded-2xl border border-line bg-surface/90 p-5 shadow-pop backdrop-blur-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow">Next 12 months</p>
        <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[10.5px] tracking-[0.06em] text-ink-3 uppercase">
          Sample portfolio
        </span>
      </div>

      <p className="mt-2 flex items-baseline gap-1 font-mono text-[40px] leading-[1.05] font-medium tracking-[-0.03em] text-ink sm:text-[46px]">
        <NumberFlow
          value={total}
          locales="en-US"
          format={usd}
          className="num"
          spinTiming={{ duration: 1400, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}
          aria-hidden="true"
        />
        <span className="sr-only">$4,812</span>
        <span className="text-[18px] text-ink-3 sm:text-[20px]">/yr</span>
      </p>
      <p className="mt-1 text-[13px] text-ink-2">
        ≈ <span className="num text-ink">$401</span> a month, projected from each holding&apos;s payment history
      </p>

      <MonthlyBars />

      <div className="mt-5 border-t border-line pt-4">
        <p className="eyebrow">Coming up</p>
        <ul className="mt-2.5 space-y-2.5">
          {COMING_UP.map((p) => (
            <li key={p.ticker} className="flex items-center gap-3 text-[13.5px]">
              <span className="grid h-8 w-10 flex-none place-items-center rounded-md border border-line bg-raised font-mono text-[11px] font-medium text-ink">
                {p.ticker}
              </span>
              <span className="min-w-0 flex-1 truncate text-ink">{p.name}</span>
              <span className="num text-[12.5px] text-ink-3">{p.date}</span>
              <span className="num w-[62px] text-right text-sprout-hi">{p.amount}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MonthlyBars() {
  const max = Math.max(...SAMPLE_INCOME);
  const w = 360;
  const h = 96;
  const gap = 8;
  const bw = (w - gap * 11) / 12;

  return (
    <div className="mt-5">
      <svg viewBox={`0 0 ${w} ${h + 18}`} className="block h-auto w-full" aria-hidden="true" focusable="false">
        {[0.33, 0.66].map((f) => (
          <line key={f} x1="0" x2={w} y1={h - h * f} y2={h - h * f} stroke="#22222c" strokeWidth="1" />
        ))}
        <line x1="0" x2={w} y1={h + 0.5} y2={h + 0.5} stroke="#282834" strokeWidth="1" />
        {SAMPLE_INCOME.map((v, i) => {
          const bh = (v / max) * (h - 6);
          return (
            <m.rect
              key={SAMPLE_MONTHS[i]}
              x={i * (bw + gap)}
              y={h - bh}
              width={bw}
              height={bh}
              rx={3}
              fill={i === 0 ? "#9bd96b" : "#7abf50"}
              fillOpacity={i === 0 ? 1 : 0.72}
              style={{ originY: 1 }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.7, delay: 0.25 + i * 0.045, ease: [0.22, 1, 0.36, 1] }}
            />
          );
        })}
        {SAMPLE_MONTHS.map((mo, i) => (
          <text
            key={mo}
            x={i * (bw + gap) + bw / 2}
            y={h + 14}
            textAnchor="middle"
            className="font-mono"
            fontSize="9.5"
            fill={i === 0 ? "#ececf3" : "#80809a"}
          >
            {mo[0]}
          </text>
        ))}
      </svg>
    </div>
  );
}
