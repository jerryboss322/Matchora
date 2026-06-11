/**
 * Confidence Engine
 *
 * Produces a calculated confidence score for each prediction market.
 * Scores are derived purely from statistical signals — never random,
 * never manually assigned.
 *
 * Inputs:
 *   - Team form (all matches)
 *   - Home/away venue form
 *   - Head-to-head history
 *   - League standings context
 *   - Bookmaker odds (implied probabilities)
 *   - Data quality factor
 */

import type {
  TeamFormStats,
  VenueFormStats,
  HeadToHeadStats,
  StandingEntry,
  FixtureOdds,
  MarketPrediction,
  MarketKey,
  ConfidenceFactor,
  DataQualityReport,
} from "@/types";
import {
  approximateExpectedGoals,
  poissonOverProb,
  poissonScoringProb,
} from "./form";
import { h2hConsistencyFactor } from "./h2h";

/** Internal engine input — form is always resolved (never null). */
interface EngineInput {
  homeForm: TeamFormStats;
  awayForm: TeamFormStats;
  homeVenueForm: VenueFormStats | null;
  awayVenueForm: VenueFormStats | null;
  h2h: HeadToHeadStats | null;
  homeStanding: StandingEntry | null;
  awayStanding: StandingEntry | null;
  odds: FixtureOdds | null;
  dataQuality: DataQualityReport;
}

/** Public input accepted by generateAllPredictions — form may be null. */
export interface PublicEngineInput {
  homeForm: TeamFormStats | null;
  awayForm: TeamFormStats | null;
  homeVenueForm: VenueFormStats | null;
  awayVenueForm: VenueFormStats | null;
  h2h: HeadToHeadStats | null;
  homeStanding: StandingEntry | null;
  awayStanding: StandingEntry | null;
  odds: FixtureOdds | null;
  dataQuality: DataQualityReport;
}

/**
 * Neutral fallback form stats used when real form is unavailable.
 * Represents a 50/50 team — adds minimal signal, reduces confidence via dataQuality.
 */
const NEUTRAL_FORM: TeamFormStats = {
  teamId: 0,
  teamName: "Unknown",
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goalsScored: 0,
  goalsConceded: 0,
  cleanSheets: 0,
  failedToScore: 0,
  avgGoalsScored: 1.2,   // league average approximation
  avgGoalsConceded: 1.2,
  winRate: 0.33,
  drawRate: 0.27,
  lossRate: 0.40,
  bttsRate: 0.45,
  over15Rate: 0.60,
  over25Rate: 0.45,
  over35Rate: 0.25,
};

// ─── Standing-based relative strength ─────────────────────────────────────────

/**
 * Returns a 0–1 score representing how much stronger the home team is
 * relative to the away team, based on league positions.
 * 0.5 = equal; >0.5 = home stronger; <0.5 = away stronger.
 */
function relativeStrength(
  homeStanding: StandingEntry | null,
  awayStanding: StandingEntry | null,
  tableSize: number
): number {
  if (!homeStanding || !awayStanding || tableSize === 0) return 0.5;

  // Invert position (position 1 = strongest, high position = weak)
  const homeStrength = (tableSize - homeStanding.position + 1) / tableSize;
  const awayStrength = (tableSize - awayStanding.position + 1) / tableSize;

  return homeStrength / (homeStrength + awayStrength);
}

// ─── Market evaluators ─────────────────────────────────────────────────────────

