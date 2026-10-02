"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Check, Copy } from "@phosphor-icons/react";
import { GITHUB_URL } from "./site";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type Tab = { key: string; label: string; prompt: string; commands: string[] };

/** The install commands, as in the README */
const TABS: Tab[] = [
  {
    key: "unix",
    label: "macOS and Linux",
    prompt: "$",
    commands: ["curl -LsSf https://astral.sh/uv/install.sh | sh", "uv tool install dividendcase", "dividendcase"],
  },
  {
    key: "windows",
    label: "Windows",
    prompt: ">",
    commands: [
      'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"',
      "uv tool install dividendcase",
      "dividendcase",
    ],
  },
  {
    key: "docker",
    label: "Docker",
    prompt: "$",
    commands: [
      "docker run -d --name dividendcase --restart unless-stopped -p 127.0.0.1:8765:8765 -v dividendcase-data:/data ghcr.io/dividendcase/dividendcase:latest",
    ],
  },
];

const APP_URL = "http://127.0.0.1:8765/dashboard/";

/**
 * Frame 10: install. When the section comes into view the commands type themselves, the app's
 * startup lines follow and the browser opens on the app (a real screenshot, with an example
 * portfolio of invented numbers).
 */
export function Install() {
  const section = useRef<HTMLElement>(null);
  const [tab, setTab] = useState(TABS[0].key);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const current = TABS.find((t) => t.key === tab)!;

  // Start on the visitor's own system
  useEffect(() => {
    if (/Windows/i.test(navigator.userAgent)) setTab("windows");
  }, []);

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

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    const i = TABS.findIndex((t) => t.key === tab);
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    setTab(TABS[next].key);
    tabRefs.current[TABS[next].key]?.focus();
  }

  return (
    <section ref={section} id="install" aria-labelledby="install-title" className="container-page py-28 md:py-40">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
        <div className="lg:pt-10">
          <h2 id="install-title" data-reveal="" className="heading text-[clamp(32px,3.6vw,52px)]">
            Install it in a minute.
          </h2>
          <p data-reveal="" className="mt-4 max-w-[440px] text-[17px] leading-[1.6] text-pretty text-ink-2 md:text-[19px]">
            Free. It installs with uv, which sets up Python for you, then opens in your browser.
          </p>
          <dl data-reveal="" className="mt-10 space-y-3 text-[14px]">
            <div className="flex flex-wrap gap-x-3">
              <dt className="w-16 text-ink-3">Update</dt>
              <dd className="num text-ink-2">uv tool upgrade dividendcase</dd>
            </div>
            <div className="flex flex-wrap gap-x-3">
              <dt className="w-16 text-ink-3">Remove</dt>
              <dd className="num text-ink-2">uv tool uninstall dividendcase</dd>
            </div>
          </dl>
          <p data-reveal="" className="mt-8 text-[14px] text-ink-3">
            Prefer to build it yourself?{" "}
            <a href={`${GITHUB_URL}#readme`} className="text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
              Run it from source
            </a>
            .
          </p>
        </div>

        <div className="relative">
          <div className="relative z-10 overflow-hidden rounded-2xl border border-line-strong bg-well shadow-pop">
            <div className="flex items-center justify-between gap-3 border-b border-line bg-surface px-2.5 py-2">
              <div role="tablist" aria-label="Your system" className="flex gap-1 overflow-x-auto">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    ref={(el) => {
                      tabRefs.current[t.key] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`install-tab-${t.key}`}
                    aria-selected={t.key === tab}
                    aria-controls="install-panel"
                    tabIndex={t.key === tab ? 0 : -1}
                    onClick={() => setTab(t.key)}
                    onKeyDown={onTabKey}
                    className={`h-8 rounded-lg px-3 text-[13px] font-medium whitespace-nowrap transition-colors ${
                      t.key === tab ? "bg-overlay text-ink" : "text-ink-3 hover:text-ink-2"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <CopyButton text={current.commands.join("\n")} />
            </div>
            <div
              id="install-panel"
              role="tabpanel"
              aria-labelledby={`install-tab-${tab}`}
              className="space-y-1.5 overflow-x-auto px-5 py-5 font-mono text-[13px] leading-[1.75] md:px-6 md:text-[14px]"
            >
              {current.commands.map((c, i) => (
                <p key={`${tab}-${i}`} className="whitespace-pre text-ink">
                  <span className="text-ink-3 select-none">{current.prompt} </span>
                  {/* Typed in on first view; switching tabs shows the others whole */}
                  <span data-command={tab === TABS[0].key ? "" : undefined} className="inline-block">
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
            </div>
          </div>

          <figure data-browser="" className="relative mt-5 overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-pop lg:mt-6 lg:ml-12">
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
        </div>
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
