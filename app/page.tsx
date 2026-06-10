/**
 * Home page — Upcoming Fixtures (today + next 2 days)
 *
 * Server component: fetches fixtures directly.
 * Groups by date first, then by competition within each date.
 */

import type { Fixture, ApiResponse } from "@/types";
import { FixtureCard } from "@/components/fixtures/FixtureCard";

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

type CompetitionGroup = {
  name: string;
  country?: string;
  emblem?: string;
  fixtures: Fixture[];
};

type DateGroup = {
  dateLabel: string;
  dateKey: string;
  competitions: Map<string, CompetitionGroup>;
  total: number;
};

function groupFixtures(fixtures: Fixture[]): DateGroup[] {
  const dateMap = new Map<string, DateGroup>();

  for (const f of fixtures) {
    const dateKey = f.kickoff.substring(0, 10); // YYYY-MM-DD
    const dateObj = new Date(f.kickoff);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const dayAfter = new Date(today);
    dayAfter.setDate(today.getDate() + 2);

    // Human-readable date label
    let dateLabel: string;
    if (dateKey === today.toISOString().split("T")[0]) {
      dateLabel = "Today";
    } else if (dateKey === tomorrow.toISOString().split("T")[0]) {
      dateLabel = "Tomorrow";
    } else {
      dateLabel = dateObj.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
    }

    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, {
        dateLabel,
        dateKey,
        competitions: new Map(),
        total: 0,
      });
    }

    const dateGroup = dateMap.get(dateKey)!;
    const compKey = String(f.competition.id);

    if (!dateGroup.competitions.has(compKey)) {
      dateGroup.competitions.set(compKey, {
        name: f.competition.name,
        country: f.competition.country,
        emblem: f.competition.emblem,
        fixtures: [],
      });
    }

    dateGroup.competitions.get(compKey)!.fixtures.push(f);
    dateGroup.total++;
  }

  return Array.from(dateMap.values()).sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey)
  );
}

export default async function FixturesPage() {
  const fixtures = await fetchFixtures();
  const dateGroups = groupFixtures(fixtures);
  const totalFixtures = fixtures.length;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Page header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <span className="data-label">Football Analytics</span>
          <span style={{ color: "var(--surface-border)" }}>—</span>
          <span className="data-label" style={{ color: "var(--accent-primary)" }}>
            3-Day Schedule
          </span>
        </div>
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          Upcoming Fixtures
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Today &amp; next 2 days &bull;{" "}
          {totalFixtures} match{totalFixtures !== 1 ? "es" : ""} found
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
            No scheduled matches found for the next 3 days. This may be due to
            API connectivity issues or a blank fixture window.
          </p>
          <p className="text-xs mt-4" style={{ color: "var(--text-tertiary)" }}>
            Check System Status to verify API provider health.
          </p>
        </div>
      )}

      {/* Date-grouped fixture listings */}
      {dateGroups.map((dateGroup) => (
        <section key={dateGroup.dateKey} className="mb-12">
          {/* Date header */}
          <div className="flex items-center gap-4 mb-6">
            <div>
              <h2
                className="text-xl font-bold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                {dateGroup.dateLabel}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                {new Date(dateGroup.dateKey).toLocaleDateString("en-GB", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}{" "}
                &bull; {dateGroup.total} match{dateGroup.total !== 1 ? "es" : ""}
              </p>
            </div>
            <div
              className="flex-1 h-px"
              style={{ background: "var(--surface-border)" }}
            />
            <span
              className="font-mono text-xs"
              style={{ color: "var(--text-tertiary)" }}
            >
              {Array.from(dateGroup.competitions.values()).length} competition
              {Array.from(dateGroup.competitions.values()).length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Competition groups within this date */}
          {Array.from(dateGroup.competitions.entries()).map(
            ([compId, group]) => (
              <div key={compId} className="mb-8">
                {/* Competition header */}
                <div
                  className="flex items-center gap-3 mb-4 pb-2 border-b"
                  style={{ borderColor: "var(--surface-border)" }}
                >
                  {group.emblem && (
                    <img
                      src={group.emblem}
                      alt=""
                      className="w-5 h-5 object-contain opacity-80"
                    />
                  )}
                  <h3
                    className="font-semibold text-sm"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {group.name}
                  </h3>
                  {group.country && (
                    <span className="data-label">{group.country}</span>
                  )}
                  <span
                    className="ml-auto font-mono text-xs"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    {group.fixtures.length} fixture
                    {group.fixtures.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Fixture grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {group.fixtures.map((fixture) => (
                    <FixtureCard key={fixture.id} fixture={fixture} />
                  ))}
                </div>
              </div>
            )
          )}
        </section>
      ))}
    </div>
  );
}
