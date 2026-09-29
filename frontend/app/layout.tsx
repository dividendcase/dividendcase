import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

// next/font downloads these at build time and serves them from the app, so nothing is fetched from Google
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: { default: "DividendCase", template: "%s · DividendCase" },
  description: "A free, open-source dividend tracker that runs on your own computer",
  icons: {
    icon: "/logo-icon.svg",
    apple: "/logo-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e0e13",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
