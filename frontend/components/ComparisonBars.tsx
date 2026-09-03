"use client";

import InfoTip from "./InfoTip";
import { ScheduleResponse } from "@/lib/api";

/** Three horizontal bars: how long the same job takes under each scheduler.
 *  Shorter is better -- this is the one chart that needs no explanation. */
export default function ComparisonBars({ data }: { data: ScheduleResponse }) {
  const rows = [
    {
      key: "naive",
      name: "Round-robin",
      sub: "no smarts - deal tasks out evenly",
      result: data.naive,
      color: "#ef4444",
    },
    {
      key: "heft",
      name: "HEFT",
      sub: "the 20-year-old industry standard",
      result: data.heft,
      color: "#64748b",
    },
    {
      key: "ikheft",
      name: "IKHeft",
      sub: "the 2026 paper we are reproducing",
      result: data.ikheft,
      color: "#4ade80",
    },
  ];
  const worst = Math.max(...rows.map((r) => r.result.makespan));

  return (
    <div className="panel">
      <div className="chart-head">
        <h2>
          How long the job takes, end to end
          <InfoTip title="What am I looking at?">
            The exact same workload - same tasks, same VMs - handed to three
            different schedulers. Each bar is how long the whole job takes to
            finish. <b>Shorter is better.</b> Nothing about the hardware changes
            between bars; only the decision of which task runs where and when.
          </InfoTip>
        </h2>
        <div className="ms">lower is better</div>
      </div>

      <div className="bars">
        {rows.map((r) => {
          const pct = (r.result.makespan / worst) * 100;
          const vsWorst = ((worst - r.result.makespan) / worst) * 100;
          return (
            <div className="bar-row" key={r.key}>
              <div className="bar-label">
                <b>{r.name}</b>
                <span>{r.sub}</span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${pct}%`, background: r.color }}
                />
                <span className="bar-value">
                  {r.result.makespan.toFixed(0)}
                  {vsWorst > 0.05 && (
                    <em> - {vsWorst.toFixed(1)}% faster than round-robin</em>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
