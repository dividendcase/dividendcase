"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Copy, FlaskConical } from "lucide-react";
import { DATA_FOLDERS, GITHUB_URL, LOCAL_URL } from "./site";

type OsKey = "macos" | "windows" | "linux";

const OSES: { key: OsKey; label: string; prompt: string; uv: string; shell: string }[] = [
  {
    key: "macos",
    label: "macOS",
    prompt: "$",
    shell: "Terminal",
    uv: "curl -LsSf https://astral.sh/uv/install.sh | sh",
  },
  {
    key: "windows",
    label: "Windows",
    prompt: ">",
    shell: "PowerShell",
    uv: 'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"',
  },
  {
    key: "linux",
    label: "Linux",
    prompt: "$",
    shell: "a terminal",
    uv: "curl -LsSf https://astral.sh/uv/install.sh | sh",
  },
];

const FROM_SOURCE = [
  { cmd: `git clone ${GITHUB_URL}` },
  { cmd: "cd dividendcase" },
  { cmd: "uv sync" },
  { cmd: "uv run python scripts/build_web.py", note: "needs Node.js 20 or newer" },
  { cmd: "uv run dividendcase" },
];

export function Install() {
  const [os, setOs] = useState<OsKey>("macos");
  const tabRefs = useRef<Record<OsKey, HTMLButtonElement | null>>({ macos: null, windows: null, linux: null });

  // Start on the visitor's own system
  useEffect(() => {
    const ua = navigator.userAgent;
    if (/Windows/i.test(ua)) setOs("windows");
    else if (/Linux|X11|CrOS/i.test(ua) && !/Android/i.test(ua)) setOs("linux");
  }, []);

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    const i = OSES.findIndex((o) => o.key === os);
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % OSES.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + OSES.length) % OSES.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = OSES.length - 1;
    else return;
    e.preventDefault();
    const key = OSES[next].key;
    setOs(key);
    tabRefs.current[key]?.focus();
  }

  return (
    <section id="install" aria-labelledby="install-title" className="py-24 sm:py-28">
      <div className="container-page">
        <div className="max-w-[640px]">
          <p className="eyebrow">Install</p>
          <h2 id="install-title" className="heading mt-4 text-[34px] sm:text-[44px]">
            Up and running in three <em className="serif-accent text-[1.1em]">steps</em>.
          </h2>
          <p className="mt-4 text-[17px] leading-[1.6] text-ink-2">
            DividendCase installs with uv, a small tool that also sets up Python for you. It&apos;s free, and there
            is nothing to sign up for.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          {/* Install with uv, per system */}
          <div className="rounded-2xl border border-line bg-surface shadow-card">
            <div
              role="tablist"
              aria-label="Operating system"
              className="flex gap-1 border-b border-line p-2"
            >
              {OSES.map((o) => (
                <button
                  key={o.key}
                  ref={(el) => {
                    tabRefs.current[o.key] = el;
                  }}
                  id={`tab-${o.key}`}
                  type="button"
                  role="tab"
                  aria-selected={os === o.key}
                  aria-controls={`panel-${o.key}`}
                  tabIndex={os === o.key ? 0 : -1}
                  onClick={() => setOs(o.key)}
                  onKeyDown={onTabKey}
                  className={`rounded-lg px-4 py-2 text-[14px] font-medium transition-colors ${
                    os === o.key ? "bg-raised text-ink" : "text-ink-3 hover:text-ink"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {OSES.map((o) => (
              <div
                key={o.key}
                id={`panel-${o.key}`}
                role="tabpanel"
                aria-labelledby={`tab-${o.key}`}
                hidden={os !== o.key}
                className="p-5 sm:p-6"
              >
                <ol className="space-y-7">
                  <Step n={1} title="Install uv">
                    <p>
                      Open {o.shell} and paste this. uv installs Python for you when it&apos;s needed.
                    </p>
                    <Command prompt={o.prompt} cmd={o.uv} />
                  </Step>
                  <Step n={2} title="Install DividendCase">
                    <p>The app and everything it needs, kept apart from the rest of your computer.</p>
                    <Command prompt={o.prompt} cmd="uv tool install dividendcase" />
                  </Step>
                  <Step n={3} title="Run it">
                    <Command prompt={o.prompt} cmd="dividendcase" />
                    <p>
                      It opens <span className="num text-ink">{LOCAL_URL}</span> in your browser. Your data is kept in{" "}
                      <span className="num text-ink [overflow-wrap:anywhere]">{DATA_FOLDERS[o.key]}</span>.
                    </p>
                  </Step>
                </ol>
              </div>
            ))}
          </div>

          {/* Early access: run from source */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
            <div className="flex gap-3.5">
              <span className="grid size-9 flex-none place-items-center rounded-xl border border-line bg-raised text-ink">
                <FlaskConical className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-[16px] font-semibold tracking-[-0.01em] text-ink">An early release</p>
                <p className="mt-1 text-[15px] leading-[1.6] text-ink-2">
                  DividendCase is new, so updates come often. The app tells you when one is out, and saves a copy of
                  your data before an update changes anything.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <Command prompt="$" cmd="uv tool upgrade dividendcase" />
              <p className="pl-1 font-mono text-[11.5px] text-ink-3">
                To remove it: uv tool uninstall dividendcase (your data folder stays)
              </p>
            </div>

            <details className="group mt-5 rounded-xl border border-line bg-well">
              <summary className="flex cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-3 text-[14.5px] font-medium text-ink">
                Run it from source
                <ChevronDown
                  className="size-4 flex-none text-ink-3 transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="space-y-3 border-t border-line p-4">
                <p className="text-[13.5px] leading-[1.6] text-ink-2">
                  You need uv (step 1), git, and Node.js 20 or newer to build the interface.
                </p>
                <ol className="space-y-2">
                  {FROM_SOURCE.map((s) => (
                    <li key={s.cmd}>
                      <Command prompt="$" cmd={s.cmd} />
                      {s.note && <p className="mt-1 pl-1 font-mono text-[11.5px] text-ink-3">{s.note}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          </div>
        </div>
      </div>
    </section>
  );
}

function Step({
  n,
  title,
  badge,
  children,
}: {
  n: number;
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-4">
      <span className="num grid size-7 place-items-center rounded-full border border-line-strong text-[12.5px] text-ink">
        {n}
      </span>
      <div className="min-w-0 space-y-3 text-[14.5px] leading-[1.6] text-ink-2">
        <h3 className="flex flex-wrap items-center gap-2.5 pt-0.5 text-[16px] font-semibold tracking-[-0.01em] text-ink">
          {title}
          {badge}
        </h3>
        {children}
      </div>
    </li>
  );
}

function Command({ prompt, cmd }: { prompt: string; cmd: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-line bg-ground py-1.5 pr-1.5 pl-3.5">
      <span className="py-1.5 font-mono text-[13px] text-ink-3 select-none" aria-hidden="true">
        {prompt}
      </span>
      <code className="min-w-0 flex-1 py-1.5 font-mono text-[13px] leading-[1.55] whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">
        {cmd}
      </code>
      <CopyButton text={cmd} />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

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
        aria-label={copied ? "Copied" : `Copy command: ${text}`}
        className={`inline-flex h-8 flex-none items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium transition-colors ${
          copied ? "text-sprout-hi" : "text-ink-2 hover:bg-raised hover:text-ink"
        }`}
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
      </button>
      <span className="sr-only" role="status">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </>
  );
}
