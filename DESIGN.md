# DESIGN.md: Hindsight

Status: Built and live. Direction picked by Claude under Uzair's blanket go-ahead of 2026-10-13; not yet reviewed by him. Known and kept: the by-day outcome colours, the plain /sources page, the 98-dot plot target size on /overview (see the audit notes in the commit message).
Pages covered: `/` (the runs), `/runs/[id]` (one run), `/overview`, `/sources`, `/open` (the hand-over page), the not-found and error pages.
Written 2026-10-13 by the design director. Scanner pictures and the mock-ups cited below are in the session scratch folder
`C:\Users\UZAIR\AppData\Local\Temp\claude\d--claude-workspace\dc3256bc-48b3-4c89-b760-cb9e543aa661\scratchpad\hindsight\`
(`hs-*.png` are the live site; `mock\*.png` are static sketches of this plan, not a build; `fonts\*.png` are the type specimens).

## 0. Decisions that are Uzair's (nothing here is final until he says so)

1. **Family or distinct?** Not yet answered by him. Recommendation applied: **a thin shared layer plus a distinct identity.**
   Shared (see `C:\Users\UZAIR\.claude\design-kit\family-layer.md`): light and dark following the system with a header toggle and no flash
   (`data-theme`), the accessibility baseline, the honest tone, the security headers and `frame-ancestors`, the skip link, one `h1`, titles, descriptions and an
   `og:image`. Not shared: typeface, accent, radius, first screen, label style, motion, logo.
2. **No chromatic accent for Hindsight.** The chrome is ink on paper; colour appears only where it is data. This follows the README's own rule ("Colour means kind
   of time, and nothing else"). It also matters for the other three tools: Hindsight's validated data hues (red 0, orange 17, amber 26-41, green 120 and 158, blue 213)
   plus the banned indigo band (235-290) leave only two clean accent windows for the siblings, about 65-98 and 292-338 (20-degree margin, my guess at what
   "mistaken for" means). Three siblings cannot all sit 40 degrees apart in two windows, so Uzair will have to relax something for one of them. Fallback if he wants a coloured
   accent here anyway: hue 320, used only for the focus ring and the playhead. I recommend against it.
3. **The headline figures become a sentence, not five tiles** (`/` and `/runs/[id]`). The numbers are the same and still computed; a few tests that look for tiles change with it (section 12).
4. **Nothing about how he is described changes.** The site says nothing about Uzair beyond "all mine" in the README; none is added.
5. **No claim changes.** Every sentence on the page keeps its source. Section 7 lists what must stay true.

## 1. What it is

Hindsight reads the runs of Sayso, Flowboard, Agent Desk and the GitHub bot and lays each one out on a timeline: what was understood, each call, each wait, each check,
with the time each took. A visitor can open a run of an agent and see where its time went, and tell the app's own work from a person's waiting, which a log file does not show.

## 2. Who opens it, and what they do in the first 30 seconds

An engineer sent the link (from Uzair's portfolio, where Hindsight opens in a window, or from the README's GIF) with a couple of minutes to spare. Within 30 seconds they must:
see that these are real runs of real apps (and which are recordings, which are live), see a run as a shape without clicking, open one and tell a call from a wait by colour, and notice that
a run can succeed with a failed call inside it. The first screen therefore shows runs drawn as strips, not a description of runs.
It must also work in a narrow window (Portfolio OS frames it) and on a phone.

## 3. Source material

1. **The timeline's own drawing grammar**: rounded bars on hairline-ruled rows, diamond marks for moments, count badges for crowds, stripes for "worked out from the log", a red underline for failed,
   a hatched band with dashed edges and the real length where a wait was squeezed. `src/components/timeline/Timeline.tsx`, `Legend.tsx`, `src/app/globals.css` (`.hatched`, `.break-band`);
   pictures `hs-run-desktop-light.png`, `docs/screenshots/run-agent-time.png`.
2. **The Shape strip** in the run list: a whole run in one line, calls and waits over grey own steps. `src/components/run/MiniTimeline.tsx`, the "Shape" column in `hs-home-desktop-light.png`.
   Today it is 170 px wide, hidden below 1024 px, and sits last in the row. It is the product's most distinctive object.
3. **The number grammar**: `+3.77 s` offsets, `formatMs` ("under 1 ms", "218 ms", "2.03 s", "1 min 12 s"), tabular figures everywhere, and zero shown as a real "0" ("0 model calls", "+0 ms"). `src/trace/format.ts`, `.tabular` in `globals.css`.
4. **The Trace format and its vocabulary**: span kinds `understand, plan, step, tool, model, wait, check, said`; statuses; `measured` vs `estimated`; the `hindsight/run` envelope shown as code on `/sources`;
   verbatim names such as `GET /user/repos`, `github-bot:audit-527d1c0763`. `src/trace/schema.ts`, `src/components/sources/SourcesView.tsx`.
5. **The README's findings and its voice**: a call "logged after its run began" is cut at the start, striped, and the panel says how long it really took ("Nothing is stretched to make the picture tidy");
   "Hindsight shows each refusal as a failed call inside a run that succeeded, which is what an observer is for"; "a wait for a person is not the app being slow". `README.md`, "What the real data showed" and "Decisions".
6. **The way a run reaches Hindsight**: app, button, `/open`, message, checks, adapter, store, pages. `docs/architecture.svg`. (The existing og image, `src/app/opengraph-image.png`, is already the agent-time view with its break bands: the
   product's best picture.)

The category (trace viewers such as Langfuse, `references/good/langfuse.png`) supplies the conventions to borrow (a time ruler, rows with labels, a detail panel) and the look to avoid: dark chrome with a brand-blue accent.

## 4. The idea

**Directions considered**

- **A. "The strip" (picked).** From sources 1 to 3. Everything that took time is drawn as a length on one ruled sheet; the page around it is ink on paper, so the only colours are the kinds of time.
  Palette: blue-black ink on grey paper, no accent. Type: a narrow-capable grotesque with slashed zeros. First screen: the run list with each run's strip as the widest thing in its row.
- **B. "The findings sheet".** From source 5. A first screen of three plain sentences about what the recorded runs show (a succeeded run holding a refused call; 92% of Sayso time was the traveller deciding), each beside its evidence strip.
  Rejected: it needs new computed claims and new logic, the README's numbers belong to the 7 Oct recordings and would go stale against live data, and a hand-written first screen is the stock "lead with a claim" page that a product this size cannot keep true.
  Kept from it: a failed call inside a succeeded run is shown in the list in red.
- **C. "The cutting room".** From the Player, the playhead and agent time as a jump cut (waits trimmed, the cut marked with its real length). A dark track-and-clip bench.
  Rejected: editing-software cosplay, dark-first with a signal colour (second-wave cluster 2), and it has no answer for `/`, `/overview` or `/sources`, which are not editing.

**The idea, in one sentence.** Hindsight draws everything that took time as a length on a ruled sheet and keeps the rest of the page in ink, so that colour only ever means a kind of time.

Everything below follows from it: durations are the biggest thing on a page; chrome has no hue; boxes surround drawings, not words; numbers are set in one grammar.

## 5. Token plan

### Colour

Surfaces for data are unchanged from the validated palette (`#ffffff` light, `#14171c` dark): the data colours were checked against exactly these.

