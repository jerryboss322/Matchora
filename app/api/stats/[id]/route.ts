/**
 * GET /api/stats/[id]
 *
 * Returns match statistics for a fixture.
 * [id] = API-Football numeric fixture ID.
 *
 * Response: ApiResponse<FixtureStats>
 */

import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse, FixtureStats } from "@/types";
import { getMatchStats } from "@/lib/api/stats-api";

export const runtime = "nodejs";
export const revalidate = 1800; // 30 minutes

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<FixtureStats | null>>> {
  const { id } = await params;
  const numericId = parseInt(id, 10);

  if (isNaN(numericId)) {
    return NextResponse.json(
      { success: false, error: "Invalid fixture ID — must be numeric", code: "INVALID_ID" },
      { status: 400 }
    );
  }

  try {
    const stats = await getMatchStats(numericId);
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stats fetch failed";
    return NextResponse.json(
      { success: false, error: message, code: "STATS_ERROR" },
      { status: 502 }
    );
  }
}