function evaluateOver05(input: EngineInput): MarketPrediction {
  const xg = approximateExpectedGoals(
    input.homeForm,
    input.awayForm,
    input.homeVenueForm,
    input.awayVenueForm
  );
  const xgTotal = xg.home + xg.away;

  // Statistical: P(total goals > 0.5) via Poisson
  const poissonProb = poissonOverProb(xgTotal, 0.5);

  // Historical: combined scoring rate from form
  const homeScoredRate =
    input.homeVenueForm?.over15Rate ?? input.homeForm.over15Rate;
  const awayScoredRate =
    input.awayVenueForm?.over15Rate ?? input.awayForm.over15Rate;
  // Over 0.5 is roughly: P(home scores) + P(away scores) - P(both score in first goal)
  const historicalRate = Math.min(
    0.99,
    1 - (1 - input.homeForm.avgGoalsScored / (input.homeForm.avgGoalsScored + 0.01)) *
      (1 - input.awayForm.avgGoalsScored / (input.awayForm.avgGoalsScored + 0.01))
  );

  // H2H: what % of historical meetings had at least 1 goal?
  const h2hRate = input.h2h
    ? input.h2h.over15Rate > 0
      ? input.h2h.over15Rate
      : 1 - Math.exp(-input.h2h.avgGoalsPerGame)
    : null;
  const h2hFactor =
    h2hRate !== null
      ? h2hConsistencyFactor(h2hRate, input.h2h!.totalMeetings)
      : 1.0;

  // Odds: implied probability from bookmakers
  const oddsProb = input.odds?.impliedProbabilities
    ? input.odds.impliedProbabilities.over25 > 0.6
      ? 0.97 // if market says high-scoring, over 0.5 is near-certain
      : 0.88
    : null;

  const factors: ConfidenceFactor[] = [
    {
      name: "Poisson model",
      value: poissonProb,
      weight: 0.35,
      detail: `xG model projects ${xgTotal.toFixed(2)} total goals`,
    },
    {
      name: "Historical scoring rate",
      value: historicalRate,
      weight: 0.3,
      detail: `Teams averaged ${input.homeForm.avgGoalsScored.toFixed(1)} + ${input.awayForm.avgGoalsScored.toFixed(1)} goals`,
    },
  ];

  if (h2hRate !== null) {
    factors.push({
      name: "Head-to-head trend",
      value: h2hRate * h2hFactor,
      weight: 0.2,
      detail: `${input.h2h!.over15Count}/${input.h2h!.totalMeetings} H2H meetings had 2+ goals`,
    });
  }

  if (oddsProb !== null) {
    factors.push({
      name: "Market signal",
      value: oddsProb,
      weight: 0.15,
      detail: "Bookmaker odds imply high-scoring match",
    });
  }

  const modelConfidence = weightedAverage(factors);
  const marketConfidence = oddsProb ?? modelConfidence;
  const confidence =
    (modelConfidence * 0.7 + marketConfidence * 0.3) *
    input.dataQuality.overallScore;

  return {
    key: "over_0_5",
    label: "Over 0.5 Goals",
    description: "At least one goal scored in the match",
    confidence: clamp(confidence * 100),
    modelConfidence: clamp(modelConfidence * 100),
    marketConfidence: clamp(marketConfidence * 100),
    dataReliability: input.dataQuality.overallScore,
    factors,
  };
}

