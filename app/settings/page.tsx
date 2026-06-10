/**
 * Settings / System Status Page
 *
 * Displays provider connectivity and environment health.
 * Never shows API keys, credentials, or secrets.
 */

import type { SystemHealth, ApiResponse } from "@/types";

async function fetchHealth(): Promise<SystemHealth | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/health`, {
      cache: "no-store",
    });
    const json: ApiResponse<SystemHealth> = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export default async function SettingsPage() {
  const health = await fetchHealth();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <span className="data-label">Configuration</span>
        <h1
          className="text-3xl font-bold tracking-tight mt-1"
          style={{ color: "var(--text-primary)" }}
        >
          System Status
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Data provider connectivity and environment health
        </p>
      </div>

      {/* Provider status */}
      <section className="mb-10">
        <h2
          className="font-semibold text-base mb-4 pb-3 border-b"
          style={{
            color: "var(--text-primary)",
            borderColor: "var(--surface-border)",
          }}
        >
          Data Providers
        </h2>

        {!health && (
          <div
            className="panel p-6 text-center"
            style={{ borderColor: "var(--surface-border)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
              Unable to fetch provider status
            </p>
          </div>
        )}

        {health && (
          <div className="space-y-4">
            {health.providers.map((provider) => (
              <div
                key={provider.key}
                className="panel p-5"
                style={{ borderColor: "var(--surface-border)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <StatusDot
                      configured={provider.configured}
                      reachable={provider.reachable}
                    />
                    <div>
                      <p
                        className="font-semibold text-sm"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {provider.name}
                      </p>
                      {provider.error && (
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "var(--conf-medium)" }}
                        >
                          {provider.error}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="data-label">Configured</p>
                      <p
                        className="font-mono text-xs font-semibold"
                        style={{
                          color: provider.configured
                            ? "var(--conf-high)"
                            : "var(--conf-low)",
                        }}
                      >
                        {provider.configured ? "Yes" : "No"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="data-label">Reachable</p>
                      <p
                        className="font-mono text-xs font-semibold"
                        style={{
                          color:
                            provider.reachable === null
                              ? "var(--text-tertiary)"
                              : provider.reachable
                              ? "var(--conf-high)"
                              : "var(--conf-low)",
                        }}
                      >
                        {provider.reachable === null
                          ? "Unknown"
                          : provider.reachable
                          ? "Online"
                          : "Offline"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {health && (
          <p
            className="text-xs mt-3"
            style={{ color: "var(--text-tertiary)" }}
          >
            Last checked:{" "}
            {new Date(health.checkedAt).toLocaleString("en-GB", {
              timeZone: "UTC",
            })}{" "}
            UTC
          </p>
        )}
      </section>

      {/* Environment guide — never shows actual keys */}
      <section>
        <h2
          className="font-semibold text-base mb-4 pb-3 border-b"
          style={{
            color: "var(--text-primary)",
            borderColor: "var(--surface-border)",
          }}
        >
          Required Environment Variables
        </h2>
        <div
          className="panel p-5"
          style={{ borderColor: "var(--surface-border)" }}
        >
          <p
            className="text-xs mb-4"
            style={{ color: "var(--text-secondary)" }}
          >
            Configure these in your Vercel project settings or local{" "}
            <code
              className="font-mono px-1 py-0.5 rounded"
              style={{
                background: "var(--surface-elevated)",
                color: "var(--accent-primary)",
              }}
            >
              .env.local
            </code>{" "}
            file. Values are never exposed here.
          </p>
          <div className="space-y-3">
            {[
              {
                key: "FOOTBALL_DATA_API_KEY",
                desc: "football-data.org API key — obtain at football-data.org",
                required: true,
              },
              {
                key: "ODDS_API_KEY",
                desc: "The Odds API key — obtain at the-odds-api.com",
                required: true,
              },
              {
                key: "SPORTMONKS_API_KEY",
                desc: "Sportmonks API token — obtain at my.sportmonks.com/api/tokens",
                required: true,
              },
              {
                key: "NEXT_PUBLIC_BASE_URL",
                desc: "Full URL of your deployment (e.g. https://matchora.vercel.app)",
                required: true,
              },
            ].map(({ key, desc, required }) => (
              <div
                key={key}
                className="rounded p-3"
                style={{ background: "var(--surface-elevated)" }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <code
                    className="font-mono text-xs font-semibold"
                    style={{ color: "var(--accent-primary)" }}
                  >
                    {key}
                  </code>
                  {required && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        background: "rgba(239,68,68,0.1)",
                        color: "var(--conf-low)",
                      }}
                    >
                      Required
                    </span>
                  )}
                </div>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusDot({
  configured,
  reachable,
}: {
  configured: boolean;
  reachable: boolean | null;
}) {
  const color =
    !configured || reachable === false
      ? "var(--conf-low)"
      : reachable === true
      ? "var(--conf-high)"
      : "var(--conf-medium)";

  return (
    <div
      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{ background: color }}
    />
  );
}
