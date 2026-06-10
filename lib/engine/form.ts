/**
 * Form Calculator
 *
 * Analyzes a list of completed match results for a given team
 * and produces a comprehensive TeamFormStats / VenueFormStats object.
 *
 * Only uses data: wins, losses, draws, goals scored, goals conceded.
 * No news, injuries, lineups, or external signals.
 */

import type { MatchResult, TeamFormStats, VenueFormStats } from "@/types";

/**
 * Compute form statistics for a team from their last N matches.
 *
 * @param teamId   The ID of the team to analyze
 * @param results  Completed match results (most recent first preferred)
 * @param limit    Maximum matches to analyze (default 10)
 */
export function computeTeamForm(
  teamId: number,
  teamName: string,
  results: MatchResult[],
  limit = 10
): TeamFormStats | null {
  const relevant = results
    .filter((r) => r.homeTeamId === teamId || r.awayTeamId === teamId)
    .slice(0, limit);

  if (relevant.length === 0) return null;

  let wins = 0,
    draws = 0,
    losses = 0,
    goalsScored = 0,
    goalsConceded = 0,
    cleanSheets = 0,
    failedToScore = 0,
    btts = 0,
    over15 = 0,
    over25 = 0,
    over35 = 0;

  for (const r of relevant) {
    const isHome = r.homeTeamId === teamId;
    const scored = isHome ? r.homeGoals : r.awayGoals;
    const conceded = isHome ? r.awayGoals : r.homeGoals;
    const totalGoals = r.homeGoals + r.awayGoals;

    goalsScored += scored;
    goalsConceded += conceded;

    if (scored > conceded) wins++;
    else if (scored === conceded) draws++;
    else losses++;

    if (conceded === 0) cleanSheets++;
    if (scored === 0) failedToScore++;
    if (scored > 0 && conceded > 0) btts++;
    if (totalGoals > 1) over15++;
    if (totalGoals > 2) over25++;
    if (totalGoals > 3) over35++;
  }

  const played = relevant.length;

  return {
    teamId,
    teamName,
    played,
    wins,
    draws,
    losses,
    goalsScored,
    goalsConceded,
    cleanSheets,
    failedToScore,
    avgGoalsScored: goalsScored / played,
    avgGoalsConceded: goalsConceded / played,
    winRate: wins / played,
    drawRate: draws / played,
    lossRate: losses / played,
    bttsRate: btts / played,
    over15Rate: over15 / played,
    over25Rate: over25 / played,
    over35Rate: over35 / played,
  };
}

/**
 * Compute home-only or away-only form statistics.
 */
export function computeVenueForm(
  teamId: number,
  teamName: string,
  results: MatchResult[],
  venue: "home" | "away",
  limit = 8
): VenueFormStats | null {
  const relevant = results
    .filter((r) =>
      venue === "home" ? r.homeTeamId === teamId : r.awayTeamId === teamId
    )
    .slice(0, limit);

  if (relevant.length === 0) return null;

  const baseStats = computeTeamForm(teamId, teamName, relevant, limit);
  if (!baseStats) return null;

  return { ...baseStats, venue };
}

/**
 * Compute a simple "expected goals" approximation from recent form.
 * This is not Opta xG — it's an average-based approximation.
 *
 * Returns { home: number, away: number } expected goals for a fixture.
 */
export function approximateExpectedGoals(
  homeFormAll: TeamFormStats,
  awayFormAll: TeamFormStats,
  homeVenueForm: VenueFormStats | null,
  awayVenueForm: VenueFormStats | null
): { home: number; away: number } {
  // Weight home-venue form more heavily if available
  const homeAttack =
    homeVenueForm && homeVenueForm.played >= 3
      ? homeVenueForm.avgGoalsScored * 0.65 +
        homeFormAll.avgGoalsScored * 0.35
      : homeFormAll.avgGoalsScored;

  const homeDefense =
    homeVenueForm && homeVenueForm.played >= 3
      ? homeVenueForm.avgGoalsConceded * 0.65 +
        homeFormAll.avgGoalsConceded * 0.35
      : homeFormAll.avgGoalsConceded;

  const awayAttack =
    awayVenueForm && awayVenueForm.played >= 3
      ? awayVenueForm.avgGoalsScored * 0.65 +
        awayFormAll.avgGoalsScored * 0.35
      : awayFormAll.avgGoalsScored;

  const awayDefense =
    awayVenueForm && awayVenueForm.played >= 3
      ? awayVenueForm.avgGoalsConceded * 0.65 +
        awayFormAll.avgGoalsConceded * 0.35
      : awayFormAll.avgGoalsConceded;

  // Expected goals = blend of team's attack vs opponent's defensive record
  const xgHome = (homeAttack + awayDefense) / 2;
  const xgAway = (awayAttack + homeDefense) / 2;

  return {
    home: Math.max(0, xgHome),
    away: Math.max(0, xgAway),
  };
}

/**
 * Estimate scoring probability for each team using a Poisson approximation.
 * P(team scores at least 1 goal) = 1 - P(0 goals) = 1 - e^(-lambda)
 */
export function poissonScoringProb(expectedGoals: number): number {
  // P(X >= 1) = 1 - P(X = 0) = 1 - e^(-lambda)
  return 1 - Math.exp(-Math.max(0, expectedGoals));
}

/**
 * Estimate P(total goals > N) from expected goals using Poisson.
 *
 * For a combined match xG of lambda_total, this sums probabilities
 * of getting more than N goals via Poisson PMF.
 */
export function poissonOverProb(expectedTotal: number, threshold: number): number {
  // P(X > threshold) = 1 - CDF(threshold)
  // CDF via summing Poisson PMF up to threshold
  let cdf = 0;
  const maxK = Math.ceil(threshold) + 1;

  for (let k = 0; k <= maxK; k++) {
    cdf += poissonPMF(expectedTotal, k);
  }

  return Math.max(0, Math.min(1, 1 - cdf));
}

function poissonPMF(lambda: number, k: number): number {
  // PMF = (lambda^k * e^-lambda) / k!
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}
