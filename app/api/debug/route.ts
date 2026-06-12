import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const revalidate = 0;

async function ss(path: string) {
  const key = process.env.STATS_API_KEY ?? "";
  const host = process.env.STATS_API_HOST ?? "sofascore.p.rapidapi.com";
  await new Promise(r => setTimeout(r, 500));
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
    preview: JSON.stringify(body).slice(0, 1000),
  };
}

export async function GET() {
  const results = [];

  // Search for Canada football team
  results.push(await ss(`/teams/search?name=Canada`));
  results.push(await ss(`/teams/search?query=Canada`));
  results.push(await ss(`/teams/search?teamName=Canada`));

  // Try the default example teamId=38 to see what sport it is
  results.push(await ss(`/teams/get-last-matches?teamId=38&pageIndex=0`));

  return NextResponse.json({ results });
}
