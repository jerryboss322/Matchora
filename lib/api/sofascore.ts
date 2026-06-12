/**
 * Sofascore API client (via RapidAPI)
 *
 * Provides team form, H2H, match statistics, standings, and odds.
 * Replaces Sportmonks as the supplemental data source.
 *
 * Base URL: https://sofascore.p.rapidapi.com
 * Subscribe at: rapidapi.com/search → "Sofascore"
 */

import type {
  MatchResult,
  HeadToHeadStats,
  FixtureStats,
  MatchStatGroup,
  MatchStatItem,
  StandingEntry,
} from "@/types";

const BASE_URL = "https://sofascore.p.rapidapi.com";

function getCredentials(): { key: string; host: string } {
  const key = process.env.STATS_API_KEY;
  const host = process.env.STATS_API_HOST ?? "sofascore.p.rapidapi.com";
  if (!key) throw new Error("STATS_API_KEY is not configured");
  return { key, host };
}

async function sofascoreFetch<T>(path: string): Promise<T> {
  const { key, host } = getCredentials();
  const url = `${BASE_URL}${path}`;

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "x-rapidapi-key": key,
      "x-rapidapi-host": host,
    },
    next: { revalidate: 1800 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sofascore API error ${res.status} on ${path}: ${body}`);
  }

  return res.json() as T;
}

// ─── Raw API shapes ────────────────────────────────────────────────────────────

interface SSEvent {
  id: number;
  slug?: string;
  startTimestamp: number;
  status?: { type: string };
  homeScore?: { current?: number };
  awayScore?: { current?: number };
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  tournament?: { name: string };
}

interface SSTeamEventsResponse {
  events?: SSEvent[];
}

interface SSH2HResponse {
  events?: SSEvent[];
  homeTeam?: { id: number; name: string };
  awayTeam?: { id: number; name: string };
}

interface SSStatisticsResponse {
  statistics?: Array<{
    period: string;
    groups: Array<{
      groupName: string;
      statisticsItems: Array<{
        name: string;
        home: string;
        away: string;
        homeValue?: number;
        awayValue?: number;
      }>;
    }>;
  }>;
}

interface SSStandingsResponse {
  standings?: Array<{
    rows?: Array<{
      position: number;
      team: { id: number; name: string; shortName?: string };
      matches: number;
      wins: number;
      draws: number;
      losses: number;
      scoresFor: number;
      scoresAgainst: number;
      points: number;
    }>;
  }>;
}

interface SSSearchResponse {
  events?: SSEvent[];
}

// ─── Mappers ───────────────────────────────────────────────────────────────────

function mapEventToResult(
  event: SSEvent,
  teamId: number
): MatchResult | null {
  if (
    event.homeScore?.current === undefined ||
    event.awayScore?.current === undefined
  )
    return null;

  const status = event.status?.type ?? "";
  if (!["finished", "ended"].includes(status.toLowerCase())) return null;

  return {
    date: new Date(event.startTimestamp * 1000).toISOString(),
    homeTeamId: event.homeTeam.id,
    awayTeamId: event.awayTeam.id,
    homeGoals: event.homeScore.current,
    awayGoals: event.awayScore.current,
    competition: event.tournament?.name ?? "Unknown",
  };
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Get recent results for a team (last N matches).
 * Uses the team's recent events endpoint.
 */
export async function getTeamRecentResultsSS(
  teamId: number,
  limit = 10
): Promise<MatchResult[]> {
  try {
    const data = await sofascoreFetch<SSTeamEventsResponse>(
      `/teams/get-last-matches?teamId=${teamId}&page=0`
    );

    return (data.events ?? [])
      .map((e) => mapEventToResult(e, teamId))
      .filter((r): r is MatchResult => r !== null)
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Get head-to-head results between two teams.
 */
export async function getH2HSofascore(
  teamId1: number,
  teamId2: number,
  limit = 10
): Promise<MatchResult[]> {
  try {
    const data = await sofascoreFetch<SSH2HResponse>(
      `/matches/get-h2h?homeTeamId=${teamId1}&awayTeamId=${teamId2}`
    );

    return (data.events ?? [])
      .map((e) => mapEventToResult(e, teamId1))
      .filter((r): r is MatchResult => r !== null)
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Get match statistics for a completed/live fixture.
 */
export async function getMatchStatsSofascore(
  matchId: number
): Promise<FixtureStats | null> {
  try {
    const data = await sofascoreFetch<SSStatisticsResponse>(
      `/matches/get-statistics?matchId=${matchId}`
    );

    if (!data.statistics?.length) return null;

    // Use ALL period stats (full match)
    const allPeriod = data.statistics.find(
      (s) => s.period === "ALL" || s.period === "all"
    ) ?? data.statistics[0];

    if (!allPeriod) return null;

    const groups: MatchStatGroup[] = allPeriod.groups.map((group) => ({
      title: group.groupName,
      key: group.groupName.toLowerCase().replace(/\s+/g, "_"),
      stats: group.statisticsItems.map((item) => {
        const hv = item.homeValue ?? parseFloat(item.home) ?? 0;
        const av = item.awayValue ?? parseFloat(item.away) ?? 0;
        const highlighted: "home" | "away" | "equal" =
          hv > av ? "home" : av > hv ? "away" : "equal";

        const stat: MatchStatItem = {
          title: item.name,
          key: item.name.toLowerCase().replace(/\s+/g, "_"),
          home: item.home,
          away: item.away,
          highlighted,
          type: item.name.toLowerCase().includes("possession")
            ? "graph"
            : "text",
        };
        return stat;
      }),
    }));

    return {
      fixtureId: String(matchId),
      homeTeamName: "",
      awayTeamName: "",
      groups,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Get standings for a tournament season.
 */
export async function getStandingsSofascore(
  tournamentId: number,
  seasonId: number
): Promise<StandingEntry[]> {
  try {
    const data = await sofascoreFetch<SSStandingsResponse>(
      `/tournaments/get-standings?tournamentId=${tournamentId}&seasonId=${seasonId}`
    );

    const table = data.standings?.[0]?.rows ?? [];

    return table.map((row) => ({
      position: row.position,
      team: {
        id: row.team.id,
        name: row.team.name,
        shortName: row.team.shortName,
      },
      played: row.matches,
      won: row.wins,
      draw: row.draws,
      lost: row.losses,
      goalsFor: row.scoresFor,
      goalsAgainst: row.scoresAgainst,
      goalDifference: row.scoresFor - row.scoresAgainst,
      points: row.points,
    }));
  } catch {
    return [];
  }
}

/**
 * Search for a match event by team names and date.
 * Returns the Sofascore match ID for use with stats/odds endpoints.
 */
export async function findMatchId(
  homeTeamName: string,
  awayTeamName: string,
  date: string // YYYY-MM-DD
): Promise<number | null> {
  try {
    const data = await sofascoreFetch<SSSearchResponse>(
      `/matches/list-by-date?date=${date}&timezone=UTC`
    );

    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();

    const normHome = normalize(homeTeamName);
    const normAway = normalize(awayTeamName);

    for (const event of data.events ?? []) {
      const h = normalize(event.homeTeam.name);
      const a = normalize(event.awayTeam.name);
      const homeMatch = h.split(" ").some(
        (t) => normHome.includes(t) && t.length > 3
      );
      const awayMatch = a.split(" ").some(
        (t) => normAway.includes(t) && t.length > 3
      );
      if (homeMatch && awayMatch) return event.id;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Find Sofascore team ID by name using the search endpoint.
 * Tries multiple response shapes since Sofascore's API shape varies.
 */
export async function findTeamId(teamName: string): Promise<number | null> {
  try {
    const data = await sofascoreFetch<Record<string, unknown>>(
      `/search?query=${encodeURIComponent(teamName)}&sport=football`
    );

    // Try multiple possible response shapes
    const d = data as any;

    // Shape 1: { results: { teams: { hits: [{ entity: { id } }] } } }
    const hits1 = d?.results?.teams?.hits ?? [];
    if (hits1.length > 0) return hits1[0]?.entity?.id ?? null;

    // Shape 2: { teams: [{ id }] }
    const hits2 = d?.teams ?? [];
    if (hits2.length > 0) return hits2[0]?.id ?? null;

    // Shape 3: { data: { teams: [{ id }] } }
    const hits3 = d?.data?.teams ?? [];
    if (hits3.length > 0) return hits3[0]?.id ?? null;

    // Shape 4: flat array
    if (Array.isArray(d) && d.length > 0) return d[0]?.id ?? null;

    return null;
  } catch {
    return null;
  }
}

/**
 * Find Sofascore team ID from a match event on a specific date.
 * More reliable than name search — finds the team via fixture matching.
 */
export async function findTeamIdFromFixture(
  teamName: string,
  opponentName: string,
  date: string
): Promise<number | null> {
  try {
    const data = await sofascoreFetch<Record<string, unknown>>(
      `/matches/list-by-date?date=${date}&timezone=UTC`
    );
    const d = data as any;
    const events: any[] = d?.events ?? d?.data ?? [];

    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
    const normTeam = normalize(teamName);
    const normOpp = normalize(opponentName);

    for (const ev of events) {
      const h = normalize(ev?.homeTeam?.name ?? "");
      const a = normalize(ev?.awayTeam?.name ?? "");
      const teamMatch =
        h.split(" ").some((t: string) => normTeam.includes(t) && t.length > 3) ||
        a.split(" ").some((t: string) => normTeam.includes(t) && t.length > 3);
      const oppMatch =
        h.split(" ").some((t: string) => normOpp.includes(t) && t.length > 3) ||
        a.split(" ").some((t: string) => normOpp.includes(t) && t.length > 3);

      if (teamMatch && oppMatch) {
        // Return the correct team's ID
        const hMatch = h.split(" ").some((t: string) => normTeam.includes(t) && t.length > 3);
        return hMatch ? ev?.homeTeam?.id ?? null : ev?.awayTeam?.id ?? null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Ping Sofascore — uses the categories/list endpoint which is always available.
 */
export async function pingSofascore(): Promise<boolean> {
  try {
    await sofascoreFetch<unknown>("/categories/list?sport=football");
    return true;
  } catch {
    return false;
  }
}
