/**
 * GET /api/fixtures
 *
 * Returns today's scheduled football fixtures from football-data.org.
 * Supplements with TheSportsDB for broader coverage where available.
 *
 * Response: ApiResponse<Fixture[]>
 */

import { NextResponse } from "next/server";
import type { ApiResponse, Fixture } from "@/types";
import { getTodaysFixtures } from "@/lib/api/football-data";
import { getTodaysFixturesSM } from "@/lib/api/sportmonks";

export const runtime = "nodejs";
export const revalidate = 300; // 5-minute cache

export async function GET(): Promise<NextResponse<ApiResponse<Fixture[]>>> {
  try {
    // Primary source: football-data.org
    const primaryFixtures = await getTodaysFixtures().catch((err) => {
      console.error("[fixtures] football-data.org fetch failed:", err.message);
      return [] as Fixture[];
    });

    // Supplemental: Sportmonks (broader league coverage)
    const supplementalFixtures = await getTodaysFixturesSM().catch(() => [] as Fixture[]);

    // Merge and deduplicate by team pairing (crude but effective)
    const combined = deduplicateFixtures([
      ...primaryFixtures,
      ...supplementalFixtures,
    ]);

    if (combined.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // Sort by kickoff time ascending
    combined.sort(
      (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
    );

    return NextResponse.json({ success: true, data: combined });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error fetching fixtures";
    console.error("[fixtures] Error:", message);

    return NextResponse.json(
      { success: false, error: "Failed to fetch fixtures", code: "FETCH_ERROR" },
      { status: 502 }
    );
  }
}

/**
 * Remove duplicate fixtures (same teams, same day) keeping the football-data
 * source over sportsdb when both are present.
 */
function deduplicateFixtures(fixtures: Fixture[]): Fixture[] {
  const seen = new Map<string, Fixture>();

  for (const f of fixtures) {
    const day = f.kickoff.substring(0, 10);
    const key = [
      day,
      Math.min(f.homeTeam.id, f.awayTeam.id),
      Math.max(f.homeTeam.id, f.awayTeam.id),
    ].join(":");

    const existing = seen.get(key);
    if (!existing || f.source === "football-data") {
      seen.set(key, f);
    }
  }

  return Array.from(seen.values());
}
