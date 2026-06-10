import Link from "next/link";
import type { Fixture } from "@/types";

interface FixtureCardProps {
  fixture: Fixture;
}

export function FixtureCard({ fixture }: FixtureCardProps) {
  const kickoffDate = new Date(fixture.kickoff);
  const timeStr = kickoffDate.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  const isLive =
    fixture.status === "IN_PLAY" ||
    fixture.status === "LIVE" ||
    fixture.status === "PAUSED";
  const isFinished = fixture.status === "FINISHED";

  return (
    <Link href={`/predictions/${encodeURIComponent(fixture.id)}`}>
      <article
        className="panel p-4 hover:border-opacity-70 transition-all cursor-pointer group"
        style={{
          borderColor: "var(--surface-border)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor =
            "var(--accent-primary)";
          (e.currentTarget as HTMLElement).style.background =
            "var(--surface-hover)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor =
            "var(--surface-border)";
          (e.currentTarget as HTMLElement).style.background =
            "var(--surface-panel)";
        }}
      >
        {/* Competition row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {fixture.competition.emblem && (
              <img
                src={fixture.competition.emblem}
                alt=""
                className="w-4 h-4 object-contain opacity-80"
              />
            )}
            <span className="data-label truncate max-w-[180px]">
              {fixture.competition.name}
            </span>
            {fixture.competition.country && (
              <>
                <span
                  className="data-label"
                  style={{ color: "var(--surface-border)" }}
                >
                  /
                </span>
                <span className="data-label">{fixture.competition.country}</span>
              </>
            )}
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-1.5">
            {isLive && (
              <span
                className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "var(--status-live)" }}
              />
            )}
            <span
              className="data-label"
              style={{
                color: isLive
                  ? "var(--status-live)"
                  : isFinished
                  ? "var(--text-tertiary)"
                  : "var(--accent-primary)",
              }}
            >
              {isLive ? "LIVE" : isFinished ? "FT" : timeStr + " UTC"}
            </span>
          </div>
        </div>

        {/* Teams and score */}
        <div className="flex items-center gap-3">
          {/* Home team */}
          <div className="flex-1 flex items-center gap-2.5">
            {fixture.homeTeam.crest && (
              <img
                src={fixture.homeTeam.crest}
                alt=""
                className="w-8 h-8 object-contain flex-shrink-0"
              />
            )}
            <span
              className="font-semibold text-sm leading-tight truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {fixture.homeTeam.shortName ?? fixture.homeTeam.name}
            </span>
          </div>

          {/* Score / vs */}
          <div
            className="flex-shrink-0 font-mono font-bold text-lg min-w-[60px] text-center"
            style={{ color: "var(--text-primary)" }}
          >
            {fixture.score
              ? `${fixture.score.home} — ${fixture.score.away}`
              : "vs"}
          </div>

          {/* Away team */}
          <div className="flex-1 flex items-center justify-end gap-2.5">
            <span
              className="font-semibold text-sm leading-tight truncate text-right"
              style={{ color: "var(--text-primary)" }}
            >
              {fixture.awayTeam.shortName ?? fixture.awayTeam.name}
            </span>
            {fixture.awayTeam.crest && (
              <img
                src={fixture.awayTeam.crest}
                alt=""
                className="w-8 h-8 object-contain flex-shrink-0"
              />
            )}
          </div>
        </div>

        {/* Venue */}
        {fixture.venue && (
          <div
            className="mt-2.5 pt-2.5 border-t flex items-center gap-1.5"
            style={{ borderColor: "var(--surface-border)" }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ color: "var(--text-tertiary)" }}
            >
              <path
                d="M6 1C4.067 1 2.5 2.567 2.5 4.5c0 2.625 3.5 6.5 3.5 6.5s3.5-3.875 3.5-6.5C9.5 2.567 7.933 1 6 1zm0 4.75a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z"
                fill="currentColor"
              />
            </svg>
            <span
              className="text-xs truncate max-w-[240px]"
              style={{ color: "var(--text-tertiary)" }}
            >
              {fixture.venue}
            </span>
          </div>
        )}

        {/* CTA */}
        {!isFinished && (
          <div
            className="mt-3 pt-3 border-t flex items-center justify-between"
            style={{ borderColor: "var(--surface-border)" }}
          >
            <span className="data-label">View Analysis</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ color: "var(--accent-primary)" }}
              className="group-hover:translate-x-1 transition-transform"
            >
              <path
                d="M1 7h12M7 1l6 6-6 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </article>
    </Link>
  );
}
