import type { Metadata } from "next";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { Nav } from "@/components/Nav";
import { buttonPrimary } from "@/components/site";

export const metadata: Metadata = {
  title: "Page not found | DividendCase",
  robots: { index: false },
};

/** Any address the site doesn't have, including old ones of the hosted app that vercel.json doesn't redirect */
export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="container-page flex min-h-dvh flex-col justify-center pt-24 pb-20">
        <p className="num text-[14px] text-ink-3">404</p>
        <h1 className="heading mt-4 max-w-[720px] text-[clamp(36px,4.6vw,60px)]">There&apos;s nothing at this address.</h1>
        <p className="mt-5 max-w-[560px] text-[17px] leading-[1.6] text-pretty text-ink-2 md:text-[19px]">
          If you followed a link to the old hosted app, it closed on 1&nbsp;November 2026. DividendCase is now a free app
          that runs on your own computer.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
          <a href="/" className={`${buttonPrimary} px-5 py-3 text-[15px]`}>
            Go to the home page
            <ArrowRight weight="bold" className="size-4" aria-hidden />
          </a>
          <a href="/#hosted-account" className="border-b border-line-strong pb-0.5 text-[15px] font-medium text-ink hover:border-ink-3">
            I had an account
          </a>
        </div>
      </main>
    </>
  );
}
