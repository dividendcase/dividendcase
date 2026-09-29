import { Faq } from "@/components/Faq";
import { Features } from "@/components/Features";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { Install } from "@/components/Install";
import { Markets } from "@/components/Markets";
import { MotionProvider } from "@/components/MotionProvider";
import { Nav } from "@/components/Nav";
import { OpenSource } from "@/components/OpenSource";
import { Privacy } from "@/components/Privacy";
import { Story } from "@/components/Story";

export default function Home() {
  return (
    <MotionProvider>
      <div id="top">
        <a
          href="#main"
          className="sr-only z-[60] rounded-lg bg-sprout px-4 py-2 font-semibold text-sprout-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <Nav />
        <main id="main">
          <Hero />
          <Markets />
          <Story />
          <Features />
          <Privacy />
          <Install />
          <OpenSource />
          <Faq />
        </main>
        <Footer />
      </div>
    </MotionProvider>
  );
}
