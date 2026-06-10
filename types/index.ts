// ─── Domain Types ─────────────────────────────────────────────────────────────

export interface Team {
  id: number;
  name: string;
  shortName?: string;
  crest?: string;
}

export interface Competition {
  id: number;
  name: string;
  code?: string;
  emblem?: string;
  country?: string;
}

export interface Fixture {
  id: string; // composite: `${source}:${id}`
  sourceId: string;
  source: "football-data" | "sportsdb";
  competition: Competition;
  homeTeam: Team;
  awayTeam: Team;
  kickoff: string; // ISO 8601
  status: FixtureStatus;
  score?: Score;
  venue?: string;
}

export type FixtureStatus =
  | "SCHEDULED"
  | "LIVE"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "SUSPENDED"
  | "POSTPONED"
  | "CANCELLED"
  | "AWARDED";

export interface Score {
  home: number | null;
  away: number | null;
  halftime?: { home: number | null; away: number | null };
}

// ─── Form & Statistics ─────────────────────────────────────────────────────────

export interface MatchResult {
  date: string;
  homeTeamId: number;
  awayTeamId: number;
  homeGoals: number;
  awayGoals: number;
  competition: string;
}

export interface TeamFormStats {
  teamId: number;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  cleanSheets: number;
  failedToScore: number;
  avgGoalsScored: number;
  avgGoalsConceded: number;
  winRate: number;
  drawRate: number;
  lossRate: number;
  bttsRate: number; // both teams scored
  over15Rate: number;
  over25Rate: number;
  over35Rate: number;
}

export interface VenueFormStats extends TeamFormStats {
  venue: "home" | "away";
}

// ─── Head-to-Head ──────────────────────────────────────────────────────────────

export interface HeadToHeadStats {
  totalMeetings: number;
  homeWins: number; // wins for the fixture's home team
  awayWins: number;
  draws: number;
  avgGoalsPerGame: number;
  bttsCount: number;
  bttsRate: number;
  over15Count: number;
  over15Rate: number;
  over25Count: number;
  over25Rate: number;
  recentMeetings: MatchResult[];
}

// ─── Standings ─────────────────────────────────────────────────────────────────

export interface StandingEntry {
  position: number;
  team: Team;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form?: string; // e.g. "WWDLW"
}

export interface LeagueStandings {
  competitionId: number;
  season: string;
  table: StandingEntry[];
}

// ─── Odds ──────────────────────────────────────────────────────────────────────

export interface OddsMarket {
  key: string; // e.g. "h2h", "totals", "spreads"
  name: string;
  outcomes: OddsOutcome[];
}

export interface OddsOutcome {
  name: string;
  price: number; // decimal odds
  point?: number; // for totals/spreads
}

export interface FixtureOdds {
  fixtureId: string;
  homeTeamName: string;
  awayTeamName: string;
  commenceTime: string;
  bookmakers: BookmakerOdds[];
  // Computed averages across bookmakers
  impliedProbabilities?: {
    home: number;
    draw: number;
    away: number;
    over25: number;
    under25: number;
    btts: number;
  };
}

export interface BookmakerOdds {
  key: string;
  title: string;
  markets: OddsMarket[];
}

// ─── Prediction Engine ─────────────────────────────────────────────────────────

export type MarketKey =
  | "over_0_5"
  | "over_1_5"
  | "under_4_5"
  | "under_5_5"
  | "home_over_0_5"
  | "away_over_0_5"
  | "double_chance_home_draw"
  | "double_chance_away_draw"
  | "double_chance_home_away";

export interface MarketPrediction {
  key: MarketKey;
  label: string;
  description: string;
  confidence: number; // 0–100
  modelConfidence: number; // pure statistical confidence
  marketConfidence: number; // odds-implied confidence
  dataReliability: number; // 0–1 data quality factor
  factors: ConfidenceFactor[];
}

export interface ConfidenceFactor {
  name: string;
  value: number; // contribution to confidence
  weight: number;
  detail: string;
}

export interface FixturePrediction {
  fixture: Fixture;
  generatedAt: string;
  dataQuality: DataQualityReport;
  homeForm: TeamFormStats | null;
  awayForm: TeamFormStats | null;
  homeVenueForm: VenueFormStats | null;
  awayVenueForm: VenueFormStats | null;
  h2h: HeadToHeadStats | null;
  homeStanding: StandingEntry | null;
  awayStanding: StandingEntry | null;
  odds: FixtureOdds | null;
  predictions: MarketPrediction[]; // top 7, ranked
  canPredict: boolean;
  skipReason?: string;
}

export interface DataQualityReport {
  overallScore: number; // 0–1
  hasForm: boolean;
  hasVenueForm: boolean;
  hasH2H: boolean;
  hasStandings: boolean;
  hasOdds: boolean;
  formSampleSize: number;
  h2hSampleSize: number;
  warnings: string[];
}

// ─── API Response Shapes ───────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Provider Health ───────────────────────────────────────────────────────────

export interface ProviderStatus {
  name: string;
  key: string;
  configured: boolean;
  reachable: boolean | null; // null = not yet checked
  lastChecked: string | null;
  error?: string;
}

export interface SystemHealth {
  providers: ProviderStatus[];
  checkedAt: string;
}
