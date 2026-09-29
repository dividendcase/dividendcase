/** Facts and links shared across the page. Keep these true to the app as it ships today. */

export const GITHUB_URL = "https://github.com/dividendcase/dividendcase";
export const LOCAL_URL = "http://127.0.0.1:8765";

export const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#privacy", label: "Privacy" },
  { href: "#install", label: "Install" },
  { href: "#faq", label: "FAQ" },
] as const;

export const MARKETS = ["NYSE", "NASDAQ", "LSE", "Euronext Dublin", "NSE", "BSE", "TSX", "ASX"] as const;

export const DATA_FOLDERS = {
  macos: "~/Library/Application Support/DividendCase",
  windows: "%LOCALAPPDATA%\\DividendCase\\DividendCase",
  linux: "~/.local/share/DividendCase",
} as const;

/** Sample portfolio used by the illustrations: USD, next 12 months starting in October */
export const SAMPLE_MONTHS = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"] as const;
export const SAMPLE_INCOME = [468, 332, 451, 318, 356, 470, 322, 348, 462, 330, 474, 481] as const;
export const SAMPLE_TOTAL = SAMPLE_INCOME.reduce((a, b) => a + b, 0);

export const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-[10px] bg-sprout px-4 py-2.5 text-[14px] font-semibold " +
  "text-sprout-ink transition-colors duration-150 hover:bg-sprout-hi";

export const buttonOutline =
  "inline-flex items-center justify-center gap-2 rounded-[10px] border border-line-strong bg-ground/40 px-4 py-2.5 " +
  "text-[14px] font-semibold text-ink transition-colors duration-150 hover:border-ink-3 hover:bg-raised";
