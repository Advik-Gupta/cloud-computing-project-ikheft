"use client";

import InfoTip from "./InfoTip";
import { ScheduleResponse } from "@/lib/api";

export default function ImprovementBadge({ data }: { data: ScheduleResponse }) {
  const { comparison, heft, ikheft, naive, instance } = data;
  const pct = comparison.makespan_improvement_pct;
  const improved = pct > 0.005;

  return (
    <div className="headline">
      <div className={`bigstat${improved ? "" : " neutral"}`}>
        <div className="kicker">Our version vs. the industry standard</div>
        <div className="value">{pct.toFixed(1)}%</div>
        <div className="caption">
          {improved ? (
            <>
              faster than HEFT. Same {instance.num_tasks} tasks, same{" "}
              {instance.num_vms} VMs, nothing added - just a smarter choice of
              what runs where. The job ends{" "}
              <b>{comparison.time_saved.toFixed(0)} time units</b> sooner.
            </>
          ) : (
            <>
              no gain on this particular workload. IKHeft never returns anything
              worse than HEFT, but here it found no improving move inside its
              budget. Press <b>Shuffle</b> for a different workload - this
              happens on roughly 1 in 8.
            </>
          )}
        </div>
      </div>

      <div className="sidestat">
        <div className="kicker">
          Both smart schedulers vs. no scheduling strategy
          <InfoTip title="Why compare against round-robin?" align="right">
            Round-robin is the &ldquo;do nothing clever&rdquo; control: hand
            each task to the next VM in turn. It shows how much of the win comes
            from scheduling at all (the big number) versus how much comes from
            our refinement on top of HEFT (the green number on the left).
          </InfoTip>
        </div>
        <div className="row">
          <span>HEFT beats round-robin by</span>
          <b>{comparison.naive_to_heft_pct.toFixed(1)}%</b>
        </div>
        <div className="row">
          <span>IKHeft beats round-robin by</span>
          <b className="good">{comparison.naive_to_ikheft_pct.toFixed(1)}%</b>
        </div>
        <div className="row muted">
          <span>Finish times</span>
          <b>
            {naive.makespan.toFixed(0)} → {heft.makespan.toFixed(0)} →{" "}
            {ikheft.makespan.toFixed(0)}
          </b>
        </div>
      </div>
    </div>
  );
}
