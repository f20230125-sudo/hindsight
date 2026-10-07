# Hindsight

**What your agents did, after the fact.** Hindsight reads the runs of four apps and lays each one out on a timeline: what was understood, every call, every wait, every check, with the time each took.

It is a small version of an agent observer: one place to look when an agent did something and you want to know how.

- Live: *(added when the site is deployed)*
- The apps it reads: [Sayso](https://github.com/f20230125-sudo/sayso), [Flowboard](https://github.com/f20230125-sudo/flowboard), [Agent Desk and the GitHub bot](https://github.com/f20230125-sudo/github-bot)

## Where it stands

| App | How its runs get here | State |
|---|---|---|
| GitHub bot | Read live from the file its scheduled job commits to GitHub | Working |
| Agent Desk | A button on its run page sends the run here, inside your browser | Next |
| Sayso | A button in its "How it worked" panel | Next |
| Flowboard | A button in its Run panel | Next |

## What you can do

- **See every run in one list**, newest first, with figures on top (how many, how many succeeded, the typical length, the slowest tenth). Filter by app, result and agent, or search. The filters live in the address, so any view is a link.
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

- Only the GitHub bot's runs are read so far (see the table above).
- The bot's snapshot keeps its recent runs; Hindsight shows the newest 60.
- The timeline is plain: no zoom, no playback, and the keyboard reaches bars but not the marks on them yet (a list of a step's marks is in the panel).
