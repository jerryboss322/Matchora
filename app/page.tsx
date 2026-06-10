/**
 * Home page — Today's Fixtures
 *
 * Server component: fetches today's fixtures directly.
 * Groups by competition for better readability.
 */

import type { Fixture, ApiResponse } from "@/types";
import { FixtureCard } from "@/components/fixtures/FixtureCard";

// Fetch from our own backend API (server-side)
async function fetchFixtures(): Promise<Fixture[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/fixtures`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const json: ApiResponse<Fixture[]> = await res.json();
    return json.success ? json.data : [];
  } catch {
    return [];
  }
}

function groupByCompetition(
  fixtures: Fixture[]
): Map<string, { name: string; country?: string; emblem?: string; fixtures: Fixture[] }> {
  const groups = new Map<string, { name: string; country?: string; emblem?: string; fixtures: Fixture[] }>();

  for (const f of fixtures) {
    const key = String(f.competition.id);
    if (!groups.has(key)) {
      groups.set(key, {
        name: f.competition.name,
        country: f.competition.country,
        emblem: f.competition.emblem,
        fixtures: [],
      });
    }
    groups.get(key)!.fixtures.push(f);
  }

  return groups;
}

export default async function FixturesPage() {
  const fixtures = await fetchFixtures();
  const grouped = groupByCompetition(fixtures);

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Page header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <span className="data-label">Football Analytics</span>
          <span style={{ color: "var(--surface-border)" }}>—</span>
          <span className="data-label" style={{ color: "var(--accent-primary)" }}>
            Live
          </span>
        </div>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Today&apos;s Fixtures
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          {today} &bull; {fixtures.length} match{fixtures.length !== 1 ? "es" : ""} found
        </p>
      </div>

      {/* No fixtures state */}
      {fixtures.length === 0 && (
        <div
          className="panel p-12 text-center"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto mb-4 opacity-30"
            style={{ color: "var(--text-secondary)" }}
          >
            <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" />
            <path
              d="M24 14v10l6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <p
            className="font-semibold text-lg mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            No fixtures available
          </p>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            No scheduled matches were found for today. This may be due to API
            connectivity issues or no fixtures scheduled.
          </p>
          <p className="text-xs mt-4" style={{ color: "var(--text-tertiary)" }}>
            Check System Status to verify API provider health.
          </p>
        </div>
      )}

      {/* Grouped fixture listings */}
      {Array.from(grouped.entries()).map(([competitionId, group]) => (
        <section key={competitionId} className="mb-10">
          {/* Competition header */}
          <div
            className="flex items-center gap-3 mb-4 pb-3 border-b"
            style={{ borderColor: "var(--surface-border)" }}
          >
            {group.emblem && (
              <img
                src={group.emblem}
                alt=""
                className="w-6 h-6 object-contain opacity-80"
              />
            )}
            <h2
              className="font-semibold text-base"
              style={{ color: "var(--text-primary)" }}
            >
              {group.name}
            </h2>
            {group.country && (
              <span className="data-label">{group.country}</span>
            )}
            <span
              className="ml-auto font-mono text-xs"
              style={{ color: "var(--text-tertiary)" }}
            >
              {group.fixtures.length} fixture{group.fixtures.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Fixture grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {group.fixtures.map((fixture) => (
              <FixtureCard key={fixture.id} fixture={fixture} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
