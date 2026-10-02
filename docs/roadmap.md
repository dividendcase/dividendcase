# Roadmap

Last updated 30 September 2026. Work happens in this order; each item starts only when Pratik says so.

## Until 1 November 2026

- dividendcase.com keeps serving the old hosted app until closure day. We decided (29 Sep) not to switch
  earlier, so nothing that works today breaks. The new website goes live on 1 November as part of the
  closure-day checklist.
- Pratik installs Vercel's GitHub app on the `dividendcase` org (Vercel → Add New → Project → Import from
  GitHub), so a preview project can build `site/`.

## 1. Landing page redesign (October 2026)

**Goal:** a landing page that shows, in motion, what DividendCase does. It should feel modern, technical
and fluid from top to bottom, use the whole screen, and avoid anything that looks generated or templated.

### What's wrong today

- Only the Story section moves with the scroll. The dial turns, then the door and the calendar appear
  as separate pieces, so the dial never resolves into the whole vault.
- Everything else is static cards with fade-ins: Markets, Features, Privacy, Install, Open source and
  the FAQ.
- The text predates income after tax, home currency and the Docker image.

### Direction: one continuous scroll film

The page tells one story: your dividends, from everywhere, kept safe on your own computer. Each scene
hands over to the next without a cut.

| Scene | What it shows | How |
|---|---|---|
| 1. Hero, full screen | The vault dial from the logo as a real 3D object. Dividend payments (green points) drift towards it from around the world. Headline revealed word by word. Reacts to the pointer. | Three.js via react-three-fiber; GSAP SplitText |
| 2. Unlock, pinned | Scrolling turns the dial. It clicks through its ticks, the door swings open in 3D and the camera moves inside: one continuous move. This fixes today's break. | One GSAP ScrollTrigger timeline, pinned and scrubbed |
| 3. Holdings | Inside the vault, holdings from many markets fly in as cards (ticker, exchange, currency) and settle into a portfolio. | Same timeline; Motion layout for the cards |
| 4. Income calendar | The cards resolve into the 12-month income calendar; month bars grow in. | GSAP, bars in SVG or WebGL |
| 5. After tax | The bars shrink by what each country withholds, labelled (US 15%, Canada 15%…). Totals convert to the home currency and tick down to the net figure. | GSAP counters in Geist Mono |
| 6. Markets | A globe with arcs from the exchanges (NYSE, LSE, TSX, NSE, ASX, Euronext Dublin) to "your computer"; arcs light up as payments arrive. | Three.js globe (ThreeUI or Originkit as reference) |
| 7. Privacy | Data flows in (prices from Yahoo, rates from the ECB), but nothing flows out: outbound lines stop at the edge of the machine. | SVG + GSAP DrawSVG |
| 8. Features | A bento grid of live mini-screens from the app: screener filter, DRIP projection, withholding table, Excel import. Each one animates on hover. | 21st.dev bento patterns, Motion |
| 9. Install | A terminal types `uv tool install dividendcase`, then "Ready at http://127.0.0.1:8765", with tabs for macOS, Windows, Linux and Docker, and a copy button. | GSAP text, Motion tabs |
| 10. Open source and FAQ | The AGPL, GitHub and the release feed; a quiet FAQ. | Motion |
| 11. Footer | A large animated wordmark. | Originkit Vector Wordmark as reference |

### Tools and what each one is for

- **taste-skill** (tasteskill.dev, open source, `Leonxlnx/taste-skill`): the design-review gate. Read
  it before building; apply its brief inference, redesign rules and pre-flight check to every section.
  Review the repo before installing; Pratik runs the install.
- **GSAP** (gsap.com, free including every plugin): owns everything tied to the scroll.
  - ScrollTrigger for pinning and scrubbing;
  - SplitText for the headlines;
  - DrawSVG and MorphSVG for the lines and shapes;
  - `@gsap/react` (`useGSAP`) for cleanup.
- **Motion** (motion.dev, already in `site/`): owns interactions, meaning hover, layout, tabs and things
  appearing. Rule: GSAP drives scroll timelines, Motion drives interaction, never both on the same element.
- **Lenis**: smooth scrolling, synced to ScrollTrigger through the GSAP ticker.
- **Three.js with react-three-fiber and drei**: the vault and the globe. Loaded after first paint, paused
  when off screen, pixel ratio capped.
- **Originkit** (originkit.dev, free tier plus a paid plan; MCP at mcp.originkit.dev): animated WebGL
  and shader components to start from, recoloured to the brand. Candidates: Particle Drift, Globe
  Study, Scroll Wave Field, Light Cables, Vector Wordmark.
