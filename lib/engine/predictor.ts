/**
 * Prediction Orchestrator
 *
 * Coordinates all data sources and engine modules to produce
 * a complete FixturePrediction for a given fixture.
 *
 * Data source priority:
 * 1. football-data.org (primary — form, H2H, standings)
 * 2. Sofascore via RapidAPI (fallback — form, H2H, stats)
 * 3. The Odds API (odds + implied probabilities)
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
} from "@/lib/api/football-data";
import { getUpcomingSoccerOdds, matchFixtureToOdds } from "@/lib/api/odds-api";
import {
  getTeamRecentResultsSS,
  getH2HSofascore,
  findTeamIdSS,
} from "@/lib/api/sofascore";
import { computeTeamForm, computeVenueForm } from "@/lib/engine/form";
import { computeH2H } from "@/lib/engine/h2h";
import { generateAllPredictions, PublicEngineInput } from "@/lib/engine/confidence";
import {
  assessDataQuality,
  canGeneratePredictions,
  rankPredictions,
} from "@/lib/engine/ranking";

/**
 * Generate a full prediction for a single fixture.
 * Falls back to Sofascore when football-data.org lacks data
 * (common for international fixtures, World Cup, friendlies).
 */
export async function predictFixture(
  fixture: Fixture
): Promise<FixturePrediction> {
  const homeId = fixture.homeTeam.id;
  const awayId = fixture.awayTeam.id;
  const competitionId = fixture.competition.id;
  const kickoffDate = fixture.kickoff.split("T")[0];

  // ─── Step 1: Primary data fetch (football-data.org) ─────────────────────────
  const [
    homeResultsPrimary,
    awayResultsPrimary,
    h2hResultsPrimary,
    standings,
    allOdds,
  ] = await Promise.all([
    fixture.source === "football-data"
      ? getTeamRecentResults(homeId, 12).catch(() => [] as MatchResult[])
      : Promise.resolve([] as MatchResult[]),
    fixture.source === "football-data"
      ? getTeamRecentResults(awayId, 12).catch(() => [] as MatchResult[])
      : Promise.resolve([] as MatchResult[]),
    fixture.source === "football-data"
      ? getHeadToHead(fixture.sourceId, 10).catch(() => [] as MatchResult[])
      : Promise.resolve([] as MatchResult[]),
    getStandings(competitionId).catch(() => null),
    getUpcomingSoccerOdds().catch(() => []),
  ]);

  // ─── Step 2: Sofascore fallback for missing form/H2H ────────────────────────
  // If football-data returned no results (international fixtures etc.),
  // try Sofascore using team name search → ID → recent matches.

  let homeResults = homeResultsPrimary;
  let awayResults = awayResultsPrimary;
  let h2hResults = h2hResultsPrimary;

  const needsFallback =
    homeResults.length < 3 || awayResults.length < 3;

  if (needsFallback) {
    // Find Sofascore team IDs by name search (national=true, sport=football)
    const [ssHomeId, ssAwayId] = await Promise.all([
      findTeamIdSS(fixture.homeTeam.name).catch(() => null),
      findTeamIdSS(fixture.awayTeam.name).catch(() => null),
    ]);

    // Fetch form from Sofascore if IDs found
    if (ssHomeId && homeResults.length < 3) {
      const ssHomeResults = await getTeamRecentResultsSS(ssHomeId, 12).catch(
        () => [] as MatchResult[]
      );
      if (ssHomeResults.length > homeResults.length) {
        homeResults = ssHomeResults;
      }
    }

    if (ssAwayId && awayResults.length < 3) {
      const ssAwayResults = await getTeamRecentResultsSS(ssAwayId, 12).catch(
        () => [] as MatchResult[]
      );
      if (ssAwayResults.length > awayResults.length) {
        awayResults = ssAwayResults;
      }
    }

    // Fetch H2H from Sofascore if both IDs found and primary H2H is empty
    if (ssHomeId && ssAwayId && h2hResults.length === 0) {
      h2hResults = await getH2HSofascore(ssHomeId, ssAwayId, 10).catch(
        () => [] as MatchResult[]
      );
    }
  }

  // ─── Step 3: Form computation ─────────────────────────────────────────────

  const homeForm = computeTeamForm(homeId, fixture.homeTeam.name, homeResults);
  const awayForm = computeTeamForm(awayId, fixture.awayTeam.name, awayResults);
  const homeVenueForm = computeVenueForm(
    homeId,
    fixture.homeTeam.name,
    homeResults,
    "home"
  );
  const awayVenueForm = computeVenueForm(
    awayId,
    fixture.awayTeam.name,
    awayResults,
    "away"
  );

  // ─── Step 4: H2H ────────────────────────────────────────────────────────────

  const h2h = computeH2H(homeId, awayId, h2hResults);

  // ─── Step 5: Standings context ───────────────────────────────────────────────

  const tableSize = standings?.table.length ?? 20;
  const homeStanding =
    standings?.table.find((e) => e.team.id === homeId) ?? null;
  const awayStanding =
    standings?.table.find((e) => e.team.id === awayId) ?? null;

  // ─── Step 6: Odds matching ───────────────────────────────────────────────────

  const odds = matchFixtureToOdds(
    fixture.homeTeam.name,
    fixture.awayTeam.name,
    allOdds
  );

  // ─── Step 7: Data quality assessment ────────────────────────────────────────

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
        "Insufficient data signals to generate reliable predictions. " +
        (dataQuality.warnings[0] ?? ""),
    };
  }

  // ─── Step 8: Prediction generation ──────────────────────────────────────────

  const allPredictions = generateAllPredictions(
    {
      homeForm,
      awayForm,
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
