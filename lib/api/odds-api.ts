/**
 * Odds-API.io client
 *
 * Fetches bookmaker odds for football fixtures.
 * Used to derive implied probabilities and market confidence signals.
 *
 * Docs: https://the-odds-api.com/lossless-odds-api/
 */

import type { FixtureOdds, BookmakerOdds, OddsMarket } from "@/types";

const BASE_URL = "https://api.the-odds-api.com/v4";

// Sport key for soccer on odds-api.io
const SOCCER_SPORT = "soccer";

// Regions and markets we care about
const REGIONS = "uk,eu,us";
const MARKETS = "h2h,totals,btts";

function getApiKey(): string {
  const key = process.env.ODDS_API_KEY;
  if (!key) throw new Error("ODDS_API_KEY is not configured");
  return key;
}

async function oddsApiFetch<T>(path: string): Promise<T> {
  const separator = path.includes("?") ? "&" : "?";
  const url = `${BASE_URL}${path}${separator}apiKey=${getApiKey()}`;

  const res = await fetch(url, {
    next: { revalidate: 600 }, // odds refresh every 10 minutes
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Odds API error ${res.status} on ${path}: ${body}`);
  }

  return res.json() as T;
}

// ─── Raw API shapes ────────────────────────────────────────────────────────────

interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Array<{
    key: string;
    title: string;
    last_update: string;
    markets: Array<{
      key: string;
      last_update: string;
      outcomes: Array<{
        name: string;
        price: number;
        point?: number;
      }>;
    }>;
  }>;
}

interface OddsApiSport {
  key: string;
  group: string;
  title: string;
  description: string;
  active: boolean;
  has_outrights: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Convert decimal odds to implied probability.
 * Removes the bookmaker margin (overround) for a fairer reading.
 */
function decimalToImplied(odds: number): number {
  return 1 / odds;
}

/**
 * Remove bookmaker overround from a set of implied probabilities.
 * Returns normalized probabilities that sum to 1.
 */
function normalizeImplied(implied: number[]): number[] {
  const total = implied.reduce((a, b) => a + b, 0);
  return implied.map((p) => p / total);
}

/**
 * Average a market's prices across bookmakers.
 * Returns null if no bookmakers carry the market.
 */
function averageMarketOdds(
  bookmakers: OddsApiEvent["bookmakers"],
  marketKey: string,
  outcomeName: string,
  point?: number
): number | null {
  const prices: number[] = [];

  for (const bk of bookmakers) {
    const market = bk.markets.find((m) => m.key === marketKey);
    if (!market) continue;

    const outcome = market.outcomes.find(
      (o) =>
        o.name === outcomeName &&
        (point === undefined || o.point === point)
    );
    if (outcome) prices.push(outcome.price);
  }

  if (prices.length === 0) return null;
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

/**
 * Compute average implied probabilities from raw event data.
 */
function computeImpliedProbabilities(
  event: OddsApiEvent
): FixtureOdds["impliedProbabilities"] | undefined {
  const homeOdds = averageMarketOdds(event.bookmakers, "h2h", event.home_team);
  const drawOdds = averageMarketOdds(event.bookmakers, "h2h", "Draw");
  const awayOdds = averageMarketOdds(event.bookmakers, "h2h", event.away_team);

  if (homeOdds === null || drawOdds === null || awayOdds === null) {
    return undefined;
  }

  const [normHome, normDraw, normAway] = normalizeImplied([
    decimalToImplied(homeOdds),
    decimalToImplied(drawOdds),
    decimalToImplied(awayOdds),
  ]);

  // Over/Under 2.5 implied probability
  const over25Odds = averageMarketOdds(event.bookmakers, "totals", "Over", 2.5);
  const under25Odds = averageMarketOdds(event.bookmakers, "totals", "Under", 2.5);

  let normOver25 = 0.5;
  let normUnder25 = 0.5;
  if (over25Odds !== null && under25Odds !== null) {
    [normOver25, normUnder25] = normalizeImplied([
      decimalToImplied(over25Odds),
      decimalToImplied(under25Odds),
    ]);
  }

  // BTTS implied probability
  const bttsYesOdds = averageMarketOdds(event.bookmakers, "btts", "Yes");
  const bttsNoOdds = averageMarketOdds(event.bookmakers, "btts", "No");

  let normBtts = 0.45; // neutral default when data absent
  if (bttsYesOdds !== null && bttsNoOdds !== null) {
    [normBtts] = normalizeImplied([
      decimalToImplied(bttsYesOdds),
      decimalToImplied(bttsNoOdds),
    ]);
  }

  return {
    home: normHome,
    draw: normDraw,
    away: normAway,
    over25: normOver25,
    under25: normUnder25,
    btts: normBtts,
  };
}

function mapEvent(event: OddsApiEvent): FixtureOdds {
  const bookmakers: BookmakerOdds[] = event.bookmakers.map((bk) => ({
    key: bk.key,
    title: bk.title,
    markets: bk.markets.map((m) => ({
      key: m.key,
      name: m.key,
      outcomes: m.outcomes.map((o) => ({
        name: o.name,
        price: o.price,
        point: o.point,
      })),
    })),
  }));

  return {
    fixtureId: event.id,
    homeTeamName: event.home_team,
    awayTeamName: event.away_team,
    commenceTime: event.commence_time,
    bookmakers,
    impliedProbabilities: computeImpliedProbabilities(event),
  };
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch all upcoming soccer odds events for a given date.
 * Returns all events the API provides — caller filters by fixture.
 */
export async function getUpcomingSoccerOdds(): Promise<FixtureOdds[]> {
  // Get all active soccer sports first, then fetch odds for soccer
  const sports = await oddsApiFetch<OddsApiSport[]>("/sports?all=false");
  const soccerSports = sports
    .filter((s) => s.group.toLowerCase() === "soccer" && s.active)
    .map((s) => s.key);

  // For the most common leagues we know the sport key directly;
  // fallback to generic soccer_* prefix
  const oddsPromises = soccerSports.slice(0, 5).map((sportKey) =>
    oddsApiFetch<OddsApiEvent[]>(
      `/sports/${sportKey}/odds?regions=${REGIONS}&markets=${MARKETS}&oddsFormat=decimal`
    ).catch(() => [] as OddsApiEvent[])
  );

  const results = await Promise.all(oddsPromises);
  const allEvents = results.flat();

  return allEvents.map(mapEvent);
}

/**
 * Match a fixture to an odds event by team name similarity.
 * Odds-API uses its own team naming convention; this does fuzzy matching.
 */
export function matchFixtureToOdds(
  homeTeamName: string,
  awayTeamName: string,
  oddsEvents: FixtureOdds[]
): FixtureOdds | null {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/fc|afc|sc|cf|united|city|utd/gi, "")
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const normHome = normalize(homeTeamName);
  const normAway = normalize(awayTeamName);

  // Score each event by how well both teams match
  let bestMatch: FixtureOdds | null = null;
  let bestScore = 0;

  for (const event of oddsEvents) {
    const eHome = normalize(event.homeTeamName);
    const eAway = normalize(event.awayTeamName);

    const homeScore = nameSimilarity(normHome, eHome);
    const awayScore = nameSimilarity(normAway, eAway);
    const combined = homeScore + awayScore;

    if (combined > bestScore && combined > 1.2) {
      bestScore = combined;
      bestMatch = event;
    }
  }

  return bestMatch;
}

/**
 * Simple token overlap similarity between two normalized team name strings.
 * Returns a score between 0 and 2.
 */
function nameSimilarity(a: string, b: string): number {
  const tokensA = a.split(" ").filter(Boolean);
  const tokensB = b.split(" ").filter(Boolean);

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setB = new Set(tokensB);
  const overlap = tokensA.filter((t) => setB.has(t)).length;
  return overlap / Math.max(tokensA.length, tokensB.length);
}

/**
 * Verify API key works.
 */
export async function pingOddsApi(): Promise<boolean> {
  try {
    await oddsApiFetch<OddsApiSport[]>("/sports");
    return true;
  } catch {
    return false;
  }
}
