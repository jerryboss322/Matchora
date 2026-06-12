/**
 * GET /api/health
 *
 * Checks connectivity and configuration for all data providers.
 * Never exposes API keys — only returns status flags.
 *
 * Response: ApiResponse<SystemHealth>
 */

import { NextResponse } from "next/server";
import type { ApiResponse, SystemHealth, ProviderStatus } from "@/types";
import { pingFootballData } from "@/lib/api/football-data";
import { pingOddsApi } from "@/lib/api/odds-api";
import { pingSpportmonks } from "@/lib/api/sportmonks";
import { pingSofascore } from "@/lib/api/sofascore";

export const runtime = "nodejs";
export const revalidate = 0; // always fresh

export async function GET(): Promise<NextResponse<ApiResponse<SystemHealth>>> {
  const checkedAt = new Date().toISOString();

  const [fdReachable, oddsReachable, smReachable, statsReachable] = await Promise.all([
    pingFootballData().catch(() => false),
    pingOddsApi().catch(() => false),
    pingSpportmonks().catch(() => false),
    pingSofascore().catch(() => false),
  ]);

  const providers: ProviderStatus[] = [
    {
      name: "Football-Data.org",
      key: "football-data",
      configured: Boolean(process.env.FOOTBALL_DATA_API_KEY),
      reachable: fdReachable,
      lastChecked: checkedAt,
      ...(!process.env.FOOTBALL_DATA_API_KEY && {
        error: "FOOTBALL_DATA_API_KEY environment variable not set",
      }),
    },
    {
      name: "The Odds API",
      key: "odds-api",
      configured: Boolean(process.env.ODDS_API_KEY),
      reachable: oddsReachable,
      lastChecked: checkedAt,
      ...(!process.env.ODDS_API_KEY && {
        error: "ODDS_API_KEY environment variable not set",
      }),
    },
    {
      name: "Sportmonks",
      key: "sportmonks",
      configured: Boolean(process.env.SPORTMONKS_API_KEY),
      reachable: smReachable,
      lastChecked: checkedAt,
      ...(!process.env.SPORTMONKS_API_KEY && {
        error: "SPORTMONKS_API_KEY environment variable not set",
      }),
    },
    {
      name: "Sofascore (RapidAPI)",
      key: "sofascore",
      configured: Boolean(process.env.STATS_API_KEY),
      reachable: statsReachable,
      lastChecked: checkedAt,
      ...(!process.env.STATS_API_KEY && {
        error: "STATS_API_KEY environment variable not set",
      }),
    },
  ];

  return NextResponse.json({
    success: true,
    data: { providers, checkedAt },
  });
}
