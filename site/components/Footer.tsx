import { Logo } from "@dividendcase/brand/logo";
import { GITHUB_URL, NAV_LINKS } from "./site";

export function Footer() {
  return (
    <footer className="border-t border-line bg-well">
      <div className="container-page py-12 sm:py-14">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-[340px]">
            <a href="#top" className="inline-block rounded-md text-[17px] text-ink" aria-label="DividendCase, back to top">
              <Logo />
            </a>
            <p className="mt-4 text-[14px] leading-[1.6] text-ink-2">
              A free, open-source dividend tracker that runs on your own computer.
            </p>
          </div>

          <nav aria-label="Footer">
            <ul className="grid grid-cols-2 gap-x-10 gap-y-2.5 text-[14px] text-ink-2 sm:grid-cols-3">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="rounded-sm transition-colors hover:text-ink">
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <a href={GITHUB_URL} className="rounded-sm transition-colors hover:text-ink">
                  GitHub
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 space-y-1.5 border-t border-line pt-6 text-[12.5px] leading-[1.6] text-ink-3">
          <p>Not financial advice. Not affiliated with Yahoo.</p>
          <p>
            © 2026 DividendCase · AGPL-3.0-or-later · The DividendCase name and logo are not covered by the licence.
          </p>
        </div>
      </div>
    </footer>
  );
}
