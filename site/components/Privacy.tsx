import { ArrowsClockwise, ArrowsLeftRight, CloudSlash, Database, Globe, Laptop, Lock, Prohibit } from "@phosphor-icons/react/ssr";
import { LogoMark } from "@dividendcase/brand/logo";
import { LOCAL_URL } from "./site";

const POINTS = [
  {
    icon: Lock,
    title: "Only this computer can reach it",
    body: (
      <>
        DividendCase runs a small web server on <span className="num text-ink">127.0.0.1</span> and opens in your
        browser at <span className="num text-ink">{LOCAL_URL.replace("http://", "")}</span>. There&apos;s no
        account, and nothing is sent to DividendCase.
      </>
    ),
  },
  {
    icon: Globe,
    title: "Market data comes straight from Yahoo Finance",
    body: (
      <>
        Your computer fetches prices and dividends through the open-source yfinance library, for your personal
        use. DividendCase never distributes market data.
      </>
    ),
  },
  {
    icon: Database,
    title: "One file you control",
    body: <>Everything is stored in a single SQLite file in your data folder. Back it up, move it or delete it.</>,
  },
];

export function Privacy() {
  return (
    <section id="privacy" aria-labelledby="privacy-title" className="border-y border-line bg-well py-24 sm:py-28">
      <div className="container-page">
        <div className="max-w-[640px]">
          <p className="eyebrow">Privacy</p>
          <h2 id="privacy-title" className="heading mt-4 text-[34px] sm:text-[44px]">
            Your data stays <span className="text-sprout">yours</span>.
          </h2>
          <p className="mt-4 text-[17px] leading-[1.6] text-ink-2">
            DividendCase is an app on your computer, not a website you sign in to.
          </p>
        </div>

        <div className="mt-12">
          <DataFlow />
        </div>

        <ul className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
          {POINTS.map((pt) => (
            <li key={pt.title}>
              <span className="grid size-10 place-items-center rounded-xl border border-line bg-surface text-ink">
                <pt.icon className="size-[18px]" aria-hidden />
              </span>
              <h3 className="mt-4 text-[17px] font-semibold tracking-[-0.015em] text-ink">{pt.title}</h3>
              <p className="mt-1.5 text-[15px] leading-[1.6] text-ink-2">{pt.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function DataFlow() {
  return (
    <figure className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-6">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.15fr)_auto_minmax(0,1fr)] md:grid-rows-2 md:gap-x-3 md:gap-y-4">
        {/* Your computer */}
        <div className="rounded-xl border border-line-strong bg-raised p-4 md:row-span-2 md:flex md:flex-col md:justify-center">
          <p className="eyebrow flex items-center gap-2">
            <Laptop className="size-3.5" aria-hidden /> Your computer
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3">
              <LogoMark className="size-8 flex-none" />
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-ink">DividendCase app</p>
                <p className="num truncate text-[12px] text-ink-3">127.0.0.1:8765</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3">
              <span className="grid size-8 flex-none place-items-center rounded-md bg-raised text-ink-2">
                <Database className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="num truncate text-[13.5px] text-ink">dividendcase.db</p>
                <p className="text-[12px] text-ink-3">one SQLite file</p>
              </div>
            </div>
          </div>
        </div>

        {/* Connection that happens */}
        <div className="flex items-center justify-center gap-2 py-1 text-ink-2 md:flex-col md:gap-1.5 md:px-1">
          <ArrowsLeftRight className="size-5 rotate-90 md:rotate-0" aria-hidden />
          <span className="font-mono text-[10.5px] tracking-[0.06em] text-ink-3 uppercase md:max-w-[84px] md:text-center">
            Market data
          </span>
        </div>
        <div className="rounded-xl border border-line bg-raised p-4 md:self-stretch">
          <p className="eyebrow flex items-center gap-2">
            <Globe className="size-3.5" aria-hidden /> Internet
          </p>
          <p className="mt-2.5 text-[15px] font-medium text-ink">Yahoo Finance</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">prices and dividends, via yfinance</p>
        </div>

        {/* Connection that never happens */}
        <div className="flex items-center justify-center gap-2 py-1 text-ink-3 md:flex-col md:gap-1.5 md:px-1">
          <Prohibit className="size-5" aria-hidden />
          <span className="font-mono text-[10.5px] tracking-[0.06em] uppercase md:max-w-[84px] md:text-center">
            Nothing sent
          </span>
        </div>
        <div className="rounded-xl border border-dashed border-line-strong p-4 text-ink-3 md:self-stretch">
          <p className="eyebrow flex items-center gap-2">
            <CloudSlash className="size-3.5" aria-hidden /> Not involved
          </p>
          <p className="mt-2.5 text-[15px] font-medium line-through decoration-ink-3/80">DividendCase servers</p>
          <p className="mt-0.5 text-[12.5px] leading-snug">no account, no sync, no tracking</p>
        </div>
      </div>

      <figcaption className="mt-5 flex gap-3 border-t border-line pt-5 text-[13.5px] leading-[1.6] text-ink-2">
        <ArrowsClockwise className="mt-1 size-4 flex-none text-ink-3" aria-hidden />
        <span>
          While the app is open it keeps data current in the background: holdings and watchlist stocks when it
          starts and daily, screener stocks weekly. It fetches about one stock a second and pauses whenever Yahoo
          asks.
        </span>
      </figcaption>
    </figure>
  );
}
