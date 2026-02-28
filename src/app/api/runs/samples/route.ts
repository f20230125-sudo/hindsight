import { loadSamples } from "@/sources/samples";

/**
 * GET /api/runs/samples: real runs of Sayso, Flowboard and Agent Desk that were
 * recorded when Hindsight was built, as traces. They stand in until a run is
 * sent from an app. They never change between deployments, so the answer is
 * shared for an hour.
 */
export async function GET() {
  return Response.json(loadSamples(), { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