| Token | Light | Dark | Role | Used for / never used for |
|---|---|---|---|---|
| `desk` | `#e9ebef` | `#0d0f13` | the page behind everything, the header | words sit here. Never behind a bar. |
| `paper` | `#ffffff` | `#14171c` | the sheet: anything drawn on a clock, data tables, tooltips, inputs | the only ground data colours sit on. Never a box around a paragraph. |
| `paper-2` | `#f2f4f6` | `#1b1f26` | row hover, the groove under a strip, selected row, inset | not a third card level |
| `ink` | `#141925` | `#e9ecf2` | text, links (underlined), focus ring, selected-control fill, playhead, moment marks, dots in the spread chart | the only "accent". Blue-black on purpose: ledgers are kept in it. |
| `ink-2` / `ink-3` | `#424c5c` / `#566071` | `#b3bbc7` / `#8f98a6` | secondary text / axis ticks, meta, group labels, placeholder | `ink-3` only at 11 px and up, on `desk`, `paper` and `paper-2` |
| `rule` / `edge` | `#d3d8df` / `#7f8896` | `#262b34` / `#6b7482` | hairlines and the sheet border / the border of a control that must be found (search, segmented groups) | `edge` meets 3:1 on both grounds; `rule` is decoration only |
| `fail` | `#c81e1e` | `#ff7b7b` | failure and nothing else: bar underline, icon, "1 failure" text | not for errors in general styling, not for emphasis. Stopped keeps `#b45309` / `#f5b942` on its icon only. |
| kinds of time (unchanged) | model `#2a78d6`, call `#eb6834`, wait `#1baf7a`, own `#8a929e` | `#3987e5`, `#d95926`, `#199e70`, `#6b7480` | bars, strips, legend swatches, the logo, the slowest-steps bars | never for chrome, state or decoration |
| outcomes (unchanged, fixed) | good `#0ca30c`, warning `#fab219`, critical `#d03b3b` | same | the by-day columns only, always with icon and word | |