- **ThreeUI** (threeui.com, paid Pro): WebGL heroes and globes (Betawise Globe, Meridian). Use only if
  a free option can't do the job.
- **21st.dev** (shadcn registry, 2 free copies a day, paid membership; MCP): section patterns such as
  the bento grid, terminal, accordion and call to action.

### Guardrails

- **Brand:**
  - Colours:
    - dark first;
    - sprout green for money and primary actions only;
    - lavender only for Keeper;
    - amber and red only for risk.
  - Type:
    - Geist for text;
    - Geist Mono for every number;
    - Instrument Serif italic for at most one word in a headline.
  - No emoji. Sentence-case labels.
- **No AI slop:** avoid the looks that give generated pages away.
  - no purple-blue gradients, glass cards everywhere, sparkles, generic 3D blobs or stock icons;
  - no "Unlock the power of" copy;
  - every animation has to explain something about the product.
- **Licences:** `site/` is in the public AGPL repo. Code from paid libraries (ThreeUI Pro, Originkit Pro,
  21st premium) usually can't be published as source. Check each licence before copying. If it isn't
  allowed, either rebuild the effect ourselves, or move the website into its own private repo.
  **Decide this before building.**
- **Honest content:** example portfolios use invented numbers, labelled as examples, and never Yahoo data.
- **Performance and access:**
  - Speed and scores:
    - the largest element on screen appears within 2.5 s on a mid-range phone;
    - a steady 60 fps;
    - Lighthouse at least 90 for performance and 100 for accessibility.
  - Fallbacks:
    - with `prefers-reduced-motion`, every scene is a still frame;
    - phones get lighter scenes;
    - the page works without WebGL.
  - The page stays a static export.

### Steps

1. **Set up** (Pratik approves each step):
   - install taste-skill;
   - connect the Originkit and 21st MCP servers;
   - add GSAP, `@gsap/react`, Lenis and three, @react-three/fiber and @react-three/drei to `site/`.
2. **Storyboard for review before any code:** a frame and the copy for each scene, published as a
   private page for Pratik.
3. **Build in this order:**
   1. the hero and unlock sequence (scenes 1–5, the core);
   2. the globe;
   3. privacy;
   4. the bento grid;
   5. install;
   6. open source, the FAQ and the footer.
4. **Check** performance, accessibility, phones and reduced motion.
5. **Preview** on Vercel. Pratik reviews it, and it goes live on 1 November.

## 2. Broker imports

**Order:** Zerodha → Angel One (India), then Trading 212 → Revolut → Degiro.
**Releases:** 0.4.0 for Zerodha and Angel One; 0.5.0 for Trading 212, Revolut and Degiro.

**For each broker:**

- Pratik provides one real export, anonymised and kept outside the repo.
- Tests use invented rows in the same column layout; real exports are never committed.
- The import:
  1. reads the file;
  2. shows a preview of the holdings and purchase lots it will add;
  3. then saves.
- Importing the same file twice adds nothing new.
- It opens from the existing Import dialog, with a choice of broker.

| Broker | Likely export (to confirm with a real file) | Identifies stocks by | Notes |
|---|---|---|---|
| Zerodha | Console tradebook and holdings (CSV/XLSX) | NSE/BSE symbol + ISIN | Map to Yahoo `.NS` / `.BO` |
| Angel One | Trade book and holdings reports | NSE/BSE symbol + ISIN | Same mapping as Zerodha |
| Trading 212 | History export (CSV) | Ticker + ISIN | Includes dividends and the tax withheld |
| Revolut | Trading account statement (CSV) | Ticker | Buys, sells and dividends |
| Degiro | Transactions and account statement (CSV) | ISIN + exchange | Dividends and dividend tax are separate rows |

**Progress:** Zerodha tradebooks import (October 2026), tested on invented trades; waiting for a real,
anonymised export to check the format before 0.4.0. Next: Angel One.

**Follow-up once imports work:** import the dividends actually received and the tax withheld, then
compare them with what the app expected. When a broker withheld a different rate from our estimate,
offer to use the broker's rate for that country.

## 3. Other open items

- Pratik: check the Irish withholding rates. A tax professional reviews the whole table before 1.0.
- Decide on a private feedback address for people without a GitHub account (feedback@dividendcase.com).
- Later:
  - more withholding source countries (DE, FR, NL, CH, ES, JP);
  - the Cloud prototype (no billing yet).
