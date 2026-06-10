import type { MarketPrediction } from "@/types";
import { ConfidenceBadge, ConfidenceBar } from "@/components/ui/ConfidenceBadge";

interface PredictionCardProps {
  prediction: MarketPrediction;
  rank: number;
}

export function PredictionCard({ prediction, rank }: PredictionCardProps) {
  return (
    <div
      className="panel p-5"
      style={{ borderColor: "var(--surface-border)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <span
            className="w-7 h-7 rounded flex items-center justify-center text-xs font-mono font-bold flex-shrink-0"
            style={{
              background: "var(--surface-elevated)",
              color: "var(--text-secondary)",
            }}
          >
            {rank}
          </span>
          <div>
            <h3
              className="font-semibold text-sm leading-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {prediction.label}
            </h3>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {prediction.description}
            </p>
          </div>
        </div>
        <ConfidenceBadge confidence={prediction.confidence} showLabel />
      </div>

      {/* Confidence bar */}
      <ConfidenceBar confidence={prediction.confidence} className="mb-4" />

      {/* Signal breakdown */}
      <div
        className="rounded-md p-3"
        style={{ background: "var(--surface-elevated)" }}
      >
        <p className="data-label mb-3">Signal Breakdown</p>
        <div className="space-y-2.5">
          {prediction.factors.map((factor, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {factor.name}
                </span>
                <span
                  className="font-mono text-xs font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {(factor.value * 100).toFixed(1)}%
                </span>
              </div>
              <div className="conf-bar-track">
                <div
                  className="conf-bar-fill"
                  style={{
                    width: `${Math.min(100, factor.value * 100)}%`,
                    background: "var(--accent-primary)",
                    opacity: 0.6 + factor.weight * 0.4,
                  }}
                />
              </div>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--text-tertiary)" }}
              >
                {factor.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Model vs Market */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div
          className="rounded p-3"
          style={{ background: "var(--surface-elevated)" }}
        >
          <p className="data-label mb-1">Model Confidence</p>
          <p
            className="font-mono font-bold text-lg"
            style={{ color: "var(--text-primary)" }}
          >
            {prediction.modelConfidence.toFixed(1)}%
          </p>
        </div>
        <div
          className="rounded p-3"
          style={{ background: "var(--surface-elevated)" }}
        >
          <p className="data-label mb-1">Market Confidence</p>
          <p
            className="font-mono font-bold text-lg"
            style={{ color: "var(--text-primary)" }}
          >
            {prediction.marketConfidence.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Data reliability */}
      <div
        className="mt-3 pt-3 border-t flex items-center justify-between"
        style={{ borderColor: "var(--surface-border)" }}
      >
        <span className="data-label">Data Reliability</span>
        <span
          className="font-mono text-xs font-semibold"
          style={{
            color:
              prediction.dataReliability >= 0.8
                ? "var(--conf-high)"
                : prediction.dataReliability >= 0.6
                ? "var(--conf-medium)"
                : "var(--conf-low)",
          }}
        >
          {(prediction.dataReliability * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