function evaluateOver15(input: EngineInput): MarketPrediction {
  const xg = approximateExpectedGoals(
    input.homeForm,
    input.awayForm,
    input.homeVenueForm,
    input.awayVenueForm
  );
  const xgTotal = xg.home + xg.away;

  const poissonProb = poissonOverProb(xgTotal, 1.5);

  const homeRate =
    input.homeVenueForm?.over15Rate ?? input.homeForm.over15Rate;
  const awayRate =
    input.awayVenueForm?.over15Rate ?? input.awayForm.over15Rate;
  const historicalRate = (homeRate + awayRate) / 2;

  const h2hRate = input.h2h?.over15Rate ?? null;
  const h2hFactor = h2hRate !== null
    ? h2hConsistencyFactor(h2hRate, input.h2h!.totalMeetings)
    : 1.0;

  const oddsProb = input.odds?.impliedProbabilities?.over25 ?? null;

  const factors: ConfidenceFactor[] = [
    {
      name: "Poisson model",
      value: poissonProb,
      weight: 0.35,
      detail: `xG: ${xg.home.toFixed(2)} (H) + ${xg.away.toFixed(2)} (A)`,
    },
    {
      name: "Form over-1.5 rate",
      value: historicalRate,
      weight: 0.3,
      detail: `Home ${(homeRate * 100).toFixed(0)}% / Away ${(awayRate * 100).toFixed(0)}% over-1.5 rate`,
    },
  ];

  if (h2hRate !== null) {
    factors.push({
      name: "H2H over-1.5 rate",
      value: h2hRate * h2hFactor,
      weight: 0.2,
      detail: `${input.h2h!.over15Count}/${input.h2h!.totalMeetings} meetings had 2+ goals`,
    });
  }

  if (oddsProb !== null) {
    factors.push({
      name: "Market implied probability",
      value: oddsProb,
      weight: 0.15,
      detail: `Avg bookmaker over-2.5 implied: ${(oddsProb * 100).toFixed(0)}%`,
    });
  }

  const modelConfidence = weightedAverage(factors);
  const marketConfidence = oddsProb ?? modelConfidence;
  const confidence =
    (modelConfidence * 0.7 + marketConfidence * 0.3) *
    input.dataQuality.overallScore;

  return {
    key: "over_1_5",
    label: "Over 1.5 Goals",
    description: "At least two goals scored in the match",
    confidence: clamp(confidence * 100),
    modelConfidence: clamp(modelConfidence * 100),
    marketConfidence: clamp(marketConfidence * 100),
    dataReliability: input.dataQuality.overallScore,
    factors,
  };
}

function evaluateUnder45(input: EngineInput): MarketPrediction {
  const xg = approximateExpectedGoals(
    input.homeForm,
    input.awayForm,
    input.homeVenueForm,
    input.awayVenueForm
  );
  const xgTotal = xg.home + xg.away;

  // Under 4.5 = P(goals <= 4)
  const poissonProb = 1 - poissonOverProb(xgTotal, 4.5);

  const homeDefense =
    input.homeVenueForm?.avgGoalsConceded ?? input.homeForm.avgGoalsConceded;
  const awayDefense =
    input.awayVenueForm?.avgGoalsConceded ?? input.awayForm.avgGoalsConceded;
  // Under 4.5 is historically very common; estimate from combined averages
  const combinedAvg =
    input.homeForm.avgGoalsScored + input.awayForm.avgGoalsScored;
  const historicalRate = combinedAvg < 3 ? 0.93 : combinedAvg < 4 ? 0.85 : 0.72;

  const h2hAvg = input.h2h?.avgGoalsPerGame ?? null;
  const h2hRate = h2hAvg !== null ? (h2hAvg < 3 ? 0.93 : h2hAvg < 4 ? 0.85 : 0.72) : null;

  const factors: ConfidenceFactor[] = [
    {
      name: "Poisson model",
      value: poissonProb,
      weight: 0.4,
      detail: `xG total ${xgTotal.toFixed(2)} → low probability of 5+ goals`,
    },
    {
      name: "Average goals per game",
      value: historicalRate,
      weight: 0.35,
      detail: `Combined avg ${combinedAvg.toFixed(2)} goals/game`,
    },
  ];

  if (h2hRate !== null) {
    factors.push({
      name: "H2H goal trend",
      value: h2hRate,
      weight: 0.25,
      detail: `H2H avg ${h2hAvg!.toFixed(2)} goals/game`,
    });
  }

  const modelConfidence = weightedAverage(factors);
  const confidence = modelConfidence * input.dataQuality.overallScore;

  return {
    key: "under_4_5",
    label: "Under 4.5 Goals",
    description: "Fewer than five goals scored in the match",
    confidence: clamp(confidence * 100),
    modelConfidence: clamp(modelConfidence * 100),
    marketConfidence: clamp(modelConfidence * 100),
    dataReliability: input.dataQuality.overallScore,
    factors,
  };
}

