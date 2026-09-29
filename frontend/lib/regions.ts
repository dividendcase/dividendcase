/** Tax residences offered in setup, with the currency most people there count in. */
export const TAX_RESIDENCES: { code: string; name: string; currency: string }[] = [
  { code: "IE", name: "Ireland", currency: "EUR" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "IN", name: "India", currency: "INR" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "NZ", name: "New Zealand", currency: "NZD" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "NL", name: "Netherlands", currency: "EUR" },
  { code: "ES", name: "Spain", currency: "EUR" },
  { code: "IT", name: "Italy", currency: "EUR" },
  { code: "BE", name: "Belgium", currency: "EUR" },
  { code: "AT", name: "Austria", currency: "EUR" },
  { code: "PT", name: "Portugal", currency: "EUR" },
  { code: "FI", name: "Finland", currency: "EUR" },
  { code: "LU", name: "Luxembourg", currency: "EUR" },
  { code: "CH", name: "Switzerland", currency: "CHF" },
  { code: "SE", name: "Sweden", currency: "SEK" },
  { code: "NO", name: "Norway", currency: "NOK" },
  { code: "DK", name: "Denmark", currency: "DKK" },
  { code: "PL", name: "Poland", currency: "PLN" },
  { code: "SG", name: "Singapore", currency: "SGD" },
  { code: "HK", name: "Hong Kong", currency: "HKD" },
  { code: "JP", name: "Japan", currency: "JPY" },
  { code: "ZA", name: "South Africa", currency: "ZAR" },
  { code: "ZZ", name: "Somewhere else", currency: "USD" },
];

export const CURRENCY_NAMES: Record<string, string> = {
  EUR: "Euro", USD: "US dollar", GBP: "British pound", INR: "Indian rupee", CAD: "Canadian dollar",
  AUD: "Australian dollar", NZD: "New Zealand dollar", CHF: "Swiss franc", SEK: "Swedish krona",
  NOK: "Norwegian krone", DKK: "Danish krone", PLN: "Polish zloty", SGD: "Singapore dollar",
  HKD: "Hong Kong dollar", JPY: "Japanese yen", ZAR: "South African rand", CNY: "Chinese yuan",
  KRW: "South Korean won", BRL: "Brazilian real", MXN: "Mexican peso", CZK: "Czech koruna",
  HUF: "Hungarian forint", ILS: "Israeli shekel", IDR: "Indonesian rupiah", ISK: "Icelandic krona",
  MYR: "Malaysian ringgit", PHP: "Philippine peso", RON: "Romanian leu", THB: "Thai baht", TRY: "Turkish lira",
  BGN: "Bulgarian lev",
};

/** A best guess from the browser, e.g. "en-IE" → Ireland. */
export function guessResidence(): string | null {
  if (typeof navigator === "undefined") return null;
  for (const tag of navigator.languages ?? [navigator.language]) {
    const region = tag.split("-")[1]?.toUpperCase();
    if (region && TAX_RESIDENCES.some((r) => r.code === region)) return region;
  }
  return null;
}
