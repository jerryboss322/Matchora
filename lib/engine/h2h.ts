/**
 * Head-to-Head Analyzer
 *
 * Processes historical meetings between two teams and extracts
 * scoring trends, BTTS rates, and result tendencies.
 */

import type { MatchResult, HeadToHeadStats } from "@/types";

/**
 * Compute H2H statistics from a list of past meetings.
 *
 * @param homeTeamId  The ID of the home team in the upcoming fixture
 * @param awayTeamId  The ID of the away team in the upcoming fixture
 * @param meetings    Historical results between these two teams
 */
export function computeH2H(
  homeTeamId: number,
  awayTeamId: number,
  meetings: MatchResult[]
): HeadToHeadStats | null {
  if (meetings.length === 0) return null;

  let homeWins = 0,
    awayWins = 0,
    draws = 0,
    totalGoals = 0,
    btts = 0,
    over15 = 0,
    over25 = 0;

  for (const m of meetings) {
    const goals = m.homeGoals + m.awayGoals;
    totalGoals += goals;

    if (m.homeGoals > m.awayGoals) {
      // The home team in the past meeting won
      // Map to fixture home/away perspective
      if (m.homeTeamId === homeTeamId) homeWins++;
      else awayWins++;
    } else if (m.homeGoals < m.awayGoals) {
      if (m.awayTeamId === homeTeamId) homeWins++;
      else awayWins++;
    } else {
      draws++;
    }

    if (m.homeGoals > 0 && m.awayGoals > 0) btts++;
    if (goals > 1) over15++;
    if (goals > 2) over25++;
  }

  const n = meetings.length;

  return {
    totalMeetings: n,
    homeWins,
    awayWins,
    draws,
    avgGoalsPerGame: totalGoals / n,
    bttsCount: btts,
    bttsRate: btts / n,
    over15Count: over15,
    over15Rate: over15 / n,
    over25Count: over25,
    over25Rate: over25 / n,
    recentMeetings: meetings.slice(0, 5),
  };
}

/**
 * Derive a H2H-based confidence adjustment for a market.
 *
 * Returns a multiplier (0.6–1.0) based on:
 * - Sample size (less data = closer to 1.0, i.e. neutral)
 * - Consistency of the historical trend
 */
export function h2hConsistencyFactor(
  observedRate: number,
  sampleSize: number
): number {
  if (sampleSize === 0) return 1.0; // no data, no adjustment
  // Confidence in H2H data grows with sample size; cap at 5 matches
  const weight = Math.min(sampleSize / 5, 1.0);
  // How far the observed rate deviates from 0.5 (uncertain center)
  const deviation = Math.abs(observedRate - 0.5);
  // Strong consistent trend → amplifies the observed rate signal
  return 0.6 + weight * deviation * 0.8;
}
