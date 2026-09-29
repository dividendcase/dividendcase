import { ArrowRight, CalendarDays, Laptop } from "lucide-react";
import { GitHubIcon } from "./icons";
import { IncomeCard } from "./IncomeCard";
import { VaultDial } from "./VaultDial";
import { GITHUB_URL, buttonOutline, buttonPrimary } from "./site";

const PROOF = [
  { value: "~700", label: "stocks in the screener" },
  { value: "8", label: "stock exchanges" },
  { value: "10 yrs", label: "of payout history" },
  { value: "0", label: "accounts needed" },
];

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div className="container-page grid grid-cols-1 items-center gap-14 pt-12 pb-16 sm:pt-16 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1fr)] lg:gap-10 lg:pt-20 lg:pb-24">
        <div className="relative z-10">
          <p className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pr-3.5 pl-2.5 text-[13px] text-ink-2">
            <Laptop className="size-4 flex-none text-ink-3" aria-hidden />
            <span>
              <span className="font-semibold text-ink">Free and open source</span> · runs on your computer
            </span>
          </p>

          <h1
            id="hero-title"
            className="heading mt-6 text-[42px] leading-[1.02] tracking-[-0.035em] sm:text-[56px] lg:text-[64px]"
          >
            See what your dividends <em className="serif-accent text-[1.1em] leading-none">really</em> pay.
          </h1>

          <p className="mt-5 max-w-[520px] text-[17px] leading-[1.6] text-ink-2 sm:text-[18px]">
            Track dividend income from New York to Mumbai in one place, on your own computer. There&apos;s no
            account to create, and your portfolio never leaves your machine.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#install" className={`${buttonPrimary} px-5 py-3 text-[15px]`}>
              Install for free
              <ArrowRight className="size-4" aria-hidden />
            </a>
            <a href={GITHUB_URL} className={`${buttonOutline} px-5 py-3 text-[15px]`}>
              <GitHubIcon className="size-4" />
              View on GitHub
            </a>
          </div>

          <ul className="mt-10 grid max-w-[560px] grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 sm:gap-x-5">
            {PROOF.map((p) => (
              <li key={p.label} className="text-[13px] leading-snug text-ink-3">
                <span className="num block text-[22px] leading-tight font-medium text-ink">{p.value}</span>
                {p.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-[460px] sm:mb-10 lg:mr-0 lg:mb-6 lg:ml-auto">
          <VaultDial className="pointer-events-none absolute top-1/2 left-1/2 z-0 size-[600px] max-w-none -translate-x-1/2 -translate-y-1/2 animate-dial opacity-60 motion-reduce:animate-none sm:size-[640px] lg:left-[58%]" />
          <div className="relative z-10">
            <IncomeCard />
          </div>
          <div className="relative z-20 mt-3 ml-auto flex w-[272px] max-w-full animate-float items-start gap-3 rounded-xl border border-sprout/30 bg-raised p-3.5 shadow-pop motion-reduce:animate-none sm:absolute sm:-right-6 sm:-bottom-14 sm:mt-0 lg:-right-4 xl:-right-10">
            <span className="grid size-8 flex-none place-items-center rounded-lg bg-sprout/15 text-sprout-hi">
              <CalendarDays className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="font-mono text-[11px] tracking-[0.06em] text-sprout-hi uppercase">Income calendar</p>
              <p className="mt-0.5 text-[13.5px] leading-snug text-ink">
                October: <span className="num">4</span> payments, <span className="num text-sprout-hi">$468</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
