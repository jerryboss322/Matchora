interface ConfidenceBadgeProps {
  confidence: number; // 0–100
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ConfidenceBadge({
  confidence,
  showLabel = false,
  size = "md",
}: ConfidenceBadgeProps) {
  const tier = confidence >= 70 ? "high" : confidence >= 50 ? "medium" : "low";

  const colors = {
    high: { text: "var(--conf-high)", bg: "var(--conf-high-bg)" },
    medium: { text: "var(--conf-medium)", bg: "var(--conf-medium-bg)" },
    low: { text: "var(--conf-low)", bg: "var(--conf-low-bg)" },
  };

  const sizes = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono font-bold rounded ${sizes[size]}`}
      style={{
        color: colors[tier].text,
        background: colors[tier].bg,
      }}
    >
      {confidence.toFixed(1)}%
      {showLabel && (
        <span className="font-normal text-xs opacity-70 uppercase tracking-wider">
          conf
        </span>
      )}
    </span>
  );
}

/**
 * Horizontal confidence bar.
 */
export function ConfidenceBar({
  confidence,
  className = "",
}: {
  confidence: number;
  className?: string;
}) {
  const tier = confidence >= 70 ? "high" : confidence >= 50 ? "medium" : "low";
  const colors = {
    high: "var(--conf-high)",
    medium: "var(--conf-medium)",
    low: "var(--conf-low)",
  };

  return (
    <div className={`conf-bar-track ${className}`}>
      <div
        className="conf-bar-fill"
        style={{
          width: `${Math.min(100, confidence)}%`,
          background: colors[tier],
        }}
      />
    </div>
  );
}
