"use client";

import { useState, useMemo } from "react";
import type { Fixture } from "@/types";
import { FixtureCard } from "@/components/fixtures/FixtureCard";

interface Props {
  fixtures: Fixture[];
}

type Tab = { key: string; label: string; sublabel: string; count: number };

export function FixtureTabs({ fixtures }: Props) {
  // Build date tabs from fixture data
  const tabs = useMemo<Tab[]>(() => {
    const today = new Date();
    const days: Tab[] = [];

    for (let i = 0; i <= 2; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const key = d.toISOString().split("T")[0];
      const count = fixtures.filter((f) => f.kickoff.startsWith(key)).length;

      let label: string;
      if (i === 0) label = "Today";
      else if (i === 1) label = "Tomorrow";
      else
        label = d.toLocaleDateString("en-GB", { weekday: "long" });

      const sublabel = d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });

      days.push({ key, label, sublabel, count });
    }
    return days;
  }, [fixtures]);

  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.key ?? "");

  // Fixtures for the active date, grouped by competition
  const grouped = useMemo(() => {
    const filtered = fixtures.filter((f) => f.kickoff.startsWith(activeTab));
    const map = new Map<
      string,
      { name: string; country?: string; emblem?: string; fixtures: Fixture[] }
    >();
    for (const f of filtered) {
      const key = String(f.competition.id);
      if (!map.has(key)) {
        map.set(key, {
          name: f.competition.name,
          country: f.competition.country,
          emblem: f.competition.emblem,
          fixtures: [],
        });
      }
      map.get(key)!.fixtures.push(f);
    }
    return map;
  }, [fixtures, activeTab]);

  const activeFixtures = fixtures.filter((f) => f.kickoff.startsWith(activeTab));

  return (
    <div>
      {/* Tab bar */}
      <div
        className="flex items-stretch gap-1 p-1 rounded-lg mb-8"
        style={{ background: "var(--surface-panel)", border: "1px solid var(--surface-border)" }}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 flex flex-col items-center gap-0.5 py-3 px-4 rounded-md transition-all"
              style={{
                background: isActive ? "var(--accent-glow)" : "transparent",
                border: isActive
                  ? "1px solid var(--accent-primary)"
                  : "1px solid transparent",
                cursor: "pointer",
              }}
            >
              <span
                className="font-semibold text-sm"
                style={{
                  color: isActive ? "var(--accent-primary)" : "var(--text-secondary)",
                }}
              >
                {tab.label}
              </span>
              <span
                className="text-xs"
                style={{ color: isActive ? "var(--accent-primary)" : "var(--text-tertiary)" }}
              >
                {tab.sublabel}
              </span>
              {/* Match count pill */}
              <span
                className="text-xs font-mono font-bold mt-1 px-2 py-0.5 rounded-full"
                style={{
                  background: isActive ? "var(--accent-primary)" : "var(--surface-elevated)",
                  color: isActive ? "var(--text-inverse)" : "var(--text-tertiary)",
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* No fixtures for this date */}
      {activeFixtures.length === 0 && (
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
            <path d="M24 14v10l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <p className="font-semibold text-lg mb-2" style={{ color: "var(--text-secondary)" }}>
            No fixtures scheduled
          </p>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            No matches found for this date. Try another day or check back later.
          </p>
        </div>
      )}

      {/* Competition groups */}
      {Array.from(grouped.entries()).map(([compId, group]) => (
        <section key={compId} className="mb-10">
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
            <h2
              className="font-semibold text-sm"
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
