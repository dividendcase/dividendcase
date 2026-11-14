# DividendCase on YouTube: series plan

Written 14 Nov 2026. One intro film and twelve tutorials, each 5 to 10 minutes, narrated by a calm,
inquisitive synthetic female voice, with the look of a product reveal: dark, precise, quiet.

## 1. What the series is for

- **Intro film:** makes someone who has never heard of DividendCase want to install it. It is the
  channel trailer, the video on the website, and the link in the Store listing.
- **Tutorials:** each one answers a single question a new user actually has ("How do I get my
  holdings in?", "What will I keep after tax?"), shown by using the app. They double as the manual.
- **Success:** a viewer can go from the Store page to a filled Income page without reading anything,
  and every "how do I" email to feedback@ can be answered with a link.

Not goals: stock tips, market commentary, a face on camera, weekly news.

Would count as failure even if the videos look good: a real person's portfolio or Yahoo data on
screen; anything that sounds like investment or tax advice; saying the app "connects to" a broker or
that money "arrives" (the app estimates; say "expected").

## 2. The look and sound

**One idea runs through everything: the case.** The logo's dial and the vault from the website's
scroll film become a real object. It opens at the start of every video and closes at the end.

- **Picture:** black room, one soft key light, shallow depth of field. App screens float as glass
  panes. Sprout green (#7abf50) is the only colour that glows, and it always means money. Lavender
  stays reserved for Keeper and does not appear. Geist for words, Geist Mono for numbers.
- **Titles:** one or two words at a time, centred, sentence case. "Income." "After tax." "One file."
  No emoji, no arrows, no gradients, no em dashes in on-screen or spoken copy.
- **Motion:** slow pushes, never a whip pan. Every move ends on a hold of at least half a second.
- **Sound:** a low pulse, soft mechanical clicks from the dial synced to cuts, room tone under the
  voice. Music is licensed once and reused, mixed well under the narration. Tutorials have music
  only in the first and last 15 seconds.
- **Voice:** female, low to mid pitch, unhurried, close to the microphone. She is curious, not
  selling. The writing rule that produces "inquisitive": every chapter opens with the question the
  viewer is already asking, then the screen answers it.

  > "You own nine companies, in six countries. So what do they pay you in March?" (pause; the
  > calendar opens on March) "Three payments. Here they are."

### Which tool does what

| Tool | Used for | Not used for |
|---|---|---|
| Blender (Cycles) | The case: dial, door, opening and closing. Glass panes carrying app footage in the intro. A 4 second ident for every tutorial. | Anything inside a tutorial's body |
| Manim | Ideas the app can't show by itself: a payment travelling from company to you with tax taken off on the way, FIFO lots, how a 12 month estimate is built from past payments, yield bands. | Decoration |
| Playwright (scripted) | Every app shot. The recorder drives the real app frame by frame, with a drawn pointer, click ripple and zooms. | |
| HyperFrames | Final assembly: titles, lower thirds, chapter tags, key overlays (⌘K). | |
| DaVinci Resolve | Only the intro's final grade and sound mix, if the assembled version needs it. | Tutorials |

## 3. How the videos get made

Your PhysicStuff pipeline (`~/Github/physicstuff.com/youtube`, the `yt` tool) already does nearly all
of this: script with markers, voice takes, word timings, scripted screen recording, Manim and Blender
shots timed to the voice, assembly, loudness, subtitles, chapters, thumbnails. The plan reuses it.

**Screen recordings are scripted, not recorded by hand.** This matters more here than for PhysicStuff:
when the interface changes in 1.1.0, a tutorial is re-rendered with one command instead of re-shot.

**Everything on screen is invented.** All app footage comes from `scripts/demo_server.py` (port 8770,
network blocked, example portfolio), the same source as the website's screenshots, so the film, the
site and the Store listing all show the same numbers. A lower third says "Example portfolio, invented
figures" the first time the app appears in each video.

**Recording format:** 1920×1080 layout at 2× pixel density (a 4K master), 60 fps. Punch-in zooms to
200% stay sharp. Upload at 4K so YouTube gives it the better encoder.

**Per episode, in order:**

1. Script (`script.md`): narration with chapter and cue markers. Read aloud once before any voice.
2. Fact check against the running app: every label spoken matches the label on screen.
3. Voice: generate, listen, re-roll weak lines, lock. Timings come from the locked voice.
4. Record the app to those timings. Render Manim inserts.
5. Assemble, check a frame at every cue, watch once at full speed.
6. Finish: loudness (−14 LUFS), subtitles file, chapters block, thumbnail, description.
7. Upload as private, watch on a phone and a TV, then schedule.

### What has to be built first (once)

| Piece | Work |
|---|---|
| The voice | See section 4. |
| App recorder | A DividendCase version of `record_screen.py`: starts the demo server, drives pages by cue, draws the pointer, types at human speed, zooms. Plus a small library of moves (open ⌘K, add a holding, pick a file) so scripts stay short. |
| Example files | Invented files for the import episodes: a holdings spreadsheet, a Zerodha tradebook, an Angel One holdings file, a Revolut statement. The test suite already builds invented broker documents (`tests/documents.py`); the video files come from the same builders. |
| Demo server options | A flag to start empty (for the first-run and import episodes) and to pick the tax residence. |
| The case in Blender | Model, materials, light rig, three animations: open (6 s), close (4 s), ident (4 s). Rendered once, reused everywhere. |
| Templates | Title card, lower third, chapter tag, key overlay, end card, thumbnail, all in the brand's type and colours. |
| Music and sound | One licensed track with stems, plus dial clicks and a door sound. |

### Where it lives

My call: a separate private repository, `dividendcase-youtube`, that uses the `yt` tool from the
PhysicStuff repo and runs this repo's demo server. Reasons: the public app repo stays free of media
and voice files, and video work doesn't show up in the app's history. The recorder's helper moves
that depend on the app's markup can still be tested against this repo. Say if you would rather have a
`youtube/` folder here.

## 4. The voice

The model on this Mac (Qwen3-TTS Base, through the `yt` tool) clones a voice from a reference clip;
today that clip is yours. A female voice needs a different reference, and it must not be a real
person's voice taken without permission.

**Plan:** design a voice that belongs to nobody. Qwen3-TTS has a VoiceDesign variant that makes a
voice from a written description. Use it once to speak a 60 second reference passage, then give that
clip to the Base model as the reference. Every episode then uses the pipeline exactly as it is, and
the voice stays the same for the whole series.

- Description to start from: "A woman in her thirties. Low to mid pitch, warm, unhurried. Neutral
  international English. Close microphone, quiet room. Curious and attentive, lifts slightly on
  questions, never excited, never selling."
- Make five candidates, each reading the same passage (a cold open, a line of numbers, a closing
  line). Pick by blind comparison, as you did for your own voice.
- Lexicon entries before the first script: DividendCase, ticker symbols as letters, "T T M",
  "D R I P" said as "drip", currencies ("pence", "rupees"), dates, percentages.
- To check first: that the VoiceDesign variant runs under mlx-audio on this Mac. If it doesn't, the
  fallbacks are a preset female speaker from the CustomVoice variant, or a person who records the
  passage for you and agrees in writing.
- Each description says "Narration is a synthetic voice."

## 5. The intro film: "Meet DividendCase" (5:00)

Five minutes is long for a reveal, so it is built in two acts that also work alone: the first 75
seconds is a complete trailer (channel trailer, Short, website), and the rest is the guided tour.

| Time | Scene | Picture | Voice and titles |
|---|---|---|---|
| 0:00 | Cold open | Black. A dial turns, one click per month. Twelve faint marks around it. | "When is your next dividend?" (click) "And the one after that?" |
| 0:15 | The mess | Manim: tickers, dates, six currencies and tax percentages drift like dust. A spreadsheet tries to hold them and frays. | "Nine companies. Six countries. Six currencies. Each one pays on its own day, in its own money, after its own tax." |
| 0:40 | The reveal | Blender: light finds the edge of the case. The dial settles. The door opens and green light spills out. Logo. | Silence, then: "This is DividendCase." |
| 0:55 | The promise | The Income page rises out of the case as a glass pane. The twelve month bars grow. | "Everything your holdings are expected to pay you. The next twelve months, in one place." Title: "Know what's coming." |
| 1:15 | Trailer ends here | Logo, "Free. Open source. On your computer." | (music resolves; the long cut continues) |
| 1:20 | Income | Real app footage on the pane, pushed in close: month bars, upcoming payments, "All in EUR". | "What does March look like? And who is paying?" Title: "Income." |
| 1:50 | Calendar | Payments drop into days as green points. | "Every expected payment, on the day it's due." Title: "Calendar." |
| 2:15 | After tax | Manim over footage: a payment leaves the company, the paying country takes its share, the rest lands. Toggle flips from before tax to after tax. | "And how much of it do you keep?" Title: "After tax." |
| 2:45 | Research | Three panes in space: screener, stock page, advanced chart. Camera drifts across them. | "Which companies have paid, year after year? Which beat their own index?" Title: "Research." |
| 3:15 | Compare | Two panes slide together, lines overlay. | "Side by side." |
| 3:30 | Getting in | A spreadsheet and three broker files fall into the open case; holdings appear. | "Bring your holdings from a spreadsheet, or from the files your broker gives you. Read on your computer. Never connected to your broker." Title: "Your files." |
| 3:55 | Privacy | Blender: the door closes on a single glowing file. Outside, nothing moves. | "No account. No cloud. One file, on your computer." Title: "One file. Yours." |
| 4:20 | Markets and open source | The website's dotted globe, six markets lit. Then source code scrolling, soft. | "Six markets. Free, and open source, so you can see exactly what it does." |
| 4:40 | Close | The dial, one last click. Logo, dividendcase.com, the Microsoft Store badge, "macOS and Linux too". | "DividendCase. Go and see what's coming." |

Notes:
- Blender carries about 45 seconds in total; the rest is app footage, Manim and titles. That keeps
  the render to a few nights.
- Every number in the film comes from the demo server and matches `film/example.ts` on the website.
- The spoken copy follows the website rules: "expected" and "estimate", no "+" on amounts.

## 6. The tutorials

Every tutorial has the same skeleton, so viewers learn the rhythm:

1. **Question** (10 s): the cold open, over the finished result.
2. **Ident** (4 s): the case opens, episode title.
3. **Three to five chapters**, each opening with a question, each with a YouTube chapter mark.
4. **Recap** (20 s): three things, as short titles.
5. **Next** (20 s): the case closes; end card with the next episode. Nothing else on screen.

| # | Title | Length | Chapters | Extra |
|---|---|---|---|---|
| 1 | Install DividendCase and add your first holding | 6:00 | Get it (Microsoft Store; macOS and Linux with uv) · First questions (tax residence, home currency, markets) · Add a holding and a purchase · Your first Income page · Where things are (sidebar, ⌘K) | Store install is the one hand-recorded shot, on Windows |
| 2 | Bring your holdings in from a spreadsheet, and take them out again | 7:00 | What the spreadsheet needs · Import and check · Choose or create a portfolio · Export to Excel · The Excel report | Manim: columns mapping to holdings |
| 3 | Import from Zerodha, Angel One and Revolut | 8:00 | Why files, not a connection · Zerodha tradebooks · Angel One holdings (password, confirming dates) · Revolut statements · When the numbers don't add up | Manim: sells matched to the earliest buys |
| 4 | Read your Income page | 6:00 | The next 12 months · Who pays, and how often · Holdings that don't pay · One currency or all in yours · How the estimate is made | Manim: past payments becoming an estimate |
| 5 | Your dividend calendar: what's due and when | 5:30 | Month view · A single payment · Quiet months and busy months · Before tax and after tax | |
| 6 | What you keep after tax | 8:00 | What withholding is · Your tax residence · Reading the after-tax view · Countries without an estimate · Setting your broker's actual rate | Manim: the payment's journey. Spoken once: estimates, not tax advice |
| 7 | Watchlists: keep an eye on a stock before you buy | 5:00 | Add from a stock page, the screener or ⌘K · What the watchlist shows · Import and export a list · From watchlist to holding | |
| 8 | Read a stock page | 7:00 | Ten years of payments · Yield, growth and streaks · The safety score and what goes into it · Price with ex-dividend dates · Stocks with no dividend history | |
| 9 | Find dividend payers with the screener | 7:00 | Choose markets · Filter by yield and frequency · "Beat their index" · Open a row's price chart · Send to watchlist or compare | |
| 10 | Compare stocks side by side | 5:30 | Pick two to four · What lines up and what doesn't · Different currencies · Share the comparison link | |
| 11 | Advanced charts: price, yield and dividends together | 9:00 | Chart types and ranges · Moving averages and Bollinger bands · Yield bands · RSI, MACD, drawdown · Dividends against price | Manim: what a yield band is |
| 12 | A research session, start to finish | 9:30 | A question to start from · Screener to shortlist · Stock pages · Compare · Charts · Watchlist · What a purchase would add to your income (DRIP calculator, calendar) | Capstone; links to 7 to 11. Spoken once: how to use the tools, not what to buy |

Later, when there is something to show: portfolios and the benchmark comparison, the DRIP calculator
alone, the Data page and backups, Docker on a NAS, and each new broker import as it ships.

Your list, and where each item landed: add to watchlist (7), compare (10), import from Excel and
export (2), how to use the app (1, 4), research (8, 9, 11, 12), schedule (5), taxation (6), general
features (the intro film and 1).

## 7. Publishing

- **Order:** the intro film first, with tutorials 1 and 2 on the same day so the channel isn't one
  video deep. Then one a week, in number order.
- **Playlists:** "Start here" (intro, 1, 2, 4), "Your income" (4, 5, 6), "Research" (7 to 12).
- **Titles:** the question or the task, plain. No capitals for effect, no "ultimate".
- **Thumbnails:** one template. Black, the app pane at an angle, two or three words in Geist, the
  green dot. The episode number is not on it.
- **Description:** one sentence, the chapters, install links (Store, website), the feedback address,
  "Example portfolio with invented figures. Not financial or tax advice. Narration is a synthetic
  voice."
- **Subtitles:** uploaded from the script's timings, not auto-generated.
- **Elsewhere:** the trailer cut on the website's hero and in the Store listing; each tutorial linked
  from the matching FAQ answer and from the app's About page; the README links the playlist.
- **Shorts** (optional, later): one 30 to 45 second vertical cut per tutorial, the single most
  useful move.

## 8. Order of work

| Step | What | Done when |
|---|---|---|
| 1 | Voice: check VoiceDesign runs, five candidates, blind pick, lexicon | A locked reference clip |
| 2 | Recorder, demo server options, example files | Tutorial 7 (the shortest) records end to end with no hand work |
| 3 | Templates, music, sound | Tutorial 7 assembles to a finished file |
| 4 | Pilot: finish tutorial 7, watch it, fix the format | You'd publish it as it is |
| 5 | The case in Blender: model, light, three animations | Ident and open/close rendered |
| 6 | Intro film | Trailer cut and long cut both finished |
| 7 | Tutorials 1 and 2 | Launch set ready |
| 8 | Launch, then one tutorial a week | |

The pilot comes before the intro on purpose: it proves the voice, recorder and assembly on the
cheapest video, so the expensive one is made with tools that already work. Nothing is published until
the intro is ready.

Rough effort: steps 1 to 4 about two weeks of evenings, the Blender work and intro about two more,
then each tutorial two to three evenings.

## 9. Still to decide

1. Separate private repository, or a `youtube/` folder in this one (section 3).
2. The voice, by ear (section 4).
3. The music track.
4. Whether tutorial 1 shows the Windows install recorded on a real PC, or the Store page only.
5. Publishing day and time.
