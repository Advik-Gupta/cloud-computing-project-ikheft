"use client";

import { useEffect, useState } from "react";

import { Stage } from "@/lib/api";

const PLANNED = [
  "Generate workflow",
  "Naive schedule",
  "Rank tasks",
  "HEFT schedule",
  "IKHeft local search",
];

/** Shows what the Python backend actually did for this click.
 *  While the request is in flight the steps light up in sequence; once it
 *  returns, each step shows its real measured time. */
export default function PipelineSteps({
  stages,
  loading,
}: {
  stages: Stage[] | null;
  loading: boolean;
}) {
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    if (!loading) return;
    setCursor(0);
    const id = setInterval(
      () => setCursor((c) => (c + 1) % (PLANNED.length + 1)),
      280,
    );
    return () => clearInterval(id);
  }, [loading]);

  const rows = loading
    ? PLANNED.map((label, i) => ({
        label,
        description: "",
        ms: null as number | null,
        state: i < cursor ? "done" : i === cursor ? "running" : "pending",
      }))
    : (stages ?? []).map((s) => ({
        label: s.label,
        description: s.description,
        ms: s.ms,
        state: "done" as const,
      }));

  if (!rows.length) return null;

  return (
    <div className="panel pipeline">
      <div className="pipeline-head">
        <h3>
          What the backend just did
          <span className="hint" style={{ fontWeight: 400, marginLeft: 10 }}>
            {loading
              ? "running…"
              : "each step below really ran in Python; times are measured"}
          </span>
        </h3>
      </div>

      <ol className="steps">
        {rows.map((r, i) => (
          <li key={r.label} className={`step ${r.state}`}>
            <span className="step-dot">{r.state === "done" ? "✓" : i + 1}</span>
            <span className="step-body">
              <span className="step-label">
                {r.label}
                {r.ms !== null && (
                  <span className="step-ms">{r.ms.toFixed(1)} ms</span>
                )}
              </span>
              {r.description && (
                <span className="step-desc">{r.description}</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
