/**
 * GET /api/debug
 * Temporary debug endpoint — remove before production.
 * Tests Sofascore API responses to verify correct endpoint paths.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 0;

async function sofascoreFetch(path: string) {
  const key = process.env.STATS_API_KEY;
  const host = process.env.STATS_API_HOST ?? "sofascore.p.rapidapi.com";
  const url = `https://sofascore.p.rapidapi.com${path}`;

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-key": key ?? "",
      "x-rapidapi-host": host,
    },
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, ok: res.ok, body: json };
}

export async function GET() {
  const today = new Date().toISOString().split("T")[0];

  // Test multiple endpoints to find which ones work
  const results = await Promise.all([
    sofascoreFetch("/categories/list?sport=football").then(r => ({ endpoint: "/categories/list", ...r })).catch(e => ({ endpoint: "/categories/list", error: String(e) })),
    sofascoreFetch(`/matches/list-by-date?date=${today}&timezone=UTC`).then(r => ({ endpoint: "/matches/list-by-date", ...r })).catch(e => ({ endpoint: "/matches/list-by-date", error: String(e) })),
    sofascoreFetch(`/search?query=Canada&sport=football`).then(r => ({ endpoint: "/search?query=Canada", ...r })).catch(e => ({ endpoint: "/search?query=Canada", error: String(e) })),
    sofascoreFetch(`/teams/get-last-matches?teamId=4166&page=0`).then(r => ({ endpoint: "/teams/get-last-matches?teamId=4166", ...r })).catch(e => ({ endpoint: "/teams/get-last-matches", error: String(e) })),
  ]);

  return NextResponse.json({ results });
}
