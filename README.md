# Hindsight

**What your agents did, after the fact.** Hindsight reads the runs of four apps and lays each one out on a timeline: what was understood, every call, every wait, every check, with the time each took.

It is a small version of an agent observer: one place to look when an agent did something and you want to know how.

- Live: https://hindsight-sand.vercel.app
- The apps it reads: [Sayso](https://github.com/f20230125-sudo/sayso), [Flowboard](https://github.com/f20230125-sudo/flowboard), [Agent Desk and the GitHub bot](https://github.com/f20230125-sudo/github-bot)

## How each app gets its runs here

| App | How | Where its runs come from before one is sent |
|---|---|---|
| GitHub bot | Read live from the file its scheduled job commits to GitHub | The recorded copy, if GitHub cannot be reached |
| Sayso | An **Open in Hindsight** button in its "How it worked" panel | 11 real runs, recorded by driving the app in a browser |
| Flowboard | An **Open in Hindsight** button in its Run panel | 5 real runs, recorded the same way |
| Agent Desk | An **Open in Hindsight** button on a run's page | 1 real audit from its backend, with GitHub answering for real |

Runs that were recorded say so in the list, so a recording is never taken for a run that just happened.

### Sending a run, with no server

The button opens Hindsight's `/open` page in a new tab. That page tells the tab that opened it that it is ready (a message with nothing in it). The app answers with the run, addressed to Hindsight's origin alone, so no other page can read it. Hindsight keeps it in the browser and opens it. If the tab is blocked, or says nothing for five seconds, the app saves the run as a file, which can be dropped on the Sources page.

Everything that arrives is checked, in `src/sources/receive.ts`:

- it must come from the app's own page (a fixed list of addresses), and a page may send only as its own app;
- it is read only from the tab that opened Hindsight's page, and anything else is ignored without a word;
- it must be under 2 MB, say it is in the `hindsight/run` format, version 1, and fit the shape that app is known to write, or it is refused with the reason, in plain words.

What each app sends is its own record of one run (Sayso: a turn with its plan, calls and a log of what happened and when; Flowboard: the blocks' names and kinds and the data that passed through them, never their settings, which can hold keys; Agent Desk: a run and its events). Adding an app means writing one adapter and adding its address to the list.

## What you can do

- **See every run of every app in one list**, newest first, with figures on top (how many, how many succeeded, the typical length, the slowest tenth). Filter by app, result and agent, or search. The filters live in the address, so any view is a link.
- **Open a run** to see it on a timeline. One bar per stretch of work, indented under the step that held it; things that happened at a moment are small marks. Blue is a model call, orange an API call, green waiting for a person, grey the app's own steps. Hover or focus a bar for its length; choose it for everything the app recorded.
- **See what is certain and what is not.** A bar drawn with stripes has times that were worked out from the log, not measured, and the panel says why.

## One format, one adapter per app

Each app keeps its runs its own way. An adapter in `src/sources` turns a run into one shape, a `Trace`, and nothing outside `src/sources` knows where a trace came from. The format is a Zod schema in `src/trace/schema.ts`; the types are worked out from it, and the same schema checks anything that arrives from outside (a run sent by an app, a file, a copy kept in the browser).

A trace is a list of spans. Each has a kind (`understand`, `plan`, `step`, `tool`, `model`, `wait`, `check`, `said`), a start and a length from the beginning of the run, a status, whether its times were `measured` or `estimated`, the line the person was shown (if any), and the data the app recorded.

### The GitHub bot's adapter

Agent Desk and the GitHub bot are one program (Patch and Pitch, two agents that run jobs and log an event for everything they do). `src/sources/agentdesk/adapt.ts`:

- Consecutive `run.step` events with the same step name become one **phase**, from the first of them to the start of the next.
- Each `tool.result` is a **call**, drawn inside the phase that was running when it was logged. A call is logged when it ends, with how long it took, so it began that long before its stamp.
- Findings, proposals, messages and errors are **marks** on that phase.

**What the real data showed.** In the scheduled job's runs, a call can be logged *after* the run it belongs to began: 48 of the 78 calls in the recorded runs began before their run's first event. Drawing them at their true length would put them before the start of the run, so the bar is cut at the start, marked as estimated, and the panel says how long the call really took and how much of it falls before the run was recorded. Nothing is stretched to make the picture tidy.

**Something it found.** Reading the bot's 54 runs side by side shows that 25 of its 78 GitHub requests were answered `403`. The cause is in the bot's own code (`list_repos` in `sync.py`): the token a scheduled GitHub Actions job is given cannot list a user's repositories through `/user/repos`, so the bot is refused and asks for the public list instead. It remembers a refusal only for the length of one process, and the job starts a new process for every run, so it asks, and is refused, on every scheduled audit. The bot treats that as normal and the run succeeds. Hindsight shows each refusal as a failed call inside a run that succeeded, which is what an observer is for.

## Run it

```
npm install
npm run dev        # http://localhost:3040
```

| Command | What it does |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | Next's route types, then `tsc` |
| `npm test` | Vitest: adapters, schema, filters, statistics, the store |
| `npm run build` then `CI=1 npm run e2e` | Playwright against the production build, with axe scans in both themes and at phone width |
| `node scripts/record-apps.mjs [sayso|flowboard]` | Drives the running apps in a browser, presses their button, and saves what they hand over to `src/samples` |
| `node scripts/record-github-bot.mjs` | Records the bot's runs from its public snapshot into `src/samples/github-bot.json` |
| `node scripts/look.mjs [path] [light\|dark] [width] [name]` | Opens a page in a real browser and saves a picture |

The server reads the bot's snapshot from `raw.githubusercontent.com`. If it cannot be reached, it answers with the copy recorded in `src/samples/github-bot.json` and says so on the page. The tests point the server at an address with nothing at it, so they always read the same 54 recorded runs and never touch the network.

## Decisions

- **The format is the contract.** Pages read traces, adapters write them, and an adapter is a plain function tested against real data copied from its app. Adding a fifth app means writing one adapter.
- **Colour means kind of time, and nothing else.** Three kinds of time are worth telling apart at a glance (model, API call, waiting for a person) and take the first three hues of a palette checked for colour-blind separation against both themes' surfaces. Everything else the app does is grey, because it is not an identity. Failures and estimates are not colours: a failed bar has a red underline and an icon, an estimated one has stripes.
- **No chart library.** React draws the timeline, so it follows the theme, works with the keyboard, and each bar is a real button. `d3-scale` is used only for the axis arithmetic.
- **Runs sent here stay in the browser.** Nothing is uploaded; the server has no database.
- **Nothing costs money.** No model, no key, no paid service.

## Limits

- The bot's snapshot lists its newest 100 runs, and Hindsight shows all of them.
- The recordings of Sayso and Flowboard were made against stand-ins for the outside services those apps call (the weather, a ticket system, a model provider), which answered after a delay, so recording needs no keys and no network. The apps, their journeys and the times are real; the replies they got are not.
- A run sent from an app lives in the browser it was sent to. A link to it works there and nowhere else.
- The timeline is plain: no zoom, no playback, and the keyboard reaches bars but not the marks on them yet (a list of a step's marks is in the panel).