Mapping from today's CSS variables (keep Tailwind class names only where the pattern is unchanged): `--bg`=desk, `--surface`=paper, `--surface-2`=paper-2, `--line`=rule, `--line-strong`=edge,
`--fg`=ink, `--muted`=ink-2, `--faint`=ink-3, `--accent`=ink, `--accent-fg`=paper, `--series`=ink, `--ok` is retired from chrome (a succeeded run shows an ink check mark and the word; green is left to "waiting"),
`--accent-soft` is retired (a selected control is filled with ink, not washed). Update `viewport.themeColor` in `layout.tsx` to the new desk values.

**Contrast, computed** (`scratchpad\hindsight\contrast.mjs`, WCAG 2.x):

| Pair | Light | Dark | Needs |
|---|---|---|---|
| ink on desk / paper / paper-2 | 14.72 / 17.57 / 15.93 | 16.21 / 15.18 / 13.97 | 4.5 |
| ink-2 on desk / paper / paper-2 | 7.27 / 8.68 / 7.87 | 9.91 / 9.28 / 8.54 | 4.5 |
| ink-3 on desk / paper / paper-2 | 5.32 / 6.35 / 5.76 | 6.59 / 6.17 / 5.67 | 4.5 |
| text on a selected control (paper on ink) | 17.57 | 15.18 | 4.5 |
| fail on paper (text) | 5.74 | 7.16 | 4.5 |
| fail on desk (icon) | 4.81 | 7.65 | 3 |
| stopped icon on paper | 5.02 | 10.18 | 3 |
| edge on paper / desk (control border) | 3.58 / 3.00 | 3.80 / 4.06 | 3 |
| focus ring (ink) on desk / paper | 14.72 / 17.57 | 16.21 / 15.18 | 3 |
| data bars on paper: model / call / wait / own | 4.42 / 3.20 / **2.82** / 3.14 | 4.94 / 4.63 / 5.27 / 3.79 | 3 |

One pair fails and is not mine to change: the light-theme **wait green `#1baf7a` on white is 2.82:1**, under the 3:1 WCAG asks of a graphic. Every wait also has its hourglass icon, its row label and a legend word, so colour is not the only signal,
but Uzair should know. A darker green in the light theme would have to be re-validated against the colour-blind check the README describes. `edge` on desk in light is exactly 3.00 (borderline: keep search and segmented groups on `paper`).

### Type

| Role | Family | Weights | Sizes | Why | Loaded via |
|---|---|---|---|---|---|
| Display and body | **Mozilla Headline** (variable, axes `wght` 200-700, `wdth` 75-125) | 700 titles; 600 figures; 500 controls; 400 body; 200 the run's length | H1 26 phone / 34 desktop, line 1.08, tracking -0.012em, `wdth` 92. Section title 18. Body and rows 14. Dek 15.5. Secondary 12.5. Axis ticks 11. Run length 40 phone / 64 desktop, weight 200, unit 0.4em in `ink-2`. | Zeros are slashed by default, so `0` is never `O` on a page of durations and ids. Numerals are tabular with `font-variant-numeric: tabular-nums`. A width axis gives a narrower cut for the 14rem label gutter, where API paths like `GET /users/f20230125-sudo/repos` otherwise wrap. 200 against 700 is the weight extreme. Tested in a specimen (`fonts\spec2.png`). | `next/font/google`, `axes: ["wdth"]` |
| Gutter labels | Mozilla Headline at `wdth` 85 | 450 | 13 | row names in the timeline and overview rows | same file, `font-stretch: 85%` |
| Verbatim | **Atkinson Hyperlegible Mono** (variable `wght` 200-800) | 400; numbers 600 | 12.5 | only for text that is data: the JSON tree, the run-file `pre`, `kbd`, ids. Built so that 0/O and 1/l/I differ. Never for labels. | `next/font/google`, `preload: false` |

Licences: Mozilla Headline OFL 1.1 (Mozilla Headline Project Authors, designer Studio DRAMA; `ofl/mozillaheadline/OFL.txt` in google/fonts, checked 2026-10-13); Atkinson Hyperlegible Mono OFL 1.1 (checked the same way).
Both are in this project's `font-data.json`: Mozilla Headline axes `wdth:75-125 wght:200-700`, subsets `latin` and `latin-ext`; Atkinson Hyperlegible Mono `wght:200-800`. Latin files served by Google are about 46 KB and 18 KB (Geist plus Geist Mono today: 52 KB).

