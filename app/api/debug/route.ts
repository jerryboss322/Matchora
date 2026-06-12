/**
 * Debug v3 — test team events and find correct tournament/event endpoints
 * Testing one at a time to avoid rate limits
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 0;

async function ss(path: string) {
  const key = process.env.STATS_API_KEY ?? "";
  const host = process.env.STATS_API_HOST ?? "sofascore.p.rapidapi.com";
  // Add delay to avoid rate limiting
  await new Promise(r => setTimeout(r, 300));
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
  const str = JSON.stringify(body);
  return {
    endpoint: path,
    status: res.status,
    ok: res.ok,
    preview: str.slice(0, 800),
  };
}

export async function GET() {
  // Test sequentially with delays to avoid rate limit
  // Sofascore team IDs for national teams (from their website URLs):
  // Canada = 3630, Bosnia = 3666, Mexico = 3448, South Korea = 3674
  const results = [];

  results.push(await ss(`/team/3630/events/last/0`)); // Canada
  results.push(await ss(`/team/3666/events/last/0`)); // Bosnia
  results.push(await ss(`/team/3630/events/next/0`)); // Canada upcoming
  // Also test the unique tournament endpoint for World Cup
  results.push(await ss(`/unique-tournament/16/season/61627/events/last/page/0`));

  return NextResponse.json({ results });
}
