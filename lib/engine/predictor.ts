/**
 * Prediction Orchestrator
 *
 * Coordinates all data sources and engine modules to produce
 * a complete FixturePrediction for a given fixture.
 *
 * This is the single entry point for the prediction pipeline.
 */

import type {
  Fixture,
  FixturePrediction,
  MatchResult,
  StandingEntry,
} from "@/types";
import {
  getTeamRecentResults,
  getHeadToHead,
  getStandings,
  SUPPORTED_COMPETITIONS,
} from "@/lib/api/football-data";
import { getUpcomingSoccerOdds, matchFixtureToOdds } from "@/lib/api/odds-api";
import { computeTeamForm, computeVenueForm } from "@/lib/engine/form";
import { computeH2H } from "@/lib/engine/h2h";
import { generateAllPredictions } from "@/lib/engine/confidence";
import { assessDataQuality, canGeneratePredictions, rankPredictions } from "@/lib/engine/ranking";

/**
 * Generate a full prediction for a single fixture.
 * All data is fetched fresh from approved APIs.
 */
export async function predictFixture(
  fixture: Fixture
): Promise<FixturePrediction> {
  // Only football-data fixtures have full data access
  if (fixture.source !== "football-data") {
    return skippedPrediction(
      fixture,
      "Detailed statistical data only available for football-data.org sourced fixtures"
    );
  }

  const homeId = fixture.homeTeam.id;
  const awayId = fixture.awayTeam.id;
  const competitionId = fixture.competition.id;

  // ─── Parallel data fetch ─────────────────────────────────────────────────────
  // All fetches run concurrently; individual failures are caught gracefully.

  const [
    homeResults,
    awayResults,
    h2hResults,
    standings,
    allOdds,
  ] = await Promise.all([
    getTeamRecentResults(homeId, 12).catch(() => [] as MatchResult[]),
    getTeamRecentResults(awayId, 12).catch(() => [] as MatchResult[]),
    getHeadToHead(fixture.sourceId, 10).catch(() => [] as MatchResult[]),
    getStandings(competitionId).catch(() => null),
    getUpcomingSoccerOdds().catch(() => []),
  ]);

  // ─── Form computation ─────────────────────────────────────────────────────────

  const homeForm = computeTeamForm(homeId, fixture.homeTeam.name, homeResults);
  const awayForm = computeTeamForm(awayId, fixture.awayTeam.name, awayResults);
  const homeVenueForm = computeVenueForm(homeId, fixture.homeTeam.name, homeResults, "home");
  const awayVenueForm = computeVenueForm(awayId, fixture.awayTeam.name, awayResults, "away");

  // ─── H2H ──────────────────────────────────────────────────────────────────────

  const h2h = computeH2H(homeId, awayId, h2hResults);

  // ─── Standings context ────────────────────────────────────────────────────────

  const tableSize = standings?.table.length ?? 20;
  const homeStanding = standings?.table.find((e) => e.team.id === homeId) ?? null;
  const awayStanding = standings?.table.find((e) => e.team.id === awayId) ?? null;

  // ─── Odds matching ────────────────────────────────────────────────────────────

  const odds = matchFixtureToOdds(
    fixture.homeTeam.name,
    fixture.awayTeam.name,
    allOdds
  );

  // ─── Data quality assessment ──────────────────────────────────────────────────

  const dataQuality = assessDataQuality({
    homeForm,
    awayForm,
    homeVenueForm,
    awayVenueForm,
    h2h,
    homeStanding,
    awayStanding,
    odds,
  });

  if (!canGeneratePredictions(dataQuality)) {
    return {
      fixture,
      generatedAt: new Date().toISOString(),
      dataQuality,
      homeForm,
      awayForm,
      homeVenueForm,
      awayVenueForm,
      h2h,
      homeStanding,
      awayStanding,
      odds,
      predictions: [],
      canPredict: false,
      skipReason:
        "Insufficient historical data to generate reliable predictions. " +
        (dataQuality.warnings[0] ?? ""),
    };
  }

  // ─── Prediction generation ────────────────────────────────────────────────────

  const allPredictions = generateAllPredictions(
    {
      homeForm: homeForm!,
      awayForm: awayForm!,
      homeVenueForm,
      awayVenueForm,
      h2h,
      homeStanding,
      awayStanding,
      odds,
      dataQuality,
    },
    tableSize
  );

  const rankedPredictions = rankPredictions(allPredictions, 7);

  return {
    fixture,
    generatedAt: new Date().toISOString(),
    dataQuality,
    homeForm,
    awayForm,
    homeVenueForm,
    awayVenueForm,
    h2h,
    homeStanding,
    awayStanding,
    odds,
    predictions: rankedPredictions,
    canPredict: true,
  };
}

function skippedPrediction(
  fixture: Fixture,
  reason: string
): FixturePrediction {
  return {
    fixture,
    generatedAt: new Date().toISOString(),
    dataQuality: {
      overallScore: 0,
      hasForm: false,
      hasVenueForm: false,
      hasH2H: false,
      hasStandings: false,
      hasOdds: false,
      formSampleSize: 0,
      h2hSampleSize: 0,
      warnings: [reason],
    },
    homeForm: null,
    awayForm: null,
    homeVenueForm: null,
    awayVenueForm: null,
    h2h: null,
    homeStanding: null,
    awayStanding: null,
    odds: null,
    predictions: [],
    canPredict: false,
    skipReason: reason,
  };
}
