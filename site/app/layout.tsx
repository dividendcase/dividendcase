import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// next/font downloads these at build time and serves them with the site: no requests to Google
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

const title = "DividendCase: a free dividend tracker that runs on your computer";
const description =
  "Enter the shares you own and see the dividends they should pay, across markets, after tax and in your " +
  "currency. Free and open source: it runs on your own computer, with no account and no connection to your " +
  "broker or bank.";

export const metadata: Metadata = {
  metadataBase: new URL("https://dividendcase.com"),
  title,
  description,
  applicationName: "DividendCase",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "DividendCase",
    url: "/",
    title,
    description,
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#0e0e13",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
