import { MARKETS } from "./site";

export function Markets() {
  return (
    <section aria-label="Markets covered" className="container-page">
      <div className="flex flex-col items-center gap-4 border-t border-line pt-7 pb-4 sm:flex-row sm:justify-center sm:gap-8">
        <p className="eyebrow flex-none">Stocks and ETFs from</p>
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 font-mono text-[13px] font-medium tracking-[0.06em] text-ink-2 uppercase sm:gap-x-8">
          {MARKETS.map((mk) => (
            <li key={mk} className="whitespace-nowrap">
              {mk}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
