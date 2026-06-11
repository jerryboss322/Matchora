/**
 * Prediction Detail Page
 *
 * Displays the full analysis for a single fixture:
 * - Team form stats
 * - Head-to-head summary
 * - Top 7 ranked market predictions with confidence breakdown
 * - Data quality warnings
 */

import type { FixturePrediction, ApiResponse } from "@/types";
import { PredictionCard } from "@/components/predictions/PredictionCard";
import { FormPanel } from "@/components/predictions/FormPanel";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

async function fetchPrediction(
  id: string
): Promise<FixturePrediction | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(
      `${baseUrl}/api/predictions/${encodeURIComponent(id)}`,
      { next: { revalidate: 600 } }
    );
    if (!res.ok) return null;
    const json: ApiResponse<FixturePrediction> = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export default async function PredictionPage({ params }: Props) {
  const { id } = await params;
  const prediction = await fetchPrediction(id);

  if (!prediction) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <p
          className="text-lg font-semibold mb-2"
          style={{ color: "var(--text-secondary)" }}
        >
          Fixture not found
        </p>
        <p className="text-sm mb-6" style={{ color: "var(--text-tertiary)" }}>
          This fixture may no longer be available or the ID is invalid.
        </p>
        <Link
          href="/"
          className="text-sm underline"
          style={{ color: "var(--accent-primary)" }}
        >
          Back to fixtures
        </Link>
      </div>
    );
  }

  const { fixture, dataQuality } = prediction;

  const kickoff = new Date(fixture.kickoff).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm mb-8"
        style={{ color: "var(--text-secondary)" }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M13 7H1M7 1L1 7l6 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        All Fixtures
      </Link>

      {/* Match header */}
      <div className="panel p-6 mb-8" style={{ borderColor: "var(--surface-border)" }}>
        <div className="flex items-center gap-2 mb-4">
          {fixture.competition.emblem && (
            <img
              src={fixture.competition.emblem}
              alt=""
              className="w-5 h-5 object-contain opacity-80"
            />
          )}
          <span className="data-label">{fixture.competition.name}</span>
          {fixture.competition.country && (
            <span className="data-label" style={{ color: "var(--text-tertiary)" }}>
              / {fixture.competition.country}
            </span>
          )}
          <span
            className="ml-auto data-label"
            style={{ color: "var(--accent-primary)" }}
          >
            {kickoff} UTC
          </span>
        </div>

        <div className="flex items-center justify-between gap-6">
          <TeamDisplay
            name={fixture.homeTeam.name}
            crest={fixture.homeTeam.crest}
            standing={prediction.homeStanding}
            side="home"
          />
          <div className="text-center flex-shrink-0">
            <p
              className="font-mono text-2xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              vs
            </p>
          </div>
          <TeamDisplay
            name={fixture.awayTeam.name}
            crest={fixture.awayTeam.crest}
            standing={prediction.awayStanding}
            side="away"
          />
        </div>
      </div>

      {/* Data quality warnings */}
      {dataQuality.warnings.length > 0 && (
        <div
          className="rounded-md p-4 mb-8 border"
          style={{
            background: "rgba(245, 158, 11, 0.05)",
            borderColor: "rgba(245, 158, 11, 0.2)",
          }}
        >
          <p
            className="data-label mb-2"
            style={{ color: "var(--conf-medium)" }}
          >
            Data Quality Notices
          </p>
          <ul className="space-y-1">
            {dataQuality.warnings.map((w, i) => (
              <li key={i} className="text-xs flex items-start gap-2">
                <span
                  style={{ color: "var(--conf-medium)" }}
                  className="mt-0.5 flex-shrink-0"
                >
                  —
                </span>
                <span style={{ color: "var(--text-secondary)" }}>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Cannot predict — truly no data */}
      {!prediction.canPredict && (
        <div
          className="panel p-8 text-center mb-8"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <p className="text-2xl mb-3">📊</p>
          <p
            className="font-semibold text-base mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Prediction unavailable
          </p>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            {prediction.skipReason ?? "Insufficient data signals to generate a reliable prediction."}
          </p>
          <p className="text-xs mt-3" style={{ color: "var(--text-tertiary)" }}>
            Minimum required: 2 of 4 signals (form, H2H, standings, odds)
          </p>
        </div>
      )}

      {/* Limited data warning — predictions still shown but flagged */}
      {prediction.canPredict && prediction.dataQuality.overallScore < 0.6 && (
        <div
          className="rounded-md p-4 mb-8 border flex items-start gap-3"
          style={{
            background: "rgba(245, 158, 11, 0.06)",
            borderColor: "rgba(245, 158, 11, 0.3)",
          }}
        >
          <span className="text-xl flex-shrink-0">⚠</span>
          <div>
            <p className="font-semibold text-sm mb-1" style={{ color: "var(--conf-medium)" }}>
              Limited Data Available
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              This fixture has incomplete historical data. Predictions were generated
              using available signals only. Confidence scores may be lower than usual.
            </p>
          </div>
        </div>
      )}

      {/* Main content grid */}
      {prediction.canPredict && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: predictions */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2
                className="font-semibold text-base"
                style={{ color: "var(--text-primary)" }}
              >
                Top Market Predictions
              </h2>
              <span className="data-label">
                {prediction.predictions.length} markets analyzed
              </span>
            </div>
            {prediction.predictions.map((pred, i) => (
              <PredictionCard
                key={pred.key}
                prediction={pred}
                rank={i + 1}
              />
            ))}
          </div>

          {/* Right: form & context */}
          <div className="space-y-6">
            {prediction.homeForm && (
              <FormPanel
                label={`${fixture.homeTeam.shortName ?? fixture.homeTeam.name} (Home)`}
                form={prediction.homeForm}
                venueForm={prediction.homeVenueForm}
              />
            )}
            {prediction.awayForm && (
              <FormPanel
                label={`${fixture.awayTeam.shortName ?? fixture.awayTeam.name} (Away)`}
                form={prediction.awayForm}
                venueForm={prediction.awayVenueForm}
              />
            )}

            {/* H2H summary */}
            {prediction.h2h && (
              <div
                className="panel p-4"
                style={{ borderColor: "var(--surface-border)" }}
              >
                <p className="data-label mb-4">Head-to-Head</p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center">
                    <p className="data-label mb-1">Home</p>
                    <p
                      className="font-mono font-bold text-xl"
                      style={{ color: "var(--conf-high)" }}
                    >
                      {prediction.h2h.homeWins}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="data-label mb-1">Draw</p>
                    <p
                      className="font-mono font-bold text-xl"
                      style={{ color: "var(--conf-medium)" }}
                    >
                      {prediction.h2h.draws}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="data-label mb-1">Away</p>
                    <p
                      className="font-mono font-bold text-xl"
                      style={{ color: "var(--conf-low)" }}
                    >
                      {prediction.h2h.awayWins}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="data-label">Avg Goals</span>
                    <span
                      className="font-mono text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {prediction.h2h.avgGoalsPerGame.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="data-label">BTTS Rate</span>
                    <span
                      className="font-mono text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {(prediction.h2h.bttsRate * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="data-label">Over 1.5 Rate</span>
                    <span
                      className="font-mono text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {(prediction.h2h.over15Rate * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="data-label">Meetings</span>
                    <span
                      className="font-mono text-sm font-semibold"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {prediction.h2h.totalMeetings}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Data quality panel */}
            <div
              className="panel p-4"
              style={{ borderColor: "var(--surface-border)" }}
            >
              <p className="data-label mb-4">Data Coverage</p>
              <div className="space-y-2">
                {[
                  { label: "Form data", ok: dataQuality.hasForm },
                  { label: "Venue form", ok: dataQuality.hasVenueForm },
                  { label: "Head-to-head", ok: dataQuality.hasH2H },
                  { label: "Standings", ok: dataQuality.hasStandings },
                  { label: "Odds data", ok: dataQuality.hasOdds },
                ].map(({ label, ok }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {label}
                    </span>
                    <span
                      className="text-xs font-mono font-semibold"
                      style={{
                        color: ok ? "var(--conf-high)" : "var(--text-tertiary)",
                      }}
                    >
                      {ok ? "Available" : "Missing"}
                    </span>
                  </div>
                ))}
              </div>
              <div
                className="mt-4 pt-3 border-t"
                style={{ borderColor: "var(--surface-border)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="data-label">Overall Quality</span>
                  <span
                    className="font-mono text-sm font-bold"
                    style={{
                      color:
                        dataQuality.overallScore >= 0.8
                          ? "var(--conf-high)"
                          : dataQuality.overallScore >= 0.6
                          ? "var(--conf-medium)"
                          : "var(--conf-low)",
                    }}
                  >
                    {(dataQuality.overallScore * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generated at */}
      <p
        className="mt-10 text-xs text-center"
        style={{ color: "var(--text-tertiary)" }}
      >
        Analysis generated at{" "}
        {new Date(prediction.generatedAt).toLocaleString("en-GB", {
          timeZone: "UTC",
        })}{" "}
        UTC &bull; All predictions based solely on real API data
      </p>
    </div>
  );
}

function TeamDisplay({
  name,
  crest,
  standing,
  side,
}: {
  name: string;
  crest?: string;
  standing: { position: number; points: number; played: number } | null;
  side: "home" | "away";
}) {
  return (
    <div
      className={`flex-1 flex flex-col items-${side === "home" ? "start" : "end"} gap-2`}
    >
      <div
        className={`flex items-center gap-3 ${side === "away" ? "flex-row-reverse" : ""}`}
      >
        {crest && (
          <img src={crest} alt="" className="w-12 h-12 object-contain" />
        )}
        <div className={side === "away" ? "text-right" : ""}>
          <p
            className="font-bold text-lg leading-tight"
            style={{ color: "var(--text-primary)" }}
          >
            {name}
          </p>
          {standing && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {side === "home" ? "Home" : "Away"} &bull; #{standing.position} &bull;{" "}
              {standing.points} pts
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
