/** Facts and links shared across the page. Keep these true to the app as it ships today. */

export const GITHUB_URL = "https://github.com/dividendcase/dividendcase";

export const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#privacy", label: "Privacy" },
  { href: "#faq", label: "FAQ" },
] as const;


export const DATA_FOLDERS = {
  macos: "~/Library/Application Support/DividendCase",
  windows: "%LOCALAPPDATA%\\DividendCase\\DividendCase",
  linux: "~/.local/share/DividendCase",
} as const;

export const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-[10px] bg-sprout px-4 py-2.5 text-[14px] font-semibold " +
  "text-sprout-ink transition-colors duration-150 hover:bg-sprout-hi";

export const buttonOutline =
  "inline-flex items-center justify-center gap-2 rounded-[10px] border border-line-strong bg-ground/40 px-4 py-2.5 " +
  "text-[14px] font-semibold text-ink transition-colors duration-150 hover:border-ink-3 hover:bg-raised";
