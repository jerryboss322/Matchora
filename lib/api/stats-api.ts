/**
 * Free API Live Football Data client (RapidAPI)
 *
 * Provides match statistics, fixtures, H2H, standings, and team form.
 * This is a broader source than football-data.org — covers more leagues
 * including World Cup and international competitions.
 *
 * Base URL: https://free-api-live-football-data.p.rapidapi.com
 * Get key at: https://rapidapi.com/Creativesdev/api/free-api-live-football-data
 */

import type { FixtureStats, MatchStatGroup, MatchStatItem } from "@/types";

const BASE_URL = "https://free-api-live-football-data.p.rapidapi.com";

function getCredentials(): { key: string; host: string } {
  const key = process.env.STATS_API_KEY;
  const host =
    process.env.STATS_API_HOST ??
    "free-api-live-football-data.p.rapidapi.com";
  if (!key) throw new Error("STATS_API_KEY is not configured");
  return { key, host };
}

async function statsFetch<T>(path: string): Promise<T> {
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
    throw new Error(`Stats API error ${res.status} on ${path}: ${body}`);
  }

  return res.json() as T;
}

// ─── Raw API shapes ────────────────────────────────────────────────────────────

interface RawStatItem {
  type: string;
  home: string | number | null;
  away: string | number | null;
}

interface RawStatsResponse {
  status: string;
  response?: {
    stats?: RawStatItem[];
  };
}

interface RawFixturesByDate {
  status: string;
  response?: {
    events?: Array<{
      id: string;
      homeTeam: { id: string; name: string };
      awayTeam: { id: string; name: string };
      league: { id: string; name: string };
      date: string;
      time: string;
      status: string;
    }>;
  };
}

// ─── Stat grouping ─────────────────────────────────────────────────────────────

const STAT_GROUPS: Record<string, string> = {
  "Ball Possession": "top_stats",
  "Total Shots": "shots",
  "Shots on Goal": "shots",
  "Shots off Goal": "shots",
  "Blocked Shots": "shots",
  "Shots insidebox": "shots",
  "Shots outsidebox": "shots",
  "expected_goals": "top_stats",
  "Total passes": "passes",
  "Passes accurate": "passes",
  "Passes %": "passes",
  "Fouls": "defence",
  "Yellow Cards": "defence",
  "Red Cards": "defence",
  "Goalkeeper Saves": "defence",
  "Corner Kicks": "other",
  "Offsides": "other",
};

function mapStats(stats: RawStatItem[]): MatchStatGroup[] {
  const groups: Record<string, MatchStatGroup> = {
    top_stats: { title: "Top Stats", key: "top_stats", stats: [] },
    shots: { title: "Shots", key: "shots", stats: [] },
    passes: { title: "Passes", key: "passes", stats: [] },
    defence: { title: "Defence", key: "defence", stats: [] },
    other: { title: "Other", key: "other", stats: [] },
  };

  for (const stat of stats) {
    const homeNum =
      typeof stat.home === "string" ? parseFloat(stat.home) : stat.home;
    const awayNum =
      typeof stat.away === "string" ? parseFloat(stat.away) : stat.away;

    let highlighted: "home" | "away" | "equal" = "equal";
    if (
      homeNum !== null &&
      awayNum !== null &&
      !isNaN(homeNum as number) &&
      !isNaN(awayNum as number)
    ) {
      if ((homeNum as number) > (awayNum as number)) highlighted = "home";
      else if ((awayNum as number) > (homeNum as number)) highlighted = "away";
    }

    const item: MatchStatItem = {
      title: stat.type,
      key: stat.type.toLowerCase().replace(/\s+/g, "_"),
      home: stat.home,
      away: stat.away,
      highlighted,
      type: stat.type === "Ball Possession" ? "graph" : "text",
    };

    const groupKey = STAT_GROUPS[stat.type] ?? "other";
    groups[groupKey].stats.push(item);
  }

  return Object.values(groups).filter((g) => g.stats.length > 0);
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch all match statistics by event ID.
 * eventId comes from this same API's fixture list.
 */
export async function getMatchStats(
  eventId: number
): Promise<FixtureStats | null> {
  try {
    const data = await statsFetch<RawStatsResponse>(
      `/football-get-match-event-all-stats?eventid=${eventId}`
    );

    if (data.status !== "success" || !data.response?.stats?.length) {
      return null;
    }

    const groups = mapStats(data.response.stats);
    if (groups.length === 0) return null;

    return {
      fixtureId: String(eventId),
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
 * Find event ID by date from this API's fixture list.
 */
export async function findEventId(
  homeTeamName: string,
  awayTeamName: string,
  date: string // YYYY-MM-DD
): Promise<number | null> {
  try {
    const data = await statsFetch<RawFixturesByDate>(
      `/football-get-matches-by-date?date=${date}`
    );

    if (data.status !== "success" || !data.response?.events) return null;

    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();

    const normHome = normalize(homeTeamName);
    const normAway = normalize(awayTeamName);

    for (const event of data.response.events) {
      const h = normalize(event.homeTeam.name);
      const a = normalize(event.awayTeam.name);
      const homeMatch = h.split(" ").some(
        (t) => normHome.includes(t) && t.length > 3
      );
      const awayMatch = a.split(" ").some(
        (t) => normAway.includes(t) && t.length > 3
      );
      if (homeMatch && awayMatch) return parseInt(event.id, 10);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Ping — use the popular leagues endpoint, lightweight and always available.
 */
export async function pingStatsApi(): Promise<boolean> {
  try {
    const data = await statsFetch<{ status: string }>(
      "/football-get-popular-leagues"
    );
    return data.status === "success";
  } catch {
    return false;
  }
}
