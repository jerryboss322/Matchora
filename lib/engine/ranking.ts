/**
 * Data Quality Reporter
 *
 * Assesses data completeness for a fixture before prediction generation.
 * Used to penalize confidence scores when data is sparse.
 */

import type {
  TeamFormStats,
  VenueFormStats,
  HeadToHeadStats,
  StandingEntry,
  FixtureOdds,
  DataQualityReport,
  MarketPrediction,
} from "@/types";

// Minimum sample sizes for reliable confidence
const MIN_FORM_MATCHES = 4;
const MIN_H2H_MATCHES = 2;

export function assessDataQuality(params: {
  homeForm: TeamFormStats | null;
  awayForm: TeamFormStats | null;
  homeVenueForm: VenueFormStats | null;
  awayVenueForm: VenueFormStats | null;
  h2h: HeadToHeadStats | null;
  homeStanding: StandingEntry | null;
  awayStanding: StandingEntry | null;
  odds: FixtureOdds | null;
}): DataQualityReport {
  const warnings: string[] = [];
  let score = 1.0;

  const hasForm = params.homeForm !== null && params.awayForm !== null;
  const hasVenueForm =
    params.homeVenueForm !== null && params.awayVenueForm !== null;
  const hasH2H = params.h2h !== null && params.h2h.totalMeetings >= MIN_H2H_MATCHES;
  const hasStandings =
    params.homeStanding !== null && params.awayStanding !== null;
  const hasOdds = params.odds !== null && params.odds.bookmakers.length > 0;

  // Form quality
  if (!hasForm) {
    score -= 0.4;
    warnings.push("Team form data unavailable — prediction reliability significantly reduced");
  } else {
    const homePlayed = params.homeForm!.played;
    const awayPlayed = params.awayForm!.played;
    if (homePlayed < MIN_FORM_MATCHES || awayPlayed < MIN_FORM_MATCHES) {
      score -= 0.15;
      warnings.push(
        `Insufficient form data: ${homePlayed} home / ${awayPlayed} away recent matches`
      );
    }
  }

  // Venue form quality
  if (!hasVenueForm) {
    score -= 0.1;
    warnings.push("Home/away specific form unavailable — using overall form only");
  }

  // H2H quality
  if (!hasH2H) {
    score -= 0.1;
    if (params.h2h && params.h2h.totalMeetings < MIN_H2H_MATCHES) {
      warnings.push(
        `Only ${params.h2h.totalMeetings} H2H meetings found — historical analysis limited`
      );
    } else {
      warnings.push("No head-to-head data available");
    }
  }

  // Standings quality
  if (!hasStandings) {
    score -= 0.05;
    warnings.push("League standings unavailable — relative strength analysis skipped");
  }

  // Odds quality
  if (!hasOdds) {
    score -= 0.1;
    warnings.push("No bookmaker odds available — market confidence signals absent");
  } else if (params.odds!.bookmakers.length < 3) {
    score -= 0.05;
    warnings.push("Limited bookmaker coverage — odds-based signals less reliable");
  }

  const formSampleSize = hasForm
    ? Math.min(params.homeForm!.played, params.awayForm!.played)
    : 0;

  return {
    overallScore: Math.max(0.1, Math.min(1.0, score)), // floor at 0.1 (below 0.4 = no prediction)
    hasForm,
    hasVenueForm,
    hasH2H,
    hasStandings,
    hasOdds,
    formSampleSize,
    h2hSampleSize: params.h2h?.totalMeetings ?? 0,
    warnings,
  };
}

/**
 * Determine if a fixture has enough data to make any predictions.
 * Requires at least 2 available signals out of: form, H2H, standings, odds.
 * This allows international fixtures (World Cup, friendlies) with partial data
 * to still generate predictions at reduced confidence.
 */
export function canGeneratePredictions(quality: DataQualityReport): boolean {
  const availableSignals = [
    quality.hasForm,
    quality.hasH2H,
    quality.hasStandings,
    quality.hasOdds,
  ].filter(Boolean).length;

  // Hard floor: if overall quality is too low, skip entirely
  if (quality.overallScore < 0.40) return false;

  return availableSignals >= 2;
}

/**
 * Derive a confidence tier label from data quality score.
 */
export function confidenceTier(
  overallScore: number
): "high" | "medium" | "low" {
  if (overallScore >= 0.8) return "high";
  if (overallScore >= 0.6) return "medium";
  return "low";
}

/**
 * Rank market predictions by composite score:
 * 1. Overall confidence (weighted blend)
 * 2. Data reliability
 * 3. Model confidence (tiebreaker)
 *
 * Returns the top N predictions.
 */
export function rankPredictions(
  predictions: MarketPrediction[],
  topN = 7
): MarketPrediction[] {
  return [...predictions]
    .sort((a, b) => {
      // Primary: overall confidence
      if (Math.abs(b.confidence - a.confidence) > 0.5) {
        return b.confidence - a.confidence;
      }
      // Secondary: data reliability
      if (b.dataReliability !== a.dataReliability) {
        return b.dataReliability - a.dataReliability;
      }
      // Tertiary: model confidence
      return b.modelConfidence - a.modelConfidence;
    })
    .slice(0, topN);
}
