/**
 * Match Stats API client
 *
 * Fetches detailed match statistics: xG, shots, possession, passes,
 * tackles, duels, discipline, physical metrics.
 *
 * Uses the football stats endpoint available on RapidAPI.
 * Configure STATS_API_KEY and STATS_API_HOST in your environment.
 *
 * Get your key at: https://rapidapi.com
 */

import type { FixtureStats, MatchStatGroup, MatchStatItem } from "@/types";

const BASE_URL = "https://api-football-v1.p.rapidapi.com/v3";

function getCredentials(): { key: string; host: string } {
  const key = process.env.STATS_API_KEY;
  const host = process.env.STATS_API_HOST ?? "api-football-v1.p.rapidapi.com";
  if (!key) throw new Error("STATS_API_KEY is not configured");
  return { key, host };
}

async function statsFetch<T>(path: string): Promise<T> {
  const { key, host } = getCredentials();
  const url = `${BASE_URL}${path}`;

  const res = await fetch(url, {
    headers: {
      "x-rapidapi-key": key,
      "x-rapidapi-host": host,
    },
    next: { revalidate: 1800 }, // stats refresh every 30 minutes
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Stats API error ${res.status} on ${path}: ${body}`);
  }

  return res.json() as T;
}

// ─── Raw API shapes ────────────────────────────────────────────────────────────

interface APIFootballStatsResponse {
  response: Array<{
    team: { id: number; name: string };
    statistics: Array<{
      type: string;
      value: string | number | null;
    }>;
  }>;
}

interface APIFootballFixtureResponse {
  response: Array<{
    fixture: {
      id: number;
      date: string;
      status: { short: string };
    };
    teams: {
      home: { id: number; name: string };
      away: { id: number; name: string };
    };
    goals: { home: number | null; away: number | null };
  }>;
}

// ─── Mappers ───────────────────────────────────────────────────────────────────

/**
 * Map API-Football statistics array into our grouped MatchStatGroup format.
 * Groups stats by category for display.
 */
function mapToStatGroups(
  homeStats: Array<{ type: string; value: string | number | null }>,
  awayStats: Array<{ type: string; value: string | number | null }>
): MatchStatGroup[] {
  // Build a map of stat type → { home, away }
  const awayMap = new Map(awayStats.map((s) => [s.type, s.value]));

  // Categorize stats into groups
  const shotKeys = [
    "Total Shots", "Shots on Goal", "Shots off Goal",
    "Blocked Shots", "Shots insidebox", "Shots outsidebox",
  ];
  const possessionKeys = ["Ball Possession"];
  const xgKeys = ["expected_goals"];
  const passKeys = [
    "Total passes", "Passes accurate", "Passes %",
  ];
  const defenceKeys = [
    "Fouls", "Yellow Cards", "Red Cards",
    "Goalkeeper Saves", "Total Duels", "Duels Won",
  ];
  const otherKeys = ["Corner Kicks", "Offsides"];

  const groups: MatchStatGroup[] = [
    { title: "Top Stats", key: "top_stats", stats: [] },
    { title: "Shots", key: "shots", stats: [] },
    { title: "Passes", key: "passes", stats: [] },
    { title: "Defence", key: "defence", stats: [] },
    { title: "Other", key: "other", stats: [] },
  ];

  const groupMap: Record<string, MatchStatGroup> = {
    top_stats: groups[0],
    shots: groups[1],
    passes: groups[2],
    defence: groups[3],
    other: groups[4],
  };

  for (const stat of homeStats) {
    const away = awayMap.get(stat.type) ?? null;
    const homeVal = stat.value;

    // Determine highlighted winner
    const homeNum = typeof homeVal === "string" ? parseFloat(homeVal) : homeVal;
    const awayNum = typeof away === "string" ? parseFloat(String(away)) : away;
    let highlighted: "home" | "away" | "equal" = "equal";
    if (homeNum !== null && awayNum !== null && !isNaN(homeNum) && !isNaN(awayNum)) {
      if (homeNum > awayNum) highlighted = "home";
      else if (awayNum > homeNum) highlighted = "away";
    }

    const item: MatchStatItem = {
      title: stat.type,
      key: stat.type.toLowerCase().replace(/\s+/g, "_"),
      home: homeVal,
      away,
      highlighted,
      type: "text",
    };

    // Route to the right group
    if (shotKeys.includes(stat.type)) {
      groupMap.shots.stats.push(item);
      // Also add key shots to top_stats
      if (["Total Shots", "Shots on Goal"].includes(stat.type)) {
        groupMap.top_stats.stats.push(item);
      }
    } else if (possessionKeys.includes(stat.type)) {
      groupMap.top_stats.stats.push({ ...item, type: "graph" });
    } else if (xgKeys.includes(stat.type)) {
      groupMap.top_stats.stats.push(item);
    } else if (passKeys.includes(stat.type)) {
      groupMap.passes.stats.push(item);
    } else if (defenceKeys.includes(stat.type)) {
      groupMap.defence.stats.push(item);
    } else {
      groupMap.other.stats.push(item);
    }
  }

  // Remove empty groups
  return groups.filter((g) => g.stats.length > 0);
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch match statistics for a completed or live fixture.
 * Requires the API-Football fixture ID (numeric).
 *
 * Returns null if stats are not yet available (pre-match).
 */
export async function getMatchStats(
  fixtureId: number
): Promise<FixtureStats | null> {
  try {
    const data = await statsFetch<APIFootballStatsResponse>(
      `/fixtures/statistics?fixture=${fixtureId}`
    );

    if (!data.response || data.response.length < 2) return null;

    const homeTeam = data.response[0];
    const awayTeam = data.response[1];

    const groups = mapToStatGroups(
      homeTeam.statistics,
      awayTeam.statistics
    );

    if (groups.length === 0) return null;

    return {
      fixtureId: String(fixtureId),
      homeTeamName: homeTeam.team.name,
      awayTeamName: awayTeam.team.name,
      groups,
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Search for an API-Football fixture ID by date and team names.
 * Used to cross-reference football-data.org fixtures with API-Football.
 */
export async function findAPIFootballFixtureId(
  homeTeamName: string,
  awayTeamName: string,
  date: string // YYYY-MM-DD
): Promise<number | null> {
  try {
    const data = await statsFetch<APIFootballFixtureResponse>(
      `/fixtures?date=${date}`
    );

    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();

    const normHome = normalize(homeTeamName);
    const normAway = normalize(awayTeamName);

    for (const item of data.response) {
      const h = normalize(item.teams.home.name);
      const a = normalize(item.teams.away.name);
      // Token overlap matching
      const homeMatch = h.split(" ").some((t) => normHome.includes(t) && t.length > 3);
      const awayMatch = a.split(" ").some((t) => normAway.includes(t) && t.length > 3);
      if (homeMatch && awayMatch) return item.fixture.id;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Ping the stats API.
 */
export async function pingStatsApi(): Promise<boolean> {
  try {
    await statsFetch<unknown>("/status");
    return true;
  } catch {
    return false;
  }
}
