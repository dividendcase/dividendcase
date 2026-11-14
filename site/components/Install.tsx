"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Check, Copy } from "@phosphor-icons/react";
import { GITHUB_URL, STORE_URL } from "./site";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** The install commands, as in the README */
const UNIX_COMMANDS = ["curl -LsSf https://astral.sh/uv/install.sh | sh", "uv tool install dividendcase", "dividendcase"];

/** For the few who want them: shown under the two main ways, smaller */
const OTHER_WAYS: { key: string; label: string; note: string; prompt: string; commands: string[] }[] = [
  {
    key: "docker",
    label: "Docker",
    note: "For a home server or a NAS.",
    prompt: "$",
    commands: [
      "docker run -d --name dividendcase --restart unless-stopped -p 127.0.0.1:8765:8765 -v dividendcase-data:/data ghcr.io/dividendcase/dividendcase:latest",
    ],
  },
  {
    key: "powershell",
    label: "Windows, from PowerShell",
    note: "Without the Store. Windows blocks this on PCs with Smart App Control turned on.",
    prompt: ">",
    commands: [
      'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"',
      "uv tool install dividendcase",
      "dividendcase",
    ],
  },
];

const APP_URL = "http://127.0.0.1:8765/dashboard/";

const card = "relative flex flex-col overflow-hidden rounded-2xl border border-line-strong bg-well shadow-pop";
const cardHead = "flex h-12 flex-none items-center justify-between gap-3 border-b border-line bg-surface pr-2.5 pl-5";
const cardTitle = "text-[14px] font-semibold text-ink";

/**
 * Frame 10: install. The two ways nearly everyone uses sit side by side: the Microsoft Store on
 * Windows, three commands on a Mac. When the section comes into view the commands type
 * themselves, the app's startup lines follow and the browser opens on the app (a real
 * screenshot, with an example portfolio of invented numbers). Docker, PowerShell and building
 * from source come after, smaller.
 */
