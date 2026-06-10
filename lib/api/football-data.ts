/**
 * Football-Data.org API client
 *
 * Handles fixtures, results, standings, and head-to-head data.
 * All requests are server-side only. API key never touches the client.
 *
 * Docs: https://www.football-data.org/documentation/quickstart
 */

import type {
  Fixture,
  MatchResult,
  LeagueStandings,
  Team,
  Competition,
  Score,
  FixtureStatus,
  StandingEntry,
} from "@/types";

const BASE_URL = "https://api.football-data.org/v4";

// Competition IDs supported by football-data.org free/pro tiers
// These are the most common ones; extend as needed based on subscription level
export const SUPPORTED_COMPETITIONS = {
  PL: 2021,   // Premier League
  CL: 2001,   // Champions League
  FL1: 2015,  // Ligue 1
  BL1: 2002,  // Bundesliga
  SA: 2019,   // Serie A
  PD: 2014,   // La Liga
  PPL: 2017,  // Primeira Liga
  DED: 2003,  // Eredivisie
  BSA: 2013,  // Brasileirao
  ELC: 2016,  // Championship
  WC: 2000,   // World Cup
} as const;

function getApiKey(): string {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) throw new Error("FOOTBALL_DATA_API_KEY is not configured");
  return key;
}

async function footballDataFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "X-Auth-Token": getApiKey(),
      Accept: "application/json",
      ...options?.headers,
    },
    // Next.js cache: revalidate every 5 minutes for fixtures
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Football-Data API error ${res.status} on ${path}: ${body}`
    );
  }

  return res.json() as T;
}

// ─── Raw API response shapes ───────────────────────────────────────────────────

interface FDMatch {
  id: number;
  utcDate: string;
  status: string;
  homeTeam: { id: number; name: string; shortName?: string; crest?: string };
  awayTeam: { id: number; name: string; shortName?: string; crest?: string };
  competition: { id: number; name: string; code?: string; emblem?: string; area?: { name?: string } };
  score: {
    winner: string | null;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  venue?: string;
}

interface FDMatchesResponse {
  matches: FDMatch[];
}

interface FDStandingsResponse {
  competition: { id: number; name: string };
  season: { startDate: string; endDate: string };
  standings: Array<{
    type: string;
    table: Array<{
      position: number;
      team: { id: number; name: string; shortName?: string; crest?: string };
      playedGames: number;
      won: number;
      draw: number;
      lost: number;
      goalsFor: number;
      goalsAgainst: number;
      goalDifference: number;
      points: number;
      form?: string;
    }>;
  }>;
}

// ─── Data mappers ──────────────────────────────────────────────────────────────

function mapStatus(fdStatus: string): FixtureStatus {
  const map: Record<string, FixtureStatus> = {
    SCHEDULED: "SCHEDULED",
    LIVE: "LIVE",
    IN_PLAY: "IN_PLAY",
    PAUSED: "PAUSED",
    FINISHED: "FINISHED",
    SUSPENDED: "SUSPENDED",
    POSTPONED: "POSTPONED",
    CANCELLED: "CANCELLED",
    AWARDED: "AWARDED",
    TIMED: "SCHEDULED",
  };
  return map[fdStatus] ?? "SCHEDULED";
}

function mapMatch(match: FDMatch): Fixture {
  return {
    id: `football-data:${match.id}`,
    sourceId: String(match.id),
    source: "football-data",
    competition: {
      id: match.competition.id,
      name: match.competition.name,
      code: match.competition.code,
      emblem: match.competition.emblem,
      country: match.competition.area?.name,
    },
    homeTeam: {
      id: match.homeTeam.id,
      name: match.homeTeam.name,
      shortName: match.homeTeam.shortName,
      crest: match.homeTeam.crest,
    },
    awayTeam: {
      id: match.awayTeam.id,
      name: match.awayTeam.name,
      shortName: match.awayTeam.shortName,
      crest: match.awayTeam.crest,
    },
    kickoff: match.utcDate,
    status: mapStatus(match.status),
    score:
      match.score.fullTime.home !== null
        ? {
            home: match.score.fullTime.home,
            away: match.score.fullTime.away,
            halftime: {
              home: match.score.halfTime.home,
              away: match.score.halfTime.away,
            },
          }
        : undefined,
    venue: match.venue,
  };
}

function mapMatchToResult(match: FDMatch): MatchResult | null {
  if (
    match.score.fullTime.home === null ||
    match.score.fullTime.away === null ||
    match.status !== "FINISHED"
  ) {
    return null;
  }
  return {
    date: match.utcDate,
    homeTeamId: match.homeTeam.id,
    awayTeamId: match.awayTeam.id,
    homeGoals: match.score.fullTime.home,
    awayGoals: match.score.fullTime.away,
    competition: match.competition.name,
  };
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch today's fixtures across all supported competitions.
 * Filters to SCHEDULED and IN_PLAY matches only.
 */
export async function getTodaysFixtures(): Promise<Fixture[]> {
  const today = new Date().toISOString().split("T")[0];
  const data = await footballDataFetch<FDMatchesResponse>(
    `/matches?dateFrom=${today}&dateTo=${today}&status=SCHEDULED,IN_PLAY,PAUSED,TIMED`
  );
  return data.matches.map(mapMatch);
}

/**
 * Fetch fixtures for a specific competition on a date range.
 */
export async function getCompetitionFixtures(
  competitionId: number,
  dateFrom: string,
  dateTo: string
): Promise<Fixture[]> {
  const data = await footballDataFetch<FDMatchesResponse>(
    `/competitions/${competitionId}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&status=SCHEDULED,IN_PLAY,PAUSED,TIMED`
  );
  return data.matches.map(mapMatch);
}

/**
 * Fetch a team's last N completed matches for form analysis.
 * Returns results mapped for the confidence engine.
 */
export async function getTeamRecentResults(
  teamId: number,
  limit = 10
): Promise<MatchResult[]> {
  const data = await footballDataFetch<FDMatchesResponse>(
    `/teams/${teamId}/matches?status=FINISHED&limit=${limit}&ordering=desc`
  );
  return data.matches
    .map(mapMatchToResult)
    .filter((r): r is MatchResult => r !== null)
    .slice(0, limit);
}

/**
 * Fetch head-to-head results between two teams.
 * football-data.org provides an h2h sub-resource on match detail.
 */
export async function getHeadToHead(
  matchId: string, // football-data sourceId
  limit = 10
): Promise<MatchResult[]> {
  const data = await footballDataFetch<{
    head2head: { matches: FDMatch[] };
  }>(`/matches/${matchId}/head2head?limit=${limit}`);

  return data.head2head.matches
    .map(mapMatchToResult)
    .filter((r): r is MatchResult => r !== null);
}

/**
 * Fetch current standings for a competition.
 */
export async function getStandings(
  competitionId: number
): Promise<LeagueStandings | null> {
  try {
    const data = await footballDataFetch<FDStandingsResponse>(
      `/competitions/${competitionId}/standings`
    );

    // Use the TOTAL table (as opposed to HOME or AWAY)
    const totalTable = data.standings.find((s) => s.type === "TOTAL");
    if (!totalTable) return null;

    return {
      competitionId: data.competition.id,
      season: data.season.startDate.substring(0, 4),
      table: totalTable.table.map((entry) => ({
        position: entry.position,
        team: {
          id: entry.team.id,
          name: entry.team.name,
          shortName: entry.team.shortName,
          crest: entry.team.crest,
        },
        played: entry.playedGames,
        won: entry.won,
        draw: entry.draw,
        lost: entry.lost,
        goalsFor: entry.goalsFor,
        goalsAgainst: entry.goalsAgainst,
        goalDifference: entry.goalDifference,
        points: entry.points,
        form: entry.form,
      })),
    };
  } catch {
    // Standings may not be available for all competitions
    return null;
  }
}

/**
 * Ping the API to verify credentials and connectivity.
 */
export async function pingFootballData(): Promise<boolean> {
  try {
    await footballDataFetch("/competitions?plan=TIER_ONE", {
      next: { revalidate: 0 },
    });
    return true;
  } catch {
    return false;
  }
}
