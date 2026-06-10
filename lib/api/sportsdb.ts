/**
 * TheSportsDB API client
 *
 * Used as a supplemental source for league coverage and additional fixture data.
 * Free tier (v1) is rate-limited; patreon tier (v2) has more endpoints.
 *
 * Docs: https://www.thesportsdb.com/api.php
 */

import type { Fixture, MatchResult } from "@/types";

// v1 is available without a paid key; v2 requires Patreon
const BASE_URL_V1 = "https://www.thesportsdb.com/api/v1/json/3"; // public key

function getApiKey(): string {
  // Fall back to the free public key "3" if none is configured
  return process.env.SPORTSDB_API_KEY ?? "3";
}

async function sportsDbFetch<T>(path: string): Promise<T> {
  const key = getApiKey();
  const url = `https://www.thesportsdb.com/api/v1/json/${key}${path}`;
  const res = await fetch(url, {
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`TheSportsDB error ${res.status} on ${path}`);
  }

  return res.json() as T;
}

// ─── Raw shapes ────────────────────────────────────────────────────────────────

interface SDBEvent {
  idEvent: string;
  strEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  idHomeTeam: string;
  idAwayTeam: string;
  idLeague: string;
  strLeague: string;
  strSeason: string;
  dateEvent: string;
  strTime: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strStatus: string;
  strVenue?: string;
}

// ─── Mappers ───────────────────────────────────────────────────────────────────

function mapSDBEvent(event: SDBEvent): Fixture {
  const kickoff =
    event.dateEvent && event.strTime
      ? new Date(`${event.dateEvent}T${event.strTime}Z`).toISOString()
      : new Date(event.dateEvent).toISOString();

  const homeGoals =
    event.intHomeScore !== null ? parseInt(event.intHomeScore, 10) : null;
  const awayGoals =
    event.intAwayScore !== null ? parseInt(event.intAwayScore, 10) : null;

  return {
    id: `sportsdb:${event.idEvent}`,
    sourceId: event.idEvent,
    source: "sportsdb",
    competition: {
      id: parseInt(event.idLeague, 10),
      name: event.strLeague,
    },
    homeTeam: {
      id: parseInt(event.idHomeTeam, 10),
      name: event.strHomeTeam,
    },
    awayTeam: {
      id: parseInt(event.idAwayTeam, 10),
      name: event.strAwayTeam,
    },
    kickoff,
    status:
      event.strStatus === "Match Finished"
        ? "FINISHED"
        : event.strStatus === "Not Started"
        ? "SCHEDULED"
        : "SCHEDULED",
    score:
      homeGoals !== null && awayGoals !== null
        ? { home: homeGoals, away: awayGoals }
        : undefined,
    venue: event.strVenue,
  };
}

function mapSDBEventToResult(event: SDBEvent): MatchResult | null {
  const homeGoals =
    event.intHomeScore !== null ? parseInt(event.intHomeScore, 10) : null;
  const awayGoals =
    event.intAwayScore !== null ? parseInt(event.intAwayScore, 10) : null;

  if (homeGoals === null || awayGoals === null) return null;

  return {
    date: event.dateEvent,
    homeTeamId: parseInt(event.idHomeTeam, 10),
    awayTeamId: parseInt(event.idAwayTeam, 10),
    homeGoals,
    awayGoals,
    competition: event.strLeague,
  };
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Get upcoming events for a league by league ID.
 */
export async function getLeagueNextEvents(leagueId: number): Promise<Fixture[]> {
  const data = await sportsDbFetch<{ events: SDBEvent[] | null }>(
    `/eventsnextleague.php?id=${leagueId}`
  );
  return (data.events ?? []).map(mapSDBEvent);
}

/**
 * Get last 5 events for a team.
 */
export async function getTeamLastEvents(teamId: number): Promise<MatchResult[]> {
  const data = await sportsDbFetch<{ results: SDBEvent[] | null }>(
    `/eventslast.php?id=${teamId}`
  );
  return (data.results ?? [])
    .map(mapSDBEventToResult)
    .filter((r): r is MatchResult => r !== null);
}

/**
 * Ping TheSportsDB.
 */
export async function pingSportsDb(): Promise<boolean> {
  try {
    await sportsDbFetch<unknown>("/all_sports.php");
    return true;
  } catch {
    return false;
  }
}
