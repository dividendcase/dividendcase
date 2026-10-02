import { ArrowUpRight, GitPullRequest, Scales } from "@phosphor-icons/react/ssr";
import { GitHubIcon } from "./icons";
import { GITHUB_URL, buttonOutline } from "./site";

export function OpenSource() {
  return (
    <section id="open-source" aria-labelledby="oss-title" className="border-t border-line py-24 sm:py-28">
      <div className="container-page grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-10">
          <p className="eyebrow">Open source</p>
          <h2 id="oss-title" className="heading mt-4 text-[32px] sm:text-[40px]">
            Built in the <span className="text-sprout">open</span>.
          </h2>
          <p className="mt-4 max-w-[560px] text-[17px] leading-[1.6] text-ink-2">
            Every line of DividendCase is on GitHub under the AGPL-3.0-or-later licence. Read the code, run it,
            change it. Bug reports, ideas and pull requests are welcome.
          </p>
          <ul className="mt-7 flex flex-wrap gap-x-7 gap-y-3 text-[14px] text-ink-2">
            <li className="flex items-center gap-2">
              <Scales className="size-4 text-ink-3" aria-hidden />
              AGPL-3.0-or-later
            </li>
            <li className="flex items-center gap-2">
              <GitPullRequest className="size-4 text-ink-3" aria-hidden />
              Contributions welcome
            </li>
          </ul>
          <a href={GITHUB_URL} className={`${buttonOutline} mt-8 px-5 py-3 text-[15px]`}>
            <GitHubIcon className="size-4" />
            Read the code on GitHub
            <ArrowUpRight className="size-4 text-ink-3" aria-hidden />
          </a>
        </div>

        {/* Keeper is the only place lavender appears */}
        <aside
          aria-labelledby="later-title"
          className="rounded-2xl border border-dial/30 bg-surface p-6 shadow-card sm:p-7"
        >
          <p className="flex items-center gap-2.5 font-mono text-[11px] font-medium tracking-[0.08em] text-dial-hi uppercase">
            <span className="keeper-dot" aria-hidden="true" />
            Later
          </p>
          <h3 id="later-title" className="mt-4 text-[20px] font-semibold tracking-[-0.02em] text-ink">
            DividendCase Cloud
          </h3>
          <p className="mt-2 text-[15px] leading-[1.6] text-ink-2">
            Sync across your devices, a mobile app, and Keeper, an AI assistant that watches your income.
          </p>
          <p className="mt-5 border-t border-line pt-4 text-[14px] font-medium text-ink">The local app stays free.</p>
        </aside>
      </div>
    </section>
  );
}