export function Install() {
  const section = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(section);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.set(q("[data-output], [data-browser]"), { autoAlpha: 0 });
      // Type each command by uncovering it a character at a time (the text itself is never changed)
      const tl = gsap.timeline({ paused: true });
      q("[data-command]").forEach((el) => {
        const chars = el.textContent?.length ?? 1;
        tl.fromTo(
          el,
          { clipPath: "inset(0 100% 0 0)" },
          { clipPath: "inset(0 0% 0 0)", duration: Math.min(1.1, chars * 0.022), ease: `steps(${chars})` },
        ).to({}, { duration: 0.25 });
      });
      tl.to(q("[data-output]"), { autoAlpha: 1, duration: 0.3, stagger: 0.35 })
        .fromTo(
          q("[data-browser]"),
          { autoAlpha: 0, y: 40, scale: 0.96 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, ease: "power3.out" },
          "+=0.2",
        );
      ScrollTrigger.create({ trigger: section.current, start: "top 55%", once: true, onEnter: () => tl.play() });
      gsap.from(q("[data-reveal]"), {
        autoAlpha: 0,
        y: 24,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.08,
        scrollTrigger: { trigger: section.current, start: "top 70%", once: true },
      });
    },
    { scope: section },
  );

  return (
    <section ref={section} id="install" aria-labelledby="install-title" className="container-page py-28 md:py-40">
      <div className="max-w-[620px]">
        <h2 id="install-title" data-reveal="" className="heading text-[clamp(32px,3.6vw,52px)]">
          Install it in a minute.
        </h2>
        <p data-reveal="" className="mt-4 text-[17px] leading-[1.6] text-pretty text-ink-2 md:text-[19px]">
          Free. One click on Windows, three commands on a Mac. Then it opens in your browser.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-5 lg:mt-14 lg:grid-cols-2 lg:gap-6">
        <div data-reveal="" className={card}>
          <div className={cardHead}>
            <h3 className={cardTitle}>Windows</h3>
            <span className="pr-2.5 text-[12.5px] text-ink-3">Windows 10 and 11</span>
          </div>
          <div className="flex flex-1 flex-col justify-center px-5 py-8 md:px-7 md:py-10">
            <p className="text-[22px] leading-[1.25] font-semibold tracking-[-0.01em] text-ink md:text-[26px]">
              One click, no commands.
            </p>
            <p className="mt-3 max-w-[420px] text-[15px] leading-[1.6] text-ink-2">
              Get DividendCase from the Microsoft Store, then open it from the Start menu.
            </p>
            <div className="mt-6">
              {/* Microsoft's own badge, unchanged, served from this site: its web component would
                  load a script from Microsoft on every visit, which the privacy page rules out */}
              <a
                href={STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-lg transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a static export serves images as files */}
                <img
                  src="/badges/microsoft-store.svg"
                  width={220}
                  height={60}
                  alt="Download DividendCase from the Microsoft Store"
                  className="block h-[60px] w-auto"
                />
              </a>
            </div>
          </div>
          <dl className="space-y-2 border-t border-line px-5 py-4 text-[13.5px] md:px-7">
            <div className="flex flex-wrap gap-x-3">
              <dt className="w-16 text-ink-3">Update</dt>
              <dd className="text-ink-2">The Store does it for you</dd>
            </div>
            <div className="flex flex-wrap gap-x-3">
              <dt className="w-16 text-ink-3">Remove</dt>
              <dd className="text-ink-2">Windows Settings, under Apps</dd>
            </div>
          </dl>
        </div>

        <div data-reveal="" className={card}>
          <div className={cardHead}>
            <h3 className={cardTitle}>macOS and Linux</h3>
            <CopyButton text={UNIX_COMMANDS.join("\n")} />
          </div>
          <div className="flex-1 space-y-1.5 overflow-x-auto px-5 py-5 font-mono text-[13px] leading-[1.75] md:px-7 md:text-[14px]">
            {UNIX_COMMANDS.map((c) => (
              <p key={c} className="whitespace-pre text-ink">
                <span className="text-ink-3 select-none">$ </span>
                <span data-command="" className="inline-block">
                  {c}
                </span>
              </p>
            ))}
            <p data-output="" className="pt-2 whitespace-pre text-ink-3">
              Starting DividendCase at {APP_URL}
            </p>
            <p data-output="" className="whitespace-pre">
              <span className="text-sprout-hi">Ready.</span>
              <span className="text-ink-2"> Opening {APP_URL}</span>
            </p>
            <p className="pt-3 font-sans text-[13.5px] leading-[1.55] whitespace-normal text-ink-3">
              Paste these into Terminal. The first one installs uv, which sets up Python for you.
            </p>
          </div>
          <dl className="space-y-2 border-t border-line px-5 py-4 text-[13.5px] md:px-7">
            <div className="flex flex-wrap gap-x-3">
              <dt className="w-16 text-ink-3">Update</dt>
              <dd className="num text-ink-2">uv tool upgrade dividendcase</dd>
            </div>
            <div className="flex flex-wrap gap-x-3">
              <dt className="w-16 text-ink-3">Remove</dt>
              <dd className="num text-ink-2">uv tool uninstall dividendcase</dd>
            </div>
          </dl>
        </div>
      </div>

      <figure
        data-browser=""
        className="relative mx-auto mt-6 max-w-[1040px] overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-pop lg:mt-8"
      >
        <div className="flex h-10 items-center justify-center border-b border-line bg-raised">
          <span className="rounded-md bg-well px-3 py-1 font-mono text-[12px] text-ink-2">127.0.0.1:8765/dashboard/</span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- a static export serves images as files */}
        <img
          src="/shots/income-home.webp"
          srcSet="/shots/income-home.webp 2x"
          width={1440}
          height={900}
          alt="The DividendCase Income page with an example portfolio: expected dividends for the next 12 months, after tax, by month"
          loading="lazy"
          className="block h-auto w-full"
        />
        <figcaption className="sr-only">Example portfolio with invented numbers</figcaption>
      </figure>

      <div data-reveal="" className="mt-16 border-t border-line pt-10 lg:mt-20">
        <h3 className="text-[15px] font-semibold text-ink">Other ways to install</h3>
        <dl className="mt-6 space-y-6">
          {OTHER_WAYS.map((way) => (
            <div key={way.key} className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:gap-10">
              <dt>
                <span className="block text-[14px] font-medium text-ink">{way.label}</span>
                <span className="mt-1 block text-[13.5px] leading-[1.5] text-ink-3">{way.note}</span>
              </dt>
              <dd className="flex min-w-0 items-start gap-2 rounded-xl border border-line bg-well py-2 pr-2 pl-4">
                <div className="min-w-0 flex-1 space-y-1 overflow-x-auto py-1 font-mono text-[12.5px] leading-[1.7] md:text-[13px]">
                  {way.commands.map((c) => (
                    <p key={c} className="whitespace-pre text-ink-2">
                      <span className="text-ink-3 select-none">{way.prompt} </span>
                      {c}
                    </p>
                  ))}
                </div>
                <CopyButton text={way.commands.join("\n")} />
              </dd>
            </div>
          ))}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)] lg:gap-10">
            <dt>
              <span className="block text-[14px] font-medium text-ink">From source</span>
              <span className="mt-1 block text-[13.5px] leading-[1.5] text-ink-3">To read the code or change it.</span>
            </dt>
            <dd className="text-[14px] leading-[1.6] text-ink-2">
              <a href={`${GITHUB_URL}#readme`} className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-sprout">
                Build and run it from the code on GitHub
              </a>
              .
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older browsers or insecure contexts: fall back to a hidden textarea
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy the commands"}
        className={`inline-flex h-8 flex-none items-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-[12.5px] font-medium transition-colors active:translate-y-px ${
          copied ? "text-sprout-hi" : "text-ink-2 hover:bg-raised hover:text-ink"
        }`}
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </button>
      <span className="sr-only" role="status">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </>
  );
}
