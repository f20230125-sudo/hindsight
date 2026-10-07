import { expect, test, type Page } from "@playwright/test";
import { AUDIT_PATH, SAYSO_PATH, detail, openRun, recorded, timeline } from "./helpers";

// What keeps a visitor safe: the headers every page is sent with, pages that
// keep to them, and text from a run being drawn as text whatever it says.

const PAGES = ["/", AUDIT_PATH, `${SAYSO_PATH}?time=agent`, "/overview", "/sources", "/open"];

test("every page, and the data behind it, is sent with the headers that fence it in", async ({ request }) => {
  for (const path of [...PAGES, "/api/runs/github-bot", "/api/runs/samples", "/api/health"]) {
    const response = await request.get(path);
    expect(response.ok(), path).toBe(true);
    const headers = response.headers();

    const policy = headers["content-security-policy"] ?? "";
    for (const rule of ["default-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'"]) {
      expect(policy, `${path}: ${rule}`).toContain(rule);
    }
    // The built app runs no code made from text. (The development server needs to, for fast refresh.)
    if (process.env.CI) expect(policy, path).not.toContain("unsafe-eval");
    // Nothing from another site: no address is named anywhere in the policy.
    expect(policy, path).not.toMatch(/https?:/);

    expect(headers["x-frame-options"], path).toBe("DENY");
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"], path).toContain("camera=()");
    // /open answers the tab that opened it, so the tie between the two is left as it is.
    expect(headers["cross-origin-opener-policy"], path).toBeUndefined();
  }
});

/** Notes anything the page tries that its own policy forbids. */
async function watchPolicy(page: Page) {
  await page.addInitScript(() => {
    const broken: string[] = [];
    (window as unknown as { __broken: string[] }).__broken = broken;
    document.addEventListener("securitypolicyviolation", (event) => broken.push(`${event.violatedDirective}: ${event.blockedURI}`));
  });
}
const broken = (page: Page) => page.evaluate(() => (window as unknown as { __broken: string[] }).__broken);

test("no page tries anything its policy forbids, so the policy takes nothing away", async ({ page }) => {
  await watchPolicy(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await broken(page), path).toEqual([]);
  }

  // And while a run is being explored: a bar chosen, the table, a moment played.
  await openRun(page, SAYSO_PATH);
  await timeline(page).getByRole("button", { name: /^POST \/api\/quotes\. API call/ }).click();
  await expect(detail(page)).toContainText("POST /api/quotes");
  await page.getByRole("button", { name: "Agent time" }).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("button", { name: "Table" }).click();
  await expect(page.getByRole("table", { name: "Every bar and mark of the run, in the order they began" })).toBeVisible();
  expect(await broken(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("a run whose text is markup is drawn as text, and runs nothing", async ({ page }) => {
  await watchPolicy(page);
  const MARKUP = `<img src=x onerror="window.__ran=1"><script>window.__ran=1</script>`;
  const LINK = "javascript:window.__ran=1";
  const ran = () => page.evaluate(() => (window as unknown as { __ran?: number }).__ran);

  // A real Sayso run, with everything a person typed or an API answered replaced by markup and a script address.
  const envelope = recorded("sayso", "a window seat, paid for");
  const data = envelope.data as { words: string; steps: { kind: string; text?: string | null; label?: string }[]; calls: { url: string; result: unknown }[]; checks: { label: string }[] };
  data.words = MARKUP;
  for (const step of data.steps) {
    if (step.kind === "say") step.text = MARKUP;
    if (step.label) step.label = MARKUP;
  }
  for (const call of data.calls) {
    call.url = LINK;
    call.result = { html: MARKUP, href: LINK };
  }
  for (const check of data.checks) check.label = MARKUP;

  await page.goto("/sources");
  await page.locator('input[type="file"]').setInputFiles({ name: `${MARKUP}.json`, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(envelope)) });
  await expect(page.getByRole("status", { name: "What became of the files" })).toContainText("was read.");
  await page.getByRole("link", { name: /^Open “/ }).click();

  // The run page says the words as they are.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(MARKUP);
  await expect(timeline(page)).toBeVisible();
  // Its bars, its marks and their tips, the detail of a call with its data opened, the table, and what was shown at a moment.
  const call = timeline(page).getByRole("button", { name: /^GET javascript:window\.__ran=1\. API call/ }).first();
  await call.hover();
  await call.click();
  await expect(detail(page)).toContainText(LINK);
  await detail(page).getByRole("button", { name: "Open output" }).click();
  await expect(detail(page)).toContainText(MARKUP);
  await page.getByRole("slider", { name: "Moment in the run" }).fill("5917");
  await expect(detail(page)).toContainText(MARKUP);
  await page.getByRole("button", { name: "Table" }).click();
  await expect(page.getByRole("table", { name: "Every bar and mark of the run, in the order they began" })).toContainText(MARKUP);

  const checkPage = async (where: string) => {
    expect(await ran(), where).toBeUndefined();
    await expect(page.locator('img[src="x"]'), where).toHaveCount(0);
    await expect(page.locator('a[href^="javascript:"]'), where).toHaveCount(0);
    expect(await broken(page), where).toEqual([]);
  };
  await checkPage("the run");

  // And everywhere else the run is named: the list, the charts, the list of what was sent.
  for (const path of ["/", "/overview", "/sources"]) {
    await page.goto(path);
    // Written out on the page as it is (on the overview, in the tip of the run's dot, which shows on hover).
    await expect(page.getByRole("main")).toContainText(MARKUP);
    await checkPage(path);
  }
});