```ts
const headline = Mozilla_Headline({ variable: "--font-headline", subsets: ["latin"], axes: ["wdth"] });
const verbatim = Atkinson_Hyperlegible_Mono({ variable: "--font-verbatim", subsets: ["latin"], preload: false });
```

No tracked all-caps, no small mono labels. Group labels ("App", "Result") are plain 500-weight `ink-3` text. Headings use sentence case. GUESS to verify at build: that the generated `@font-face` keeps a `font-stretch: 75% 125%` range (Google's CSS does),
and that `adjustFontFallback` only prints a warning if no fallback metrics exist for this new family.

### Shape and depth

- Radius by role: bars, swatches, strips and mark squares **3 px**; controls (button, input, segmented outer) **6 px**, segmented inner 4 px; the sheet **8 px**. No pill shapes, except the round count badge on a crowd of marks (it is a different mark from a diamond on purpose).
- Elevation: three steps only. Desk (flat). Paper (1 px `rule` border, no shadow). Tooltip and toast (the one shadow, `0 6px 16px` at 14% ink). No blur anywhere: the header is opaque `desk` with a 1 px `rule` under it.
- Borders over shadows. A box is allowed only around a drawing or a data table. The dek, the figures sentence, origin lines, filters and the sources text sit on the desk.
- Selected state is ink fill with paper text (segmented groups, filter options, Play). Hover is `paper-2`. Focus is a 2 px ink outline with 2 px offset, everywhere, including on ink-filled controls.

### Space

4 px base. Inside a group 4-8; between rows 12-16; between blocks 24-32; between a page's header and its content 40; between plates 40-56. Content column max 1280 as today.
The label gutter is **14rem** on every page that has tracks (timeline, overview rows, sources rows), so bars start at the same x within a page. Phone: gutter on top of the track, as the timeline already does.
Rows in a drawn list are at least 44 px high on a phone and 40 on desktop; the visible bar is 16 px with an invisible hit area of 28 px (bars are 14 px today and fail the 24 px target size).

### Motion

**The one moment: a run draws itself once.** When a run page opens, each bar reveals from its own left edge, in the order it happened: 360 ms ease-out per bar, delay proportional to its start (whole run in at most 700 ms).
Use `clip-path: inset(0 100% 0 0)` to `inset(0)` so layout and tab order do not change. Only on first mount of a run, not on zoom, pan or mode change.
State transitions: switching Real time to Agent time moves bars with `left` and `width` over 250 ms ease-out; tooltips and hovers 150 ms; nothing else animates. No count-up, no fade-up on scroll.
Reduced motion: `animation: none` on the draw-in (the existing global rule shortens durations but does **not** shorten delays, so a delayed bar would stay hidden up to 700 ms; set `animation: none` explicitly) and no transitions on bars.

## 6. Layout concept

Skeleton on every page: **label gutter, then track.** Words and metadata hang in the gutter, drawings in the track. One idea per page:

- `/`: the runs as a ledger of strips; the strip column is the widest thing in the row.
- `/runs/[id]`: the run's length as the largest numeral, then the sheet with the timeline immediately under it; figures live in a ledger beside it.
- `/overview`: four plates, each a drawing with its table one toggle away; the filters are the same block as on `/`.
- `/sources`: four ruled rows, app in the gutter, how it is connected in the track; then the drop zone and the format.

### `/` desktop 1440

```
+--------------------------------------------------------------------------------------------+
| ▬▬ Hindsight   Runs  Overview  Sources                                                  (o)|  56 px, desk, 1 px rule
|                                                                                            |
| What your agents did, after the fact                       (34/700, left, max 64ch)        |
| Every run of the apps Hindsight reads, in one list. Open one to see it on a timeline: ...  |
| 98 runs. 95% of the 97 that finished succeeded. The middle run took 560 ms; nine in ten    |  15.5, numbers 600, nowrap units
| were faster than 3.46 s. 1 used a model.                                                    |
| GitHub bot            Sayso                 Flowboard             Agent Desk               |  4 columns, 2 lines each
| 81 runs, read live    11 recorded runs      5 recorded runs       1 recorded run           |
| App     Sayso 11   Flowboard 5   Agent Desk 1   GitHub bot 81                              |  label | options, no pills
| Result  [Succeeded 92]  Failed 3  Stopped 2  Waiting 1                                     |
| Agent   patch 75   pitch 7                                      [ Search by title, ...  ] |
| +----------------------------------------------------------------------------------------+ |  paper, 8 px, 1 px rule
| | Run                        Result      Started   Shape (each run to its own length) Took | |
| | Read Patch's notes  pitch  ✓ Succeeded 1 day ago ▬▬──────────────────────────────  2 ms | |
| | Audit repositories  patch  ✓ Succeeded 1 day ago ▒▒███████████████████████████████ 1.17 s| |
| |   Audit done. 3 GitHub requests, 0   1 failure   (red)                                   | |
| | a window seat on my London flight  recorded  ... ▬███████████ █ ██████████ █   5.92 s    | |
```
First row at about y 500 (today 630). Strip column about 540 px, 22 px tall, bars 16 px, the same drawing as the timeline (grey own steps under, kinds over, stripes on estimated, red underline on failed).
Unequal on purpose: the strip is wider than the title column. Columns `Result` and `Started` are `ink-2` and quiet.

### `/` phone 390

```
+------------------------------+
| ▬▬ Hindsight Runs Overview … (o)|  56
| What your agents did,        |  26/700
| after the fact               |
| Every run of the apps ...    |
| 98 runs. 95% of the 97 ...   |
| GitHub bot     Sayso        |  2 x 2 origins
| App    Sayso 11  Flowboard 5 → |  one scrolling line per group, 44 px
| Result Succeeded 92  Failed … →|
| [ Search ................ ]  |
| +--------------------------+ |
| | Audit repositories patch | |
| | ✓ Succeeded, 1 day ago   | |
| | 1 failure           1.17 s| |
| | ▒▒███████████████████████| |  strip full width under the title, 22 px
```

### `/runs/[id]` desktop 1440

```
| ← All runs                                                                                 |
| Audit repositories                                                              1.17 s    |  34/700 left; 64/200 right, aligned to the track's right edge
| GitHub bot, patch. Succeeded, with one failed call. Started 12 Oct, 02:04; read live ...   |  one plain sentence, ink-2
| +-----------------------------------------------------------+  +------------------------+  |
| | Timeline                                16 spans recorded |  | Calls            3     |  |  figures ledger (dl), 22/600 numbers
| | ▬ Model calls  ▬ API calls  ▬ Waiting for a person  ▬ Own steps|  | Model calls      0     |  |  the key, no counts
| | ▨ Worked out from the log   ▭ Failed   ◆ At a moment      |  | Failed           1     |  |
| | [Real time|Agent time]  zoom ‹ › ⤢          [Timeline|Table]|  | Calls avoided    1     |  |
| | 0      200 ms     400 ms     600 ms     800 ms     1 s    |  +------------------------+  |
| | ▾ sync            1.13 s ┃▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒   |  | Detail | At this moment |  |
| |    GET /user/repos 19 ms ┃▌ (striped, red underline)       |  | Select a bar or a mark |  |
```
The run's length is the one thing larger than everything else. The ruler has major ticks with labels and minor ticks (4 px) between them, drawn from the scale the axis already computes. The timeline starts by y 260 so ten rows show on 1440 x 900.
The sheet and the right column are siblings in a grid; the figures `section` and the detail `aside` stack in the right column and the pair is sticky.

### `/runs/[id]` phone 390

```
| ← All runs                   |  44 px target
| Audit repositories           |  26/700
| 1.17 s                       |  40/200
| GitHub bot, patch. ...       |
| +--------------------------+ |
| | Timeline    16 spans     | |
| | legend (wraps, 12.5)     | |
| | [Real|Agent]  [Timeline|Table] |  44 px
| | row label                | |  label above its track, 44 px rows
| | ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ | |
| Figures (dl) after the sheet |
```

### `/overview` desktop 1440

```
| Where the time went, across every run                                                      |
| dek (1 line)                                                                               |
| App / Result / Agent filter rows (same block as `/`)       Adding up all 98 runs.          |
| +----------------------------------------------------------------------------------------+ |
| | Where the time goes                                                       [Chart|Table] | |
| | GitHub bot  81 runs, 1 min 29 s | ████████████████████████████████████████████▌▌ API calls 97% ...  |
| | Sayso       11 runs, 40.0 s     | ▇▇ ▇▇ ███████████████████████████████████████▌    Waiting 92% ... |
| +--------------------------------------+ +-----------------------------------------------+ |
| | Runs by day                          | | How long runs take                            | |
| +----------------------------------------------------------------------------------------+ |
| | The slowest steps   bars coloured by their kind of time (API call orange, model blue)   | |
```
Rows use the 14rem gutter in all four plates that have rows, so the starts line up. Changes to meaning: the spread chart's dots and the slowest-steps bars stop using the indigo `--series`; dots are ink
(filled succeeded, ring waiting, red diamond failed, amber square stopped, as today) and each slowest-step bar takes the fill of its slowest span's kind (`CATEGORY_FILL[CATEGORY_OF[kind]]`), the same rule as the timeline.

### `/sources` desktop 1440

```
| How each app is connected                                                                  |
| dek                                                                                        |
| Sayso        11 runs        | A service desk for a made-up airline. ...                    |  rule between rows, no cards
| (icon)                      | How  Ask for something, open "How it worked", press Open in Hindsight. |
|                             | Open Sayso   Source code                                      |
| Flowboard / Agent Desk / GitHub bot ... same                                                |
| Drop a run file   [ dashed 6 px zone ]        Runs sent to this browser   ...  What an app sends  (pre, verbatim face)
```
Optional second step, not required for the first build: redraw `docs/architecture.svg` in page tokens as the first element of `/sources` (it is the real artefact of that page; its text and claims are the README's).

## 7. Voice

Dry observer: says what happened, how long it took, and what it does not know.

1. Say what happened and how long; every duration in the `formatMs` grammar, units never split across a line (`white-space: nowrap` on number plus unit).
2. Name the app and the person ("the traveller", "the GitHub bot"). Say "recorded" or "read live" wherever a run appears.
3. State limits in the sentence where they bite: "Tokens not reported", "Not reported by this app". Never suggest cost or confidence scores exist.
4. No product-marketing words (insights, powerful, intelligent, seamless, observability platform). No exclamation marks, no emoji. Prefer "run" and "timeline" to "trace" in headings.
5. A control says what it does: "Play", "Show 25 more", "Try again", "Zoom to the chosen one". No "Learn more".

Sample lines (existing copy kept where it is already right):
- Headline: "What your agents did, after the fact" (kept; tests pin it).
- Figures sentence (new, computed): "98 runs. 95% of the 97 that finished succeeded. The middle run took 560 ms; nine in ten were faster than 3.46 s. 1 used a model." (values are the live ones on 2026-10-13; when filters are on, add "of 98 in all".)
- Run sentence (new): "GitHub bot, patch. Succeeded, with one failed call. Started 12 Oct, 02:04; read live from the GitHub bot, 10 min ago."
- Primary button: "Play" / "Pause" / "Play again".
- Empty: "No run matches these filters. Try fewer filters, or clear them to see every run." (kept)
- Error: "The GitHub bot's runs could not be read: <reason>" with "Try again" (kept)
- Tooltip, three lines: "158 ms", "POST /api/quotes", "API call, done, +3.77 s" (today the third line uses middle dots; no test pins the tooltip text, so commas are free)

Facts that must stay true, with sources:
- Four apps: Sayso, Flowboard, Agent Desk, GitHub bot (`src/trace/schema.ts` `SOURCES`; README).
- Colour means kind of time: blue model call, orange API call, green waiting for a person, grey the app's own steps; failed is a red underline and an icon; estimated is stripes (README "Decisions"; `src/timeline/look.ts`).
- Runs of Sayso, Flowboard and Agent Desk are recordings until one is sent; the GitHub bot is read live, or from a recorded copy that the page says so about (README table; `RunsView.tsx` note).
- Agent time squeezes waits for a person only (README "Limits"). Nothing is uploaded; sent runs stay in the browser (README "Decisions").
- Every number on a page (98, 95%, 560 ms, 3.46 s, 1) is computed from the loaded runs by `src/stats/summary.ts`. None is typed into copy. README figures (78 calls, 25 refused with 403, 92%) describe the recordings of 7 Oct and appear on the site only if computed or dated.
- No cost in money and no confidence scores are shown or implied (README "Limits").

## 8. Principles that set it apart

1. **Chrome has no hue.** Pick any pixel that is not a bar, a swatch, the logo, a by-day column or a failure mark: it is grey or blue-black ink.
2. **Durations are the largest or widest thing.** At 1440 the strip column is at least 40% of a row's width; on a run page the length is the biggest numeral.
3. **Boxes hold drawings and data tables, never words.** No box contains only a paragraph, a sentence, filters or sources text.
4. **Tracks start on one line.** Within a page, bars and strips of different rows start at the same x (the 14rem gutter), and the ruler's zero sits above that line.
5. **Numbers keep one grammar.** Tabular, unit lighter than number, `+` for offsets, a slashed zero, never wrapped between number and unit.

## 9. Second pass: defaults I removed

| First idea | Why it was a default (tell, wave) | Revised to |
|---|---|---|
| One chromatic chrome accent (hue 320) for focus, selection, playhead | "one accent for everything interactive" is the stock palette; any hue competes with three data hues; magenta may read blue to protan viewers and collide with model (GUESS, not tested) | no accent: ink fill for selection, ink focus ring, ink playhead (first wave, accent tell) |
| Left rail with figures and filters (Linear / Langfuse app shell) | stock sidebar layout; the overview shares the filter block and its charts need the width | label-and-options rows above the sheet; figures become a sentence (second wave 4, SaaS card kit) |
| IBM Plex Sans as the face (engineering heritage) | tested: plain zero, nothing of its own, and a common "tech" choice | Mozilla Headline: slashed zero by default and a width axis for the gutter, from the specimen |
| Hairline-ruled rows with zero radius everywhere | broadsheet cosplay (second wave 3) | 3 / 6 / 8 px radii; hairlines only inside a sheet; desk-to-paper tone step does the grouping |
| "T+00:03" mission-clock headings and a ticking header clock | template chrome and flight-recorder skeuomorphism; nothing in the repo is a clock | plain ruler ticks drawn from the existing scale; `+3.77 s` kept where the product already writes it |
| Mono for the agent tag, ids and group labels | "mono for vibes" (second wave 5) | tags and labels in the sans; mono only for verbatim data |
| Headline weight 800 | the chosen face stops at 700 | 700 against 200 for the run's length, which is a larger jump |
| A `Duration` component splitting number and unit everywhere | breaks aria-labels and the tests that read "5.67 s" | only in the run header, list "Took" column and overview row totals; other places stay plain strings with `nowrap` |
| Recoloured JSON tree (green strings, amber booleans, indigo numbers) | colour as decoration, and green collides with "waiting" | ink, quotes kept, numbers at weight 600, null and booleans in `ink-3` |
| Backdrop-blurred sticky header | glassmorphism tell | opaque `desk` with a 1 px rule |

"Have I seen this exact thing?" Checked against: Chrome's network waterfall column (a bar column in a table, but dark chrome with brand-blue), Langfuse and Linear (`references/good/langfuse.png`, `linear.png`: dark or accent-coloured shells),
and the baseline siblings (`references/baseline-2026-10-13/sayso-desktop-light.png`, `flowboard-desktop-light.png`, `footnote-desktop-light.png`, `agentdesk-desktop-light.png`). None combines ink-only chrome, a label-gutter skeleton shared by every page,
strips as the list's main column and agent-time break bands. The mock-ups (`mock\home-light.png`, `home-dark.png`, `run-light.png`, `run-dark.png`) were looked at in both themes before this was written: the strips carry the first screen; the plain parts read as chosen, not default, because of the face and the 64 px / 200 length.

## 10. Anti-list for this product

- No chromatic accent, indigo or violet anywhere in chrome. No gradient, glow, blur or glass. No emoji.
- No metric tiles and no row of equal stat boxes. Figures are a sentence or a ledger.
- No pill chips, no coloured status dots, no tracked all-caps eyebrows, no small mono labels, no `A · B · C` meta strings, no numbered markers.
- No box around words. No card inside a card. No shadow except on tooltips and toasts.
- Colour never decorates: red only for failure; blue, orange, green, grey only for kinds of time; outcome colours only in the by-day chart with an icon and a word.
- No hero, screenshot, video, logo wall or marketing section. The first screen is the list of real runs.
- No invented numbers, customers, quotes or dates; no "trusted by".
- No count-up, no fade-up on scroll, no bounce. One draw-in, then calm.
- No arrow on every link: "All runs" keeps its arrow because it points back; external links keep the external-link icon.

## 11. Sibling check

No sibling `DESIGN.md` existed on 2026-10-13: Hindsight is first and sets the pace. What it claims (also written in the table in `family-layer.md`):

| Axis | Hindsight (this plan) | Was | Left free for Sayso, Footnote, Flowboard |
|---|---|---|---|
| Primary typeface | Mozilla Headline; Atkinson Hyperlegible Mono for verbatim | Geist, Geist Mono | do not use Mozilla Headline/Text or Atkinson; Agent Desk already holds Mona Sans, Hubot Sans, Martian Mono; Geist, Inter, Roboto, Space Grotesk stay out |
| Accent hue | none (blue-black ink, hue about 222, low chroma). Data hues in use: 0, 17, 26-41, 120, 158, 213 | indigo 240 | clean windows about 65-98 and 292-338 (see section 0.2) |
| Card radius | 3 bars / 6 controls / 8 sheet | 18 | avoid 3 / 6 / 8 together |
| Label style | plain 500-weight sans, sentence case; no mono, no caps | tracked caps mono | any, but not this |
| Layout skeleton | label gutter + track on every page; sheet only around drawings | centred cards, stat row, pills | not a gutter-and-track skeleton |
| One motion moment | a run draws itself once | none | something else |

One collision to know about: Agent Desk's accent is green hue 142 (`family-layer.md`; `#157f3c` in its CSS), which sits between Hindsight's two data greens (120 for a succeeded day, 158 for waiting for a person). Inside Hindsight nothing changes, but side by side in Portfolio OS Agent Desk's green could be read as "waiting". Moving Agent Desk's accent is Uzair's call and is outside this file; this is the cost of the data palette taking three hues.

Shared on purpose (the thin layer): theme mechanism and toggle position (right end of the header), accessibility baseline, skip link and landmarks, honest-copy tone, spacing rhythm on a 4 px base,
the "Open in Hindsight" sender in the other apps and the `/open` receiver here, the security headers. Hindsight's logo (three offset bars in the data colours) and its data palette are its own.

## 12. Constraints from the repo

- **CSP** (`next.config.ts`): `default-src 'self'`, `font-src 'self'`, `img-src 'self' data: blob:`. Fonts only through `next/font` (self-hosted at build); no `<link>` or `@import` to a font host; no external images. Do not touch the headers, `frame-ancestors 'self' https://uzair-khan-lac.vercel.app`, or the receiving code in `src/sources/receive.ts` and `/open`.
- **Tests**: 289 unit (logic only; none render components) and 98 e2e, both themes and phone width under axe. Copy and structure the e2e tests pin, which change only with the tests:
  `runs.spec.ts` the region named "Figures for the runs shown" containing the text `71` (exact) and "Used a model", and "Figures for this run" containing "Calls4", "Failed1", "Calls avoided13" (label then value adjacent, no separator text between them);
  filter buttons named `/^Sayso 11$/`, `/^pitch 4$/` with `aria-pressed`; "Clear filters"; "Try again"; the table named "Runs, newest first" with 26 rows after the header; the text "recorded" as its own element;
  `overview.spec.ts` the chart names and "No runs to add up."; `runs.spec.ts:133` and `open.spec.ts:74` the dot in "API call · Failed" and "Model call · Done" (leave that inspector line as it is);
  the `aside` named "Detail and moment", the timeline list named "What happened, in order" and the bar names ("POST /graphql. API call, done. Starts +635 ms"). If the figures sentence replaces the five tiles, the `71` and "Used a model" assertions must be rewritten to look for the sentence.
- **Accessibility**: axe clean in both themes; focus ring on every control; targets at least 24 px (primary 44 on a phone). The baseline scan listed 26 of 42 phone targets under 24 px (`hs-home.txt`), mostly 20-23 px links (logo, "All runs", run titles) and 14 px timeline bars; run-row titles are full-row links through `::after`, so those are false alarms, the rest are real.
- **Data colours** (`--viz-*`): values unchanged. Do not retouch them without re-running the colour-blind validation the README refers to.
- **Files that carry the old look and need regenerating**: `src/app/icon.svg` (indigo square with a chat bubble, matches nothing; replace with the three-bar mark on an ink square), `src/app/opengraph-image.png` (shows the indigo Play button; retake from the built site, the agent-time view of the Sayso run), `docs/screenshots/*.png` and `docs/demo.gif` (`npm run screenshots`, `npm run gif`), `docs/architecture.svg` (hard-coded `#4f4fd1`).
- **Playwright**: the draw-in should not slow clicks. Either set `reducedMotion: "reduce"` under `use` in `playwright.config.ts` (no test changes) or keep the whole draw-in under 700 ms and test with it on.
- **Dev**: port 3040; pictures with `node scripts/look.mjs [path] [light|dark] [width] [name]`.
- **Build order**: tokens and fonts; header, filters and the list with strips; the run header, ledger and ruler; overview recolour; sources; icon, og image, README pictures.
- Framed by Portfolio OS: check 720-900 px wide windows, not only 1440 and 390.

## 13. Acceptance

- Scanner on `/`, `/runs/...`, `/overview`, `/sources`: at most 1 pattern or each remaining hit explained. Expected: `indigo-accent`, `generic-font`, `stat-tiles`, `eyebrow-chrome`, `mono-for-vibes` and pill chips gone (baseline 8 signals, TERMINAL, on `/`; 6, SLOPPY, on a run page).
  Expect the scanner to report a "dominant accent" in blue, orange or green: those are the data colours, by design.
- Pictures checked: 1440 light and dark for `/`, a run with waits (Sayso) and a run with a failure (GitHub bot), `/overview`, `/sources`; 390 light for `/` and a run; 800 px light for a run.
- Contrast ratios in section 5 hold in the built CSS (re-run `contrast.mjs` with the final hex values).
- No fact, number or claim added that is not sourced (section 7); every figure on screen is computed.
- Lint, typecheck, unit tests, build and e2e (`npm run build`, then `CI=1 npx playwright test`) pass; any changed assertion is listed with the reason.
