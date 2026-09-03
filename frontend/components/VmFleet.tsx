"use client";

import InfoTip from "./InfoTip";
import { ScheduleResponse } from "@/lib/api";

/** The machines are not identical, and that is the whole point of the problem.
 *  This panel shows the speed of each VM next to how much work each scheduler
 *  actually gave it. */
export default function VmFleet({ data }: { data: ScheduleResponse }) {
  const speeds = data.instance.vm_speeds;
  const fastest = Math.max(...speeds);
  const slowest = Math.min(...speeds);
  const maxTasks = Math.max(
    ...data.naive.vm_task_count,
    ...data.heft.vm_task_count,
    ...data.ikheft.vm_task_count,
  );

  const fastestVm = speeds.indexOf(fastest);
  const busiest = data.ikheft.vm_task_count[fastestVm];
  const unused = data.ikheft.vm_task_count.filter((c) => c === 0).length;

  const columns = [
    {
      key: "naive",
      label: "Round-robin",
      result: data.naive,
      color: "#ef4444",
    },
    { key: "heft", label: "HEFT", result: data.heft, color: "#94a3b8" },
    { key: "ikheft", label: "IKHeft", result: data.ikheft, color: "#4ade80" },
  ];

  return (
    <div className="panel">
      <div className="chart-head">
        <h2>
          The machines are not identical
          <InfoTip title="Why VM speed matters">
            A real cloud fleet is a mix of instance types, so the same task
            takes different amounts of time on different machines. Here the
            fastest VM is <b>{(fastest / slowest).toFixed(1)}×</b> quicker than
            the slowest.
            <br />
            <br />A scheduler that ignores this - like round-robin - hands the
            slow machines just as much work as the fast ones, and the whole job
            waits on the stragglers. A scheduler that understands it piles work
            onto the fast machines and may leave the slowest ones empty, because
            starting a task there would finish it <i>later</i> than queueing it
            behind other work on a fast machine.
          </InfoTip>
        </h2>
        <div className="ms">
          fastest VM is {(fastest / slowest).toFixed(1)}× the slowest
        </div>
      </div>

      <p className="takeaway">
        Round-robin gives all {speeds.length} machines the same{" "}
        <b>{data.naive.vm_task_count[0]} tasks</b> each, regardless of speed.
        IKHeft gives <b>{busiest} tasks</b> to the fastest machine (VM
        {fastestVm}, {fastest.toFixed(2)}×)
        {unused > 0 && (
          <>
            {" "}
            and leaves the <b>{unused} slowest machines empty</b> - using them
            would finish those tasks later, not sooner
          </>
        )}
        .
      </p>

      <table className="fleet">
        <thead>
          <tr>
            <th>Machine</th>
            <th>Relative speed</th>
            {columns.map((c) => (
              <th key={c.key} className="num">
                {c.label}
                <span>tasks given</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {speeds.map((sp, vm) => (
            <tr key={vm}>
              <td>
                <b>VM{vm}</b>
                {sp === fastest && <span className="pill fast">fastest</span>}
                {sp === slowest && <span className="pill slow">slowest</span>}
              </td>
              <td>
                <div className="speed-cell">
                  <div className="speed-track">
                    <div
                      className="speed-fill"
                      style={{ width: `${(sp / fastest) * 100}%` }}
                    />
                  </div>
                  <span className="speed-num">{sp.toFixed(2)}×</span>
                </div>
              </td>
              {columns.map((c) => {
                const n = c.result.vm_task_count[vm];
                return (
                  <td key={c.key} className="num">
                    <div className="load-cell">
                      <div className="load-track">
                        <div
                          className="load-fill"
                          style={{
                            width: `${maxTasks ? (n / maxTasks) * 100 : 0}%`,
                            background: c.color,
                          }}
                        />
                      </div>
                      <span className={n === 0 ? "zero" : ""}>{n}</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
