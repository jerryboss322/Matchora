import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const revalidate = 0;

async function ss(path: string) {
  const key = process.env.STATS_API_KEY ?? "";
  const host = process.env.STATS_API_HOST ?? "sofascore.p.rapidapi.com";
  await new Promise(r => setTimeout(r, 400));
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
  try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
  return {
    endpoint: path,
    status: res.status,
    preview: JSON.stringify(body).slice(0, 600),
  };
}

export async function GET() {
  const results = [];

  // Test the exact endpoints visible in the RapidAPI UI screenshot
  // teams/get-last-matches with different param names
  results.push(await ss(`/teams/get-last-matches?teamId=3630&pageIndex=0`));
  results.push(await ss(`/teams/get-last-matches?id=3630&pageIndex=0`));

  // matches endpoints from the screenshot
  results.push(await ss(`/matches/get-h2h?homeTeamId=3630&awayTeamId=3666`));
  results.push(await ss(`/matches/get-h2h-events?customId=AbBa`));

  return NextResponse.json({ results });
}
