/**
 * Home page — Upcoming Fixtures with date filter tabs
 */

import type { Fixture, ApiResponse } from "@/types";
import { FixtureCard } from "@/components/fixtures/FixtureCard";
import { FixtureTabs } from "@/components/fixtures/FixtureTabs";

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

export default async function FixturesPage() {
  const fixtures = await fetchFixtures();

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="data-label">Football Analytics</span>
          <span style={{ color: "var(--surface-border)" }}>—</span>
          <span className="data-label" style={{ color: "var(--accent-primary)" }}>
            3-Day Schedule
          </span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          Upcoming Fixtures
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          {fixtures.length} match{fixtures.length !== 1 ? "es" : ""} across today &amp; next 2 days
        </p>
      </div>

      <FixtureTabs fixtures={fixtures} />
    </div>
  );
}
