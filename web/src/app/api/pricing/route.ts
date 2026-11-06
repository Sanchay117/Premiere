import { relayJson, workerFetch } from "@/lib/worker";

export const dynamic = "force-dynamic";

export async function GET() {
  return relayJson(await workerFetch("/pricing"));
}
