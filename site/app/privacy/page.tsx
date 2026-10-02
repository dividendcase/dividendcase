import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { GITHUB_URL } from "@/components/site";

/** The day the hosted app closed and this site took over dividendcase.com */
const EFFECTIVE = "1\u00a0November 2026"; // no line break inside the date
const CONTACT = "feedback@dividendcase.com";

const description =
  "DividendCase collects nothing: this website has no cookies or analytics, and the app runs on your own " +
  "computer and sends nothing to us.";

export const metadata: Metadata = {
  title: "Privacy | DividendCase",
  description,
  alternates: { canonical: "/privacy/" },
  openGraph: { type: "website", siteName: "DividendCase", url: "/privacy/", title: "Privacy | DividendCase", description },
};

const SUMMARY = [
  { title: "This website", text: "No cookies, no analytics, no forms. Vercel hosts it and keeps the usual server logs." },
  { title: "The app", text: "Runs on your computer. What you enter stays there, and nothing is sent to us." },
  { title: "The old hosted app", text: `Closed on ${EFFECTIVE}. Every account and its data were deleted that day.` },
];

const SECTIONS = [
  { id: "website", title: "This website" },
  { id: "app", title: "The app" },
  { id: "hosted-app", title: "The old hosted app" },
  { id: "changes", title: "Changes to this page" },
  { id: "contact", title: "Contact" },
];

/** What the app downloads, and from where (as in SECURITY.md) */
const SERVICES = [
  { name: "Yahoo Finance", what: "Prices, dividends and company details for your stocks and the screener's." },
  { name: "European Central Bank", what: "Exchange rates." },
  { name: "Wikipedia", what: "The list of S&P 500 companies, for the screener." },
  { name: "PyPI", what: "A check for a new version, once a day. Turn it off in Settings, under Check for updates." },
];

const link = "text-ink underline decoration-line-strong underline-offset-[5px] transition-colors hover:decoration-sprout";
const prose = "space-y-5 text-[16px] leading-[1.7] text-pretty text-ink-2 md:text-[17px]";

export default function PrivacyPage() {
  return (
    <div id="top">
      <a
        href="#main"
        className="sr-only z-[60] rounded-lg bg-sprout px-4 py-2 font-semibold text-sprout-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Nav />
      <main id="main" className="container-page pt-32 pb-28 md:pt-40 md:pb-36">
        <header className="max-w-[760px]">
          <h1 className="heading text-[clamp(40px,5.2vw,68px)]">Privacy</h1>
          <p className="mt-5 text-[18px] leading-[1.6] text-pretty text-ink-2 md:text-[20px]">
            DividendCase doesn&apos;t collect your data. Here is what that means for this website, for the app you
            install, and for the accounts on the old hosted app.
          </p>
          <p className="mt-4 text-[14px] text-ink-3">Effective {EFFECTIVE}</p>
        </header>

        <dl className="mt-12 max-w-[760px] divide-y divide-line rounded-2xl border border-line bg-surface">
          {SUMMARY.map((s) => (
            <div key={s.title} className="grid gap-1 px-5 py-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-6 md:px-6">
              <dt className="text-[15px] font-medium text-ink">{s.title}</dt>
              <dd className="text-[15px] leading-[1.6] text-pretty text-ink-2">{s.text}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-20 grid grid-cols-1 gap-12 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-20">
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-28">
              <p className="text-[13px] text-ink-3">On this page</p>
              <ul className="mt-3 space-y-2.5 text-[14px]">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-ink-2 transition-colors hover:text-ink">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="max-w-[680px] space-y-16">
            <Section id="website">
              <p>
                dividendcase.com is a set of static pages. It sets no cookies, runs no analytics or tracking scripts,
                and has no forms or sign-in. Its fonts, images and scripts are served from the site itself, so reading
                it sends nothing to Google or any other third party.
              </p>
              <p>
                The site is hosted by Vercel. Like any web host, Vercel receives your IP address, your browser&apos;s
                details and the pages you ask for, so it can deliver them and protect the site from abuse, and keeps
                those logs for a short time. We don&apos;t use them to identify or follow visitors. See{" "}
                <a href="https://vercel.com/legal/privacy-policy" className={link}>
                  Vercel&apos;s privacy policy
                </a>
                .
              </p>
              <p>Links to GitHub, PyPI and the Docker image take you to those sites, under their own privacy policies.</p>
            </Section>

            <Section id="app">
              <p>
                DividendCase runs on your own computer. The holdings, watchlists and settings you enter are kept in one
                file in your data folder and never leave it. There&apos;s no account, no telemetry and no crash
                reporting, and nothing is sent to us. The app never connects to your broker or bank, and files you
                import are read on your computer.
              </p>
              <p>To fetch market data, the app connects to these services directly from your computer:</p>
              <dl className="divide-y divide-line border-y border-line">
                {SERVICES.map((s) => (
                  <div key={s.name} className="grid gap-1 py-3.5 sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-6">
                    <dt className="font-medium text-ink">{s.name}</dt>
                    <dd>{s.what}</dd>
                  </div>
                ))}
              </dl>
              <p>
                Each of them sees your IP address, as any website you visit does, and Yahoo sees which ticker symbols
                are looked up. The requests never include how many shares you own, what you paid, or anything else
                you&apos;ve entered.
              </p>
              <p>
                Installing or updating the app downloads it from PyPI or, for Docker, from GitHub&apos;s container
                registry. The app&apos;s &ldquo;Report a problem&rdquo; command opens a GitHub form in your browser,
                with the app&apos;s version and your operating system filled in. Nothing is sent unless you submit it,
                and issues on GitHub are public.
              </p>
            </Section>

            <Section id="hosted-app">
              <p>
                Until {EFFECTIVE}, dividendcase.com was a hosted app where you could create an account. It closed that
                day, and every account was deleted with its email address, portfolios, watchlists and settings. A
                backup made before the closure is deleted by 1&nbsp;December 2026.
              </p>
              <p>
                If you exported your data before the closure, that file imports into the app:{" "}
                <a href="/#install" className={link}>
                  install it
                </a>
                , choose Import and pick the file.
              </p>
            </Section>

            <Section id="changes">
              <p>
                When this page changes, the date at the top changes too. The website&apos;s source is public, so{" "}
                <a href={`${GITHUB_URL}/commits/main/site/app/privacy/page.tsx`} className={link}>
                  every earlier version of this page
                </a>{" "}
                can be read on GitHub.
              </p>
            </Section>

            <Section id="contact">
              <p>
                For questions about privacy, or about data from the old hosted app, email{" "}
                <a href={`mailto:${CONTACT}`} className={link}>
                  {CONTACT}
                </a>
                .
              </p>
              <p>
                Found a security problem? Please{" "}
                <a href={`${GITHUB_URL}/blob/main/SECURITY.md`} className={link}>
                  report it privately
                </a>{" "}
                on GitHub. For anything else, from bugs to ideas,{" "}
                <a href={`${GITHUB_URL}/issues/new/choose`} className={link}>
                  open an issue
                </a>
                .
              </p>
            </Section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  const title = SECTIONS.find((s) => s.id === id)!.title;
  return (
    <section id={id} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="heading mb-5 text-[26px] md:text-[30px]">
        {title}
      </h2>
      <div className={prose}>{children}</div>
    </section>
  );
}
