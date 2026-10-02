import { Faq } from "@/components/Faq";
import { Features } from "@/components/Features";
import { Film } from "@/components/film/Film";
import { Footer } from "@/components/Footer";
import { Install } from "@/components/Install";
import { Markets } from "@/components/Markets";
import { MotionProvider } from "@/components/MotionProvider";
import { Nav } from "@/components/Nav";
import { OpenSource } from "@/components/OpenSource";
import { Privacy } from "@/components/Privacy";
import { SmoothScroll } from "@/components/SmoothScroll";

export default function Home() {
  return (
    <MotionProvider>
      <SmoothScroll>
        <div id="top">
          <a
            href="#main"
            className="sr-only z-[60] rounded-lg bg-sprout px-4 py-2 font-semibold text-sprout-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            Skip to content
          </a>
          <Nav />
          <main id="main">
            <Film />
            <Markets />
            <Features />
            <Privacy />
            <Install />
            <OpenSource />
            <Faq />
          </main>
          <Footer />
        </div>
      </SmoothScroll>
    </MotionProvider>
  );
}
