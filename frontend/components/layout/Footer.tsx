export function Footer() {
  return (
    <footer className="mt-12 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line pt-5 pb-2 text-[12px] text-ink-3">
      <p>
        Market data from Yahoo Finance, fetched by this computer for your own use. Not financial advice.
      </p>
      <div className="flex items-center gap-4">
        <span>Free and open source · AGPL-3.0</span>
        <a
          href="https://github.com/dividendcase/dividendcase"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink-2 transition-colors hover:text-ink"
        >
          Source code
        </a>
      </div>
    </footer>
  );
}
