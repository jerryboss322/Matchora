/**
 * Sportmonks API client
 *
 * Replaces TheSportsDB as the supplemental football data source.
 * Used for additional league coverage beyond football-data.org's plan limits.
 *
 * Docs: https://docs.sportmonks.com/football
 * API token: https://my.sportmonks.com/api/tokens
 */

import type { Fixture, MatchResult } from "@/types";

const BASE_URL = "https://api.sportmonks.com/v3/football";

function getApiKey(): string {
  const key = process.env.SPORTMONKS_API_KEY;
  if (!key) throw new Error("SPORTMONKS_API_KEY is not configured");
  return key;
}

async function sportmonksFetch<T>(path: string): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${path}${separator}api_token=${getApiKey()}`;

  const res = await fetch(url, {
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sportmonks API error ${res.status} on ${path}: ${body}`);
  }

  return res.json() as T;
}

// ─── Raw API shapes ────────────────────────────────────────────────────────────

type SMParticipant = {
  id: number;
  name: string;
  short_code?: string;
  image_path?: string;
  meta?: { location?: "home" | "away" };
};

interface SMFixture {
  id: number;
  name: string;
  starting_at: string;
  result_info?: string;
  state?: { short_name?: string };
  league?: { id: number; name: string };
  season?: { id: number };
  venue?: { name?: string };
  participants?: SMParticipant[];
  scores?: Array<{
    score: { goals: number; participant: "home" | "away" };
    description: string;
  }>;
}

interface SMFixturesResponse {
  data: SMFixture[];
  pagination?: { has_more: boolean };
}

// ─── Mappers ───────────────────────────────────────────────────────────────────

function resolveTeams(fixture: SMFixture): {
  home: SMParticipant | null;
  away: SMParticipant | null;
} {
  const participants: SMParticipant[] = fixture.participants ?? [];
  return {
    home: participants.find((p) => p.meta?.location === "home") ?? null,
    away: participants.find((p) => p.meta?.location === "away") ?? null,
  };
}

function resolveScore(
  fixture: SMFixture
): { home: number; away: number } | null {
  const current = fixture.scores?.find(
    (s) => s.description === "CURRENT" || s.description === "2ND_HALF"
  );
  if (!current) return null;

  // Sportmonks returns one score entry per participant
  const allScores = fixture.scores ?? [];
  const homeScore = allScores.find(
    (s) => s.score.participant === "home" && s.description === "CURRENT"
  );
  const awayScore = allScores.find(
    (s) => s.score.participant === "away" && s.description === "CURRENT"
  );

  if (!homeScore || !awayScore) return null;
  return { home: homeScore.score.goals, away: awayScore.score.goals };
}

function mapFixture(f: SMFixture): Fixture | null {
  const { home, away } = resolveTeams(f);
  if (!home || !away) return null;

  const score = resolveScore(f);
  const stateShort = f.state?.short_name?.toUpperCase() ?? "NS";
  const isFinished = stateShort === "FT" || stateShort === "AET" || stateShort === "PEN";
  const isLive = stateShort === "LIVE" || stateShort === "HT" || stateShort === "ET";

  return {
    id: `sportmonks:${f.id}`,
    sourceId: String(f.id),
    source: "sportsdb", // reuse existing source union literal for compat
    competition: {
      id: f.league?.id ?? 0,
      name: f.league?.name ?? "Unknown League",
    },
    homeTeam: {
      id: home.id,
      name: home.name,
      shortName: home.short_code,
      crest: home.image_path,
    },
    awayTeam: {
      id: away.id,
      name: away.name,
      shortName: away.short_code,
      crest: away.image_path,
    },
    kickoff: f.starting_at,
    status: isFinished ? "FINISHED" : isLive ? "IN_PLAY" : "SCHEDULED",
    score: score ?? undefined,
    venue: f.venue?.name,
  };
}

function mapToResult(f: SMFixture): MatchResult | null {
  const { home, away } = resolveTeams(f);
  if (!home || !away) return null;

  const score = resolveScore(f);
  if (!score) return null;

  const stateShort = f.state?.short_name?.toUpperCase() ?? "";
  const isFinished = stateShort === "FT" || stateShort === "AET" || stateShort === "PEN";
  if (!isFinished) return null;

  return {
    date: f.starting_at,
    homeTeamId: home.id,
    awayTeamId: away.id,
    homeGoals: score.home,
    awayGoals: score.away,
    competition: f.league?.name ?? "Unknown",
  };
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch today's fixtures from Sportmonks.
 * Uses the /fixtures/date/:date endpoint with participants and scores includes.
 */
export async function getTodaysFixturesSM(): Promise<Fixture[]> {
  const today = new Date().toISOString().split("T")[0];
  const data = await sportmonksFetch<SMFixturesResponse>(
    `/fixtures/date/${today}?include=participants;scores;state;league;venue`
  );

  return (data.data ?? [])
    .map(mapFixture)
    .filter((f): f is Fixture => f !== null);
}

/**
 * Fetch a team's last N finished fixtures for form analysis.
 */
export async function getTeamLastFixturesSM(
  teamId: number,
  limit = 10
): Promise<MatchResult[]> {
  const data = await sportmonksFetch<SMFixturesResponse>(
    `/teams/${teamId}/fixtures?include=participants;scores;state&filters=fixtureStates:FT,AET,PEN&per_page=${limit}&sort=-starting_at`
  );

  return (data.data ?? [])
    .map(mapToResult)
    .filter((r): r is MatchResult => r !== null)
    .slice(0, limit);
}

/**
 * Ping Sportmonks API to verify token and connectivity.
 */
export async function pingSpportmonks(): Promise<boolean> {
  try {
    await sportmonksFetch<unknown>("/leagues?per_page=1");
    return true;
  } catch {
    return false;
  }
}
