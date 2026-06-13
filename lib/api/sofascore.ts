/**
 * Sofascore API client (via RapidAPI)
 *
 * Provides team form, H2H, and match data for international fixtures
 * including FIFA World Cup where football-data.org has no coverage.
 *
 * Base URL: https://sofascore.p.rapidapi.com
 * Key param: STATS_API_KEY (RapidAPI key)
 * Host param: STATS_API_HOST = sofascore.p.rapidapi.com
 */

import type { MatchResult, FixtureStats, MatchStatItem, MatchStatGroup } from "@/types";

const BASE_URL = "https://sofascore.p.rapidapi.com";

function getCredentials(): { key: string; host: string } {
  const key = process.env.STATS_API_KEY;
  const host = process.env.STATS_API_HOST ?? "sofascore.p.rapidapi.com";
  if (!key) throw new Error("STATS_API_KEY is not configured");
  return { key, host };
}

async function sofascoreFetch<T>(path: string): Promise<T> {
  const { key, host } = getCredentials();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-key": key,
      "x-rapidapi-host": host,
    },
    next: { revalidate: 1800 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sofascore ${res.status} on ${path}: ${body}`);
  }

  return res.json() as T;
}

// ─── Raw shapes ────────────────────────────────────────────────────────────────

interface SSTeam {
  id: number;
  name: string;
  nameCode?: string;
  national?: boolean;
  sport?: { id: number; slug: string };
}

interface SSEvent {
  id: number;
  startTimestamp?: number;
  status?: { type?: string; description?: string };
  homeTeam: SSTeam;
  awayTeam: SSTeam;
  homeScore?: { current?: number; display?: number };
  awayScore?: { current?: number; display?: number };
  tournament?: { name?: string };
  winnerCode?: number; // 1=home, 2=away, 3=draw
}

interface SSTeamEventsResponse {
  events?: SSEvent[];
}

interface SSSearchResponse {
  teams?: SSTeam[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isFinished(event: SSEvent): boolean {
  const type = event.status?.type?.toLowerCase() ?? "";
  return (
    type === "finished" ||
    type === "ended" ||
    type === "afterextratime" ||
    type === "afterpenalties"
  );
}

function mapEventToResult(event: SSEvent): MatchResult | null {
  if (!isFinished(event)) return null;

  const homeGoals = event.homeScore?.current ?? event.homeScore?.display;
  const awayGoals = event.awayScore?.current ?? event.awayScore?.display;

  if (homeGoals === undefined || awayGoals === undefined) return null;

  return {
    date: event.startTimestamp
      ? new Date(event.startTimestamp * 1000).toISOString()
      : new Date().toISOString(),
    homeTeamId: event.homeTeam.id,
    awayTeamId: event.awayTeam.id,
    homeGoals,
    awayGoals,
    competition: event.tournament?.name ?? "Unknown",
  };
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Find Sofascore team ID by name.
 * Uses the deprecated teams/search endpoint which still works.
 * Filters to football (sport id=1) national teams preferentially.
 */
export async function findTeamIdSS(teamName: string): Promise<number | null> {
  try {
    const data = await sofascoreFetch<SSSearchResponse>(
      `/teams/search?name=${encodeURIComponent(teamName)}`
    );

    const teams = data.teams ?? [];
    if (teams.length === 0) return null;

    // Prefer: football + national team
    const footballNational = teams.find(
      (t) => t.sport?.id === 1 && t.national === true
    );
    if (footballNational) return footballNational.id;

    // Fallback: any football team
    const football = teams.find((t) => t.sport?.id === 1);
    if (football) return football.id;

    return teams[0].id;
  } catch {
    return null;
  }
}

/**
 * Get a team's last N completed matches.
 * Returns results usable by the form engine.
 */
export async function getTeamRecentResultsSS(
  teamId: number,
  limit = 10
): Promise<MatchResult[]> {
  try {
    const results: MatchResult[] = [];
    let page = 0;

    // Fetch up to 2 pages to get enough results
    while (results.length < limit && page < 2) {
      const data = await sofascoreFetch<SSTeamEventsResponse>(
        `/teams/get-last-matches?teamId=${teamId}&pageIndex=${page}`
      );

      const events = data.events ?? [];
      if (events.length === 0) break;

      for (const event of events) {
        const result = mapEventToResult(event);
        if (result) results.push(result);
        if (results.length >= limit) break;
      }

      page++;
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Get H2H results between two teams using their Sofascore IDs.
 * Uses teams/get-last-matches for each team and finds overlapping matches.
 */
export async function getH2HSofascore(
  teamId1: number,
  teamId2: number,
  limit = 10
): Promise<MatchResult[]> {
  try {
    // Fetch last matches for team1 and filter for ones involving team2
    const data = await sofascoreFetch<SSTeamEventsResponse>(
      `/teams/get-last-matches?teamId=${teamId1}&pageIndex=0`
    );

    const h2h: MatchResult[] = [];
    for (const event of data.events ?? []) {
      const isH2H =
        (event.homeTeam.id === teamId1 && event.awayTeam.id === teamId2) ||
        (event.homeTeam.id === teamId2 && event.awayTeam.id === teamId1);

      if (isH2H) {
        const result = mapEventToResult(event);
        if (result) h2h.push(result);
        if (h2h.length >= limit) break;
      }
    }

    return h2h;
  } catch {
    return [];
  }
}

/**
 * Ping Sofascore — uses categories/list which is confirmed working.
 */
export async function pingSofascore(): Promise<boolean> {
  try {
    const data = await sofascoreFetch<{ categories?: unknown[] }>(
      "/categories/list?sport=football"
    );
    return Array.isArray((data as any).categories);
  } catch {
    return false;
  }
}