function evaluateUnder55(input: EngineInput): MarketPrediction {
  const xg = approximateExpectedGoals(
    input.homeForm,
    input.awayForm,
    input.homeVenueForm,
    input.awayVenueForm
  );
  const xgTotal = xg.home + xg.away;
  const poissonProb = 1 - poissonOverProb(xgTotal, 5.5);

  const combinedAvg =
    input.homeForm.avgGoalsScored + input.awayForm.avgGoalsScored;
  const historicalRate = combinedAvg < 3.5 ? 0.97 : combinedAvg < 4.5 ? 0.92 : 0.84;

  const factors: ConfidenceFactor[] = [
    {
      name: "Poisson model",
      value: poissonProb,
      weight: 0.5,
      detail: `xG total ${xgTotal.toFixed(2)} → 6+ goals highly unlikely`,
    },
    {
      name: "Historical goal averages",
      value: historicalRate,
      weight: 0.5,
      detail: `Combined avg ${combinedAvg.toFixed(2)} goals/game`,
    },
  ];

  const modelConfidence = weightedAverage(factors);
  const confidence = modelConfidence * input.dataQuality.overallScore;

  return {
    key: "under_5_5",
    label: "Under 5.5 Goals",
    description: "Fewer than six goals scored in the match",
    confidence: clamp(confidence * 100),
    modelConfidence: clamp(modelConfidence * 100),
    marketConfidence: clamp(modelConfidence * 100),
    dataReliability: input.dataQuality.overallScore,
    factors,
  };
}

function evaluateHomeOver05(input: EngineInput): MarketPrediction {
  const xg = approximateExpectedGoals(
    input.homeForm,
    input.awayForm,
    input.homeVenueForm,
    input.awayVenueForm
  );

  const poissonProb = poissonScoringProb(xg.home);

  const homeScoreRate =
    1 - (input.homeVenueForm?.failedToScore ?? input.homeForm.failedToScore) /
      Math.max(input.homeVenueForm?.played ?? input.homeForm.played, 1);

  const h2hHomeScoreRate = input.h2h
    ? (input.h2h.homeWins + input.h2h.bttsCount) / Math.max(input.h2h.totalMeetings, 1)
    : null;

  const oddsProb = input.odds?.impliedProbabilities?.home ?? null;

  const factors: ConfidenceFactor[] = [
    {
      name: "Poisson model (home xG)",
      value: poissonProb,
      weight: 0.4,
      detail: `Home xG: ${xg.home.toFixed(2)}`,
    },
    {
      name: "Home scoring rate",
      value: homeScoreRate,
      weight: 0.35,
      detail: `Home team scored in ${(homeScoreRate * 100).toFixed(0)}% of recent games`,
    },
  ];

  if (h2hHomeScoreRate !== null) {
    factors.push({
      name: "H2H home scoring",
      value: h2hHomeScoreRate,
      weight: 0.15,
      detail: `Home team scored in H2H meetings`,
    });
  }

  if (oddsProb !== null) {
    factors.push({
      name: "Home win market signal",
      value: oddsProb + 0.1, // scoring over 0.5 is more likely than winning
      weight: 0.1,
      detail: `Market implies ${(oddsProb * 100).toFixed(0)}% home win probability`,
    });
  }

  const modelConfidence = weightedAverage(factors);
  const confidence = modelConfidence * input.dataQuality.overallScore;

  return {
    key: "home_over_0_5",
    label: "Home Team Over 0.5 Goals",
    description: "Home team scores at least one goal",
    confidence: clamp(confidence * 100),
    modelConfidence: clamp(modelConfidence * 100),
    marketConfidence: clamp((oddsProb ?? modelConfidence) * 100),
    dataReliability: input.dataQuality.overallScore,
    factors,
  };
}

