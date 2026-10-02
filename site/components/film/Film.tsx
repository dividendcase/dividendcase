"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Dial, TICK_RING } from "./Dial";
import { FilmStatic } from "./FilmStatic";
import { ParticleCanvas } from "./ParticleCanvas";
import { PaymentTrails } from "./PaymentTrails";
import type { ParticleControls } from "./particles";
import { HeroCopy, HoldingCard, IncomeChart, RateChips } from "./parts";
import { EXCHANGE_COUNT, GROSS_TOTAL, HOLDINGS, NET_TOTAL, WITHHELD_TOTAL, formatEuro } from "./example";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/*
 * The hero and "how it works" as one scroll film (frames 1 to 6 of the storyboard).
 *
 * A sticky full-screen stage stays put while the section scrolls past; one GSAP timeline, scrubbed
 * by the scroll, moves everything on it:
 *   0    hero: the dial on the right, payments streaming into it
 *   1-3  the dial fills the screen and turns; each tick lights as it passes the notch
 *   3-4  the view pulls back to the whole vault, the dial in its place on the door
 *   4-5  the door swings open
 *   5-6  the camera goes through the opening
 *   6-7  holdings arrive
 *   7-8  they become the 12-month income calendar
 *   8-10 the tax each country keeps lifts off; the total counts down to after tax
 * Reduced motion gets FilmStatic instead: the same content, still and in order.
 */

/** Where the dial sits on the vault door, as a share of the vault's width and height */
const DIAL_X = 0.577;
const DIAL_Y = 0.519;
const DIAL_SIZE = 0.346;
const CARD_TILT = [-1, 0.8, -0.6, 0.6, -1.2, 0.9, -0.5, 0.7, -0.8];

export function Film() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced ? <FilmStatic /> : <FilmScroll />;
}

