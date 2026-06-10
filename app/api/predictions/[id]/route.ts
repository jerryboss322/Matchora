/**
 * GET /api/predictions/[id]
 *
 * Generates a full prediction for a single fixture.
 * The [id] parameter must be a fixture ID in the format "source:sourceId"
 * e.g. "football-data:499295"
 *
 * Response: ApiResponse<FixturePrediction>
 */

import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse, Fixture, FixturePrediction } from "@/types";
import { getTodaysFixtures } from "@/lib/api/football-data";
import { predictFixture } from "@/lib/engine/predictor";

export const runtime = "nodejs";
// Predictions are more expensive to compute; cache for 10 minutes
export const revalidate = 600;

// Next.js 15: params is a Promise
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<FixturePrediction>>> {
  const { id } = await params;

  if (!id || !id.includes(":")) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid fixture ID format. Expected: source:id",
        code: "INVALID_ID",
      },
      { status: 400 }
    );
  }

  try {
    // Resolve the fixture from today's schedule
    // (predictions only available for upcoming/scheduled fixtures)
    const fixtures = await getTodaysFixtures().catch(() => [] as Fixture[]);
    const fixture = fixtures.find((f) => f.id === id);

    if (!fixture) {
      return NextResponse.json(
        {
          success: false,
          error: "Fixture not found. Only today's scheduled fixtures can be analyzed.",
          code: "FIXTURE_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    const prediction = await predictFixture(fixture);

    return NextResponse.json({ success: true, data: prediction });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Prediction generation failed";
    console.error(`[predictions] Error for fixture ${id}:`, message);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate prediction",
        code: "PREDICTION_ERROR",
      },
      { status: 502 }
    );
  }
}