function evaluateAwayOver05(input: EngineInput): MarketPrediction {
  const xg = approximateExpectedGoals(
    input.homeForm,
    input.awayForm,
    input.homeVenueForm,
    input.awayVenueForm
  );

  const poissonProb = poissonScoringProb(xg.away);

  const awayScoreRate =
    1 - (input.awayVenueForm?.failedToScore ?? input.awayForm.failedToScore) /
      Math.max(input.awayVenueForm?.played ?? input.awayForm.played, 1);

  const h2hAwayScoreRate = input.h2h
    ? (input.h2h.awayWins + input.h2h.bttsCount) / Math.max(input.h2h.totalMeetings, 1)
    : null;

  const oddsProb = input.odds?.impliedProbabilities?.away ?? null;

  const factors: ConfidenceFactor[] = [
    {
      name: "Poisson model (away xG)",
      value: poissonProb,
      weight: 0.4,
      detail: `Away xG: ${xg.away.toFixed(2)}`,
    },
    {
      name: "Away scoring rate",
      value: awayScoreRate,
      weight: 0.35,
      detail: `Away team scored in ${(awayScoreRate * 100).toFixed(0)}% of recent away games`,
    },
  ];

  if (h2hAwayScoreRate !== null) {
    factors.push({
      name: "H2H away scoring",
      value: h2hAwayScoreRate,
      weight: 0.15,
      detail: "Away team's historical scoring in H2H meetings",
    });
  }

  if (oddsProb !== null) {
    factors.push({
      name: "Away win market signal",
      value: oddsProb + 0.05,
      weight: 0.1,
      detail: `Market implies ${(oddsProb * 100).toFixed(0)}% away win probability`,
    });
  }

  const modelConfidence = weightedAverage(factors);
  const confidence = modelConfidence * input.dataQuality.overallScore;

  return {
    key: "away_over_0_5",
    label: "Away Team Over 0.5 Goals",
    description: "Away team scores at least one goal",
    confidence: clamp(confidence * 100),
    modelConfidence: clamp(modelConfidence * 100),
    marketConfidence: clamp((oddsProb ?? modelConfidence) * 100),
    dataReliability: input.dataQuality.overallScore,
    factors,
  };
}

