/**
 * GET /api/debug
 * Tests correct Sofascore endpoint paths based on known category IDs.
 * Canada = category 388, Bosnia = category 158
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 0;

async function ss(path: string) {
  const key = process.env.STATS_API_KEY ?? "";
  const host = process.env.STATS_API_HOST ?? "sofascore.p.rapidapi.com";
  const res = await fetch(`https://sofascore.p.rapidapi.com${path}`, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-key": key,
      "x-rapidapi-host": host,
    },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 200); }
  // Truncate large responses
  const str = JSON.stringify(body);
  return {
    endpoint: path,
    status: res.status,
    ok: res.ok,
    preview: str.slice(0, 500),
  };
}

export async function GET() {
  const today = new Date().toISOString().split("T")[0];

  const results = await Promise.all([
    // Try events by date — different path variants
    ss(`/events/live`),
    ss(`/sport/football/events/live`),
    ss(`/sport/1/events/${today}`),
    ss(`/football/events/${today}`),
    // Try category tournaments (Canada = 388)
    ss(`/category/388/tournaments`),
    // Try team last events with correct ID format
    ss(`/team/4166/events/last/0`),
    ss(`/teams/4166/events/last/0`),
  ]);

  return NextResponse.json({ today, results });
}