function FilmScroll() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const vault = useRef<HTMLDivElement>(null);
  const dial = useRef<SVGSVGElement>(null);
  const [particles] = useState<ParticleControls>(() => ({ inside: 0, opacity: 0 }));
  // New payments arrive only while the hero is on screen
  const heroOnScreen = useRef(true);
  const heroActive = useCallback(() => heroOnScreen.current, []);

  useGSAP(
    () => {
      const q = gsap.utils.selector(section);
      const one = (selector: string) => q(selector)[0];

      /** The vault's transform that puts the dial's centre at (px, py) with diameter d */
      const place = (px: number, py: number, d: number) => {
        const box = stage.current!;
        const w = vault.current!.offsetWidth;
        const h = vault.current!.offsetHeight;
        const scale = d / (DIAL_SIZE * w);
        return {
          x: px - box.clientWidth / 2 - scale * (DIAL_X - 0.5) * w,
          y: py - box.clientHeight / 2 - scale * (DIAL_Y - 0.5) * h,
          scale,
        };
      };
      /** Where the hero's words end, measured on the text itself rather than its boxes */
      const words = () => {
        const box = stage.current!.getBoundingClientRect();
        let right = 0;
        let bottom = 0;
        for (const el of q("[data-hero] h1, [data-hero] p")) {
          const range = document.createRange();
          range.selectNodeContents(el);
          const r = range.getBoundingClientRect();
          right = Math.max(right, r.right - box.left);
          bottom = Math.max(bottom, r.bottom - box.top);
        }
        return { right, bottom };
      };
      /** The dial beside the words when there's room for it, else below them, cut off by the bottom edge */
      const hero = () => {
        const { clientWidth: W, clientHeight: H } = stage.current!;
        const text = words();
        const room = W - text.right - 48;
        if (W >= 768 && room >= 300) {
          return place(text.right + 48 + room / 2, H * 0.55, Math.min(room - 40, W * 0.3, H * 0.54));
        }
        const d = Math.min(W * 0.76, 440);
        return place(W / 2, Math.max(text.bottom + d * 0.62, H * 0.8), d);
      };
      // Large but whole, below the nav and right of centre, so the caption at the bottom left
      // has dark ground
      const turn = () => {
        const { clientWidth: W, clientHeight: H } = stage.current!;
        const d = Math.min(W * (W >= 768 ? 0.62 : 0.9), (H - 64) * 0.84);
        return place(W >= 768 ? W * 0.62 : W / 2, 64 + (H - 64) / 2, d);
      };

      // The dial: the scroll's turn plus a little pointer play in the hero. They live in separate
      // objects, so the pointer's tween can never replace the timeline's.
      const dialState = { theta: 0 };
      const pointer = { turn: 0 };
      const rotors = q("[data-rotor]");
      const lit = one("[data-lit]");
      const drawDial = () => {
        gsap.set(rotors, { rotation: dialState.theta + pointer.turn, svgOrigin: "340 340" });
        lit.setAttribute("stroke-dasharray", `${(dialState.theta / 360) * TICK_RING} ${TICK_RING}`);
      };
      drawDial();

      const count = { holdings: 0 };
      const total = { euros: 0 };
      const countEl = one("[data-count]");
      const totalEl = one("[data-total]");
      const drawCount = () => (countEl.textContent = String(Math.round(count.holdings)));
      const drawTotal = () => (totalEl.textContent = formatEuro(total.euros));

      gsap.set(vault.current, { xPercent: -50, yPercent: -50 });
      // Arrival: the dial fades in and the payments start to flow. These touch only the dial and the
      // particles' strength before the film, never what the timeline animates, so a page that loads
      // halfway down (the browser restoring the scroll) still has its hero when you scroll back up.
      gsap.fromTo(dial.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.4, ease: "power2.out", delay: 0.15 });
      gsap.to(particles, { opacity: 0.95, duration: 2.4, ease: "power1.out", delay: 0.4 });

      const tl = gsap.timeline({
        defaults: { ease: "power2.inOut" },
        scrollTrigger: {
          trigger: section.current,
          start: "top top",
          end: "bottom bottom",
          // A second and a half of catch-up: a fast flick of the wheel plays the film through
          // instead of jumping to the end of it
          scrub: 1.5,
          invalidateOnRefresh: true,
          onUpdate: (self) => (heroOnScreen.current = self.progress < 0.06),
        },
      });

      // 0-1: the hero leaves and the dial moves to the centre
      tl.to(one("[data-hero]"), { autoAlpha: 0, y: -70, duration: 0.7, ease: "power2.in" }, 0)
        .to(one("[data-trails]"), { autoAlpha: 0, duration: 0.5 }, 0)
        .fromTo(
          vault.current,
          { x: () => hero().x, y: () => hero().y, scale: () => hero().scale },
          { x: () => turn().x, y: () => turn().y, scale: () => turn().scale, duration: 1 },
          0,
        );

      // 1-3: it turns
      tl.to(dialState, { theta: 300, duration: 2, ease: "none", onUpdate: drawDial }, 1)
        .fromTo(one("[data-caption='turn']"), { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.3 }, 1.15)
        .to(one("[data-caption='turn']"), { autoAlpha: 0, y: -26, duration: 0.3 }, 2.6);

      // 3-4: pull back to the whole vault
      tl.to(vault.current, { x: 0, y: () => -stage.current!.clientHeight * 0.05, scale: 1, duration: 1.1, ease: "power3.inOut" }, 3)
        .fromTo(q("[data-shell]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.85, ease: "power1.out" }, 3.1);

      // 4-5.2: the door opens and light spills out
      tl.fromTo(
        one("[data-door]"),
        { rotationY: 0, transformPerspective: 1500, transformOrigin: "left center" },
        { rotationY: -84, duration: 1.2 },
        4,
      )
        .fromTo(one("[data-glow]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.9 }, 4.15)
        .fromTo(one("[data-caption='open']"), { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.3 }, 4.1)
        .to(one("[data-caption='open']"), { autoAlpha: 0, y: -26, duration: 0.3 }, 4.95);

      // 5.2-6.2: through the opening
      // The opening's light grows until it is the room; the vault fades only once it fills the screen
      tl.to(vault.current, { scale: 11, duration: 1.2, ease: "power2.in" }, 5.2)
        .fromTo(one("[data-interior]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.7, ease: "power1.inOut" }, 5.5)
        .to(vault.current, { autoAlpha: 0, duration: 0.55, ease: "power1.in" }, 5.85)
        .to(particles, { inside: 1, duration: 0.9 }, 5.35);

      // 6.2-7.4: holdings arrive
      const cards = q("[data-card]");
      tl.fromTo(one("[data-heading='holdings']"), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.4 }, 6.2)
        .fromTo(one("[data-meta='holdings']"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 6.3)
        .fromTo(
          cards,
          {
            autoAlpha: 0,
            x: (i: number) => 420 + (i % 3) * 140,
            y: (i: number) => -120 + Math.floor(i / 3) * 90,
            rotation: (i: number) => 16 - i * 3.5,
            scale: 0.45,
          },
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            rotation: (i: number) => CARD_TILT[i],
            scale: 1,
            duration: 0.55,
            ease: "power3.out",
            stagger: 0.075,
          },
          6.3,
        )
        .to(count, { holdings: HOLDINGS.length, duration: 0.8, ease: "none", onUpdate: drawCount }, 6.35);

      // 7.4-8.6: they become the income calendar
      tl.to(one("[data-heading='holdings']"), { autoAlpha: 0, y: -30, duration: 0.3 }, 7.4)
        .to(one("[data-meta='holdings']"), { autoAlpha: 0, duration: 0.25 }, 7.4)
        .to(cards, { autoAlpha: 0, y: 160, scale: 0.55, duration: 0.45, ease: "power2.in", stagger: 0.025 }, 7.4)
        .fromTo(one("[data-heading='calendar']"), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.4 }, 7.65)
        .fromTo(one("[data-meta='total']"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 }, 7.7)
        .fromTo(one("[data-chart]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 7.65)
        .fromTo(q("[data-bar]"), { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: "power3.out", stagger: 0.045 }, 7.7)
        .to(total, { euros: GROSS_TOTAL, duration: 0.9, ease: "power1.out", onUpdate: drawTotal }, 7.75)
        .fromTo(particles, { opacity: 0.95 }, { opacity: 0.45, duration: 0.6, immediateRender: false }, 7.6);

      // 8.6-10: the tax at source lifts off, and the total counts down to what reaches you
      tl.to(one("[data-heading='calendar']"), { autoAlpha: 0, y: -30, duration: 0.3 }, 8.6)
        .fromTo(one("[data-heading='tax']"), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.4 }, 8.75)
        .to(q("[data-wcap]"), { y: -12, duration: 0.5, ease: "power2.out", stagger: 0.03 }, 8.8)
        .to(q("[data-wsolid]"), { autoAlpha: 0, duration: 0.4, stagger: 0.03 }, 8.8)
        .fromTo(q("[data-whatch]"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4, stagger: 0.03 }, 8.85)
        .fromTo(q("[data-taxlabel]"), { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.08 }, 9.1)
        .to(one("[data-total-label='gross']"), { autoAlpha: 0, duration: 0.2 }, 8.8)
        .fromTo(one("[data-total-label='net']"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 8.9)
        .to(total, { euros: NET_TOTAL, duration: 0.8, ease: "power1.inOut", onUpdate: drawTotal }, 8.9)
        .to(totalEl, { color: "#9bd96b", duration: 0.4 }, 8.95)
        .fromTo(one("[data-tax-meta]"), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.35 }, 9.15)
        .to({}, { duration: 0.5 }, 9.7);

      // The dial follows the pointer a little while the hero is on screen
      const mouse = window.matchMedia("(pointer: fine)").matches;
      const onMove = (e: PointerEvent) => {
        if (tl.scrollTrigger && tl.scrollTrigger.progress > 0.05) return;
        gsap.to(pointer, {
          turn: (e.clientX / window.innerWidth - 0.5) * 28,
          duration: 1.2,
          ease: "power3.out",
          onUpdate: drawDial,
          overwrite: true,
        });
      };
      if (mouse) window.addEventListener("pointermove", onMove, { passive: true });
      return () => window.removeEventListener("pointermove", onMove);
    },
    { scope: section },
  );

  return (
    <section ref={section} id="how-it-works" aria-labelledby="hero-title" className="relative h-[880dvh]">
      <div ref={stage} className="sticky top-0 h-dvh w-full overflow-hidden">
        {/* Inside the vault: green light and a floor that runs away from you */}
        <div data-interior="" className="invisible absolute inset-0 opacity-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_65%_55%_at_60%_62%,rgb(74_140_26/0.2)_0%,rgb(14_26_6/0.28)_40%,transparent_80%)]" />
          <div className="absolute top-[68%] left-1/2 h-[60%] w-[220%] [transform:translateX(-50%)_perspective(600px)_rotateX(64deg)] bg-[linear-gradient(rgb(155_217_107/0.1)_1px,transparent_1px),linear-gradient(90deg,rgb(155_217_107/0.1)_1px,transparent_1px)] bg-[size:70px_70px]" />
        </div>

        <ParticleCanvas controls={particles} dialRef={dial} className="pointer-events-none absolute inset-0 size-full" />

        {/* The vault: shell, hinges, the opening and the door with the dial on it */}
        <div
          ref={vault}
          data-vault=""
          className="absolute top-1/2 left-1/2 aspect-[760/520] w-[min(760px,86vw)]"
          aria-hidden="true"
        >
          <div data-shell="" className="invisible opacity-0 absolute inset-0 rounded-[3.7%/5.4%] bg-gradient-to-b from-[#3a3a4c] to-vault-shell shadow-[0_50px_90px_-30px_rgb(0_0_0/0.8),inset_0_1px_0_rgb(255_255_255/0.06)]" />
          <div data-shell="" className="invisible opacity-0 absolute inset-[1.8%_1.8%] overflow-hidden rounded-[2.6%/3.8%] bg-[#09090d] shadow-[inset_0_0_60px_rgb(0_0_0/0.9)]">
            <div data-glow="" className="absolute inset-0 bg-[radial-gradient(ellipse_70%_65%_at_55%_58%,rgb(155_217_107/0.42)_0%,rgb(74_140_26/0.22)_30%,rgb(14_26_6/0.85)_62%,#09090d_100%)]" />
          </div>
          <div data-shell="" className="invisible opacity-0 absolute top-[21%] -left-[2.1%] h-[10%] w-[3.7%] rounded-[25%] bg-gradient-to-r from-[#9a9ab0] to-[#707088]" />
          <div data-shell="" className="invisible opacity-0 absolute top-[69%] -left-[2.1%] h-[10%] w-[3.7%] rounded-[25%] bg-gradient-to-r from-[#9a9ab0] to-[#707088]" />
          <div data-door="" className="absolute inset-[1.8%]">
            <div
              data-shell=""
              className="invisible opacity-0 absolute inset-0 rounded-[2.6%/3.8%] border border-[#7a7a92] bg-gradient-to-r from-[#4c4c60] via-[#66667e] to-[#5a5a70] shadow-[30px_0_60px_rgb(0_0_0/0.55),inset_0_1px_0_rgb(255_255_255/0.12)]"
            >
              {/* The door's inset panel, and the faint sheen of brushed steel */}
              <div className="absolute inset-[6%_5%] rounded-[2%/3%] border border-[#7c7c96]/60 shadow-[inset_0_2px_10px_rgb(0_0_0/0.25),0_1px_0_rgb(255_255_255/0.08)]" />
              <div className="absolute inset-0 rounded-[inherit] bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.025)_0_1px,transparent_1px_4px)]" />
            </div>
            <Dial
              ref={dial}
              glow
              className="invisible absolute top-[52%] left-[58%] w-[36%] -translate-x-1/2 -translate-y-1/2 opacity-0"
            />
          </div>
        </div>

        <PaymentTrails stageRef={stage} dialRef={dial} active={heroActive} />

        {/* 1: the hero */}
        <div data-hero="" className="container-page relative flex h-full flex-col pt-24 md:justify-center md:pt-0">
          <HeroCopy />
        </div>

        {/* 2 and 3: captions over the vault */}
        <Caption name="turn" title="It starts with what you own." body="Kept on your computer, in one file that belongs to you." />
        <Caption
          name="open"
          align="right"
          title="No account to create."
          body="Your portfolio is one file on your machine. Nobody else holds a copy."
        />

        {/* 4 to 6: headings at the top, the visual underneath */}
        <div className="pointer-events-none absolute inset-x-0 top-0 pt-[clamp(84px,13vh,140px)]">
          <div className="container-page flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-10">
            <div className="grid max-w-[640px]">
              <Heading name="holdings" title="Add what you own, from any market.">
                Holdings and purchase lots in any currency, from New York to Mumbai.
              </Heading>
              <Heading name="calendar" title="See every payment coming.">
                A 12-month calendar, projected from each holding&apos;s own payment history.
              </Heading>
              <Heading name="tax" title="And what actually reaches you.">
                Tax kept at source by each country, for where you live. Then everything in your currency, at ECB rates.
              </Heading>
            </div>
            <div className="grid md:justify-items-end md:text-right">
              <div data-meta="holdings" className="invisible opacity-0 [grid-area:1/1]">
                <p className="text-[13px] text-ink-3 md:text-[14px]">Example portfolio</p>
                <p className="mt-1 flex items-baseline gap-2.5 md:justify-end">
                  <span data-count="" className="num text-[clamp(30px,3.4vw,44px)] font-medium tracking-[-0.03em]">
                    0
                  </span>
                  <span className="text-[15px] text-ink-2 md:text-[16px]">holdings across {EXCHANGE_COUNT} exchanges</span>
                </p>
              </div>
              <div data-meta="total" className="invisible opacity-0 [grid-area:1/1]">
                <p className="grid text-[13px] text-ink-3 md:text-[14px]">
                  <span data-total-label="gross" className="[grid-area:1/1]">
                    Next 12 months, example portfolio
                  </span>
                  <span data-total-label="net" className="invisible opacity-0 [grid-area:1/1]">
                    After tax, next 12 months
                  </span>
                </p>
                <p data-total="" className="num mt-1 text-[clamp(30px,3.4vw,48px)] font-medium tracking-[-0.035em] text-ink">
                  {formatEuro(0)}
                </p>
                <div data-tax-meta="" className="invisible opacity-0">
                  <p className="text-[13px] text-ink-2 md:text-[14px]">
                    <span className="num">{formatEuro(WITHHELD_TOTAL)}</span> kept at source from{" "}
                    <span className="num">{formatEuro(GROSS_TOTAL)}</span>, for a resident of Ireland
                  </p>
                  <RateChips className="mt-3 md:max-w-[640px] md:justify-end" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-[max(5vh,28px)]">
          <div className="container-page grid">
            <div className="grid grid-cols-2 gap-2.5 [grid-area:1/1] md:grid-cols-3 md:gap-4 md:px-[4%]">
              {HOLDINGS.map((h) => (
                <HoldingCard key={h.ticker} holding={h} data-card="" style={{ visibility: "hidden" }} />
              ))}
            </div>
            <div data-chart="" className="invisible self-end opacity-0 [grid-area:1/1]">
              <IncomeChart />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** A caption over the vault; `align="right"` keeps it clear of the door as it swings open to the left */
function Caption({ name, title, body, align = "left" }: { name: string; title: string; body: string; align?: "left" | "right" }) {
  const right = align === "right";
  return (
    <div
      data-caption={name}
      className="pointer-events-none invisible absolute inset-x-0 bottom-0 pb-[8vh] opacity-0"
    >
      <div
        className={`absolute -inset-y-24 inset-x-0 ${
          right
            ? "bg-[radial-gradient(ellipse_62%_90%_at_100%_100%,rgb(14_14_19/0.98)_38%,rgb(14_14_19/0.8)_62%,transparent_100%)]"
            : "bg-[radial-gradient(ellipse_62%_90%_at_0%_100%,rgb(14_14_19/0.98)_38%,rgb(14_14_19/0.8)_62%,transparent_100%)]"
        }`}
      />
      <div className={`container-page relative flex flex-col ${right ? "md:items-end md:text-right" : ""}`}>
        <h2 className="heading max-w-[560px] text-[clamp(30px,3.2vw,46px)]">{title}</h2>
        <p className="mt-3 max-w-[520px] text-[17px] leading-[1.6] text-ink-2 md:text-[19px]">{body}</p>
      </div>
    </div>
  );
}

function Heading({ name, title, children }: { name: string; title: string; children: React.ReactNode }) {
  return (
    <div data-heading={name} className="invisible opacity-0 [grid-area:1/1]">
      <h2 className="heading text-[clamp(30px,3.6vw,52px)]">{title}</h2>
      <p className="mt-3 max-w-[560px] text-[16px] leading-[1.6] text-pretty text-ink-2 md:text-[19px]">{children}</p>
    </div>
  );
}