function evaluateDoubleChance(
  input: EngineInput,
  tableSize: number
): MarketPrediction[] {
  const relStr = relativeStrength(
    input.homeStanding,
    input.awayStanding,
    tableSize
  );
  const oddsProbs = input.odds?.impliedProbabilities;

  // Home or Draw
  const homeOrDraw = (input.homeForm.winRate + input.homeForm.drawRate) * 0.5 +
    (input.homeVenueForm
      ? (input.homeVenueForm.winRate + input.homeVenueForm.drawRate) * 0.5
      : (input.homeForm.winRate + input.homeForm.drawRate) * 0.5);
  const dcHomeDrawModel = homeOrDraw * relStr + 0.5 * (1 - relStr);
  const dcHomeDrawMarket = oddsProbs ? oddsProbs.home + oddsProbs.draw : null;
  const dcHomeDrawConf = dcHomeDrawMarket
    ? dcHomeDrawModel * 0.6 + dcHomeDrawMarket * 0.4
    : dcHomeDrawModel;

  // Away or Draw
  const awayOrDraw = (input.awayForm.winRate + input.awayForm.drawRate) * 0.5 +
    (input.awayVenueForm
      ? (input.awayVenueForm.winRate + input.awayVenueForm.drawRate) * 0.5
      : (input.awayForm.winRate + input.awayForm.drawRate) * 0.5);
  const dcAwayDrawModel = awayOrDraw * (1 - relStr) + 0.5 * relStr;
  const dcAwayDrawMarket = oddsProbs ? oddsProbs.away + oddsProbs.draw : null;
  const dcAwayDrawConf = dcAwayDrawMarket
    ? dcAwayDrawModel * 0.6 + dcAwayDrawMarket * 0.4
    : dcAwayDrawModel;

  // Home or Away (no draw)
  const dcHomeAwayModel = (input.homeForm.winRate + input.awayForm.winRate) / 2;
  const dcHomeAwayMarket = oddsProbs ? 1 - oddsProbs.draw : null;
  const dcHomeAwayConf = dcHomeAwayMarket
    ? dcHomeAwayModel * 0.5 + dcHomeAwayMarket * 0.5
    : dcHomeAwayModel;

  const makeFactors = (
    modelConf: number,
    marketConf: number | null,
    label: string
  ): ConfidenceFactor[] => [
    {
      name: "Form-based probability",
      value: modelConf,
      weight: 0.6,
      detail: label,
    },
    ...(marketConf !== null
      ? [
          {
            name: "Market implied probability",
            value: marketConf,
            weight: 0.4,
            detail: `Bookmaker market signals`,
          },
        ]
      : []),
  ];

  return [
    {
      key: "double_chance_home_draw" as MarketKey,
      label: "Double Chance: Home or Draw",
      description: "Home team wins or match ends in a draw",
      confidence: clamp(dcHomeDrawConf * input.dataQuality.overallScore * 100),
      modelConfidence: clamp(dcHomeDrawModel * 100),
      marketConfidence: clamp((dcHomeDrawMarket ?? dcHomeDrawModel) * 100),
      dataReliability: input.dataQuality.overallScore,
      factors: makeFactors(
        dcHomeDrawModel,
        dcHomeDrawMarket,
        `Home win rate + draw rate combined`
      ),
    },
    {
      key: "double_chance_away_draw" as MarketKey,
      label: "Double Chance: Away or Draw",
      description: "Away team wins or match ends in a draw",
      confidence: clamp(dcAwayDrawConf * input.dataQuality.overallScore * 100),
      modelConfidence: clamp(dcAwayDrawModel * 100),
      marketConfidence: clamp((dcAwayDrawMarket ?? dcAwayDrawModel) * 100),
      dataReliability: input.dataQuality.overallScore,
      factors: makeFactors(
        dcAwayDrawModel,
        dcAwayDrawMarket,
        `Away win rate + draw rate combined`
      ),
    },
    {
      key: "double_chance_home_away" as MarketKey,
      label: "Double Chance: Home or Away",
      description: "Either team wins (no draw)",
      confidence: clamp(dcHomeAwayConf * input.dataQuality.overallScore * 100),
      modelConfidence: clamp(dcHomeAwayModel * 100),
      marketConfidence: clamp((dcHomeAwayMarket ?? dcHomeAwayModel) * 100),
      dataReliability: input.dataQuality.overallScore,
      factors: makeFactors(
        dcHomeAwayModel,
        dcHomeAwayMarket,
        `Neither team historically draws often`
      ),
    },
  ];
}

// ─── Main entry point ──────────────────────────────────────────────────────────

/**
 * Generate all market predictions for a fixture.
 * Returns unranked predictions — caller is responsible for ranking.
 */
export function generateAllPredictions(
  input: PublicEngineInput,
  tableSize = 20
): MarketPrediction[] {
  // Resolve null form to neutral fallback so evaluators always have stats to work with.
  // The dataQuality.overallScore already penalizes confidence for missing data.
  const resolved: EngineInput = {
    ...input,
    homeForm: input.homeForm ?? NEUTRAL_FORM,
    awayForm: input.awayForm ?? NEUTRAL_FORM,
  };

  return [
    evaluateOver05(resolved),
    evaluateOver15(resolved),
    evaluateUnder45(resolved),
    evaluateUnder55(resolved),
    evaluateHomeOver05(resolved),
    evaluateAwayOver05(resolved),
    ...evaluateDoubleChance(resolved, tableSize),
  ];
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function weightedAverage(factors: ConfidenceFactor[]): number {
  const totalWeight = factors.reduce((s, f) => s + f.weight, 0);
  if (totalWeight === 0) return 0;
  return (
    factors.reduce((s, f) => s + f.value * f.weight, 0) / totalWeight
  );
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value * 10) / 10));
}
