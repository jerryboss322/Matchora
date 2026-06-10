import type { TeamFormStats, VenueFormStats } from "@/types";

interface FormPanelProps {
  label: string;
  form: TeamFormStats;
  venueForm: VenueFormStats | null;
}

export function FormPanel({ label, form, venueForm }: FormPanelProps) {
  const displayForm = venueForm ?? form;

  return (
    <div className="panel p-4" style={{ borderColor: "var(--surface-border)" }}>
      <p className="data-label mb-4">{label}</p>

      {/* Win/Draw/Loss */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatCell
          label="W"
          value={form.wins}
          color="var(--conf-high)"
        />
        <StatCell
          label="D"
          value={form.draws}
          color="var(--conf-medium)"
        />
        <StatCell
          label="L"
          value={form.losses}
          color="var(--conf-low)"
        />
      </div>

      {/* Goals */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <DataRow
          label="Avg Scored"
          value={form.avgGoalsScored.toFixed(2)}
        />
        <DataRow
          label="Avg Conceded"
          value={form.avgGoalsConceded.toFixed(2)}
        />
        <DataRow
          label="Over 1.5 Rate"
          value={`${(form.over15Rate * 100).toFixed(0)}%`}
        />
        <DataRow
          label="BTTS Rate"
          value={`${(form.bttsRate * 100).toFixed(0)}%`}
        />
        <DataRow
          label="Clean Sheets"
          value={`${form.cleanSheets}/${form.played}`}
        />
        <DataRow
          label="Failed to Score"
          value={`${form.failedToScore}/${form.played}`}
        />
      </div>

      {/* Sample size */}
      <div
        className="pt-3 border-t flex items-center justify-between"
        style={{ borderColor: "var(--surface-border)" }}
      >
        <span className="data-label">Sample</span>
        <span className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
          Last {form.played} matches
        </span>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="rounded p-2 text-center"
      style={{ background: "var(--surface-elevated)" }}
    >
      <p className="data-label mb-1">{label}</p>
      <p className="font-mono font-bold text-xl" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="data-label">{label}</span>
      <span
        className="font-mono text-sm font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}
