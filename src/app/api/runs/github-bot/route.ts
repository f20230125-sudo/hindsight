import { loadGithubBot } from "@/sources/github-bot/load";

/**
 * GET /api/runs/github-bot: the GitHub bot's runs as traces, read from the
 * file its scheduled job commits (or from the recorded copy, which the answer
 * says). The page asks once per visit; the answer is shared between visitors
 * for five minutes.
 */
export async function GET() {
  const loaded = await loadGithubBot({
    fetch: (input, init) => fetch(input, { ...init, next: { revalidate: 300 } }),
    now: () => new Date(),
  });
  return Response.json(loaded, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
