export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", CAD: "C$", GBP: "£", GBp: "p", EUR: "€", AUD: "A$", INR: "₹", JPY: "¥", HKD: "HK$", CHF: "CHF ",
};

export function currencySymbol(currency: string | undefined | null): string {
  if (!currency) return "";
  return CURRENCY_SYMBOLS[currency] ?? `${currency} `;
}

/** 1234.5 → "$1,235" (or with decimals when the amount is small). */
export function formatMoney(amount: number, currency?: string | null, opts: { decimals?: number } = {}): string {
  // London prices and dividends come in pence (GBp); show them in pounds
  if (currency === "GBp") return formatMoney(amount / 100, "GBP", opts);
  const abs = Math.abs(amount);
  const decimals = opts.decimals ?? (abs > 0 && abs < 100 ? 2 : 0);
  const body = abs.toLocaleString("en", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${amount < 0 ? "−" : ""}${currencySymbol(currency)}${body}`;
}

/** Currency code for labels: pence (GBp) amounts are shown in pounds. */
export function currencyLabel(currency: string | undefined | null): string {
  if (!currency) return "";
  return currency === "GBp" ? "GBP" : currency;
}

export function formatPct(value: number | null | undefined, decimals = 2): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(decimals)}%`;
}

/** "2026-10-15" → "15 Oct" (adds the year when it isn't this year). */
export function formatShortDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

export function daysUntil(iso: string): number {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "never";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** Short label for a payment frequency from the API ("quarterly" → "Quarterly"). */
export function frequencyLabel(freq: string | null | undefined): string {
  if (!freq) return "—";
  const f = freq.toLowerCase();
  if (f.includes("month")) return "Monthly";
  if (f.includes("quarter")) return "Quarterly";
  if (f.includes("semi") || f.includes("half")) return "Half-yearly";
  if (f.includes("annual") || f.includes("year")) return "Yearly";
  return freq.charAt(0).toUpperCase() + freq.slice(1);
}
