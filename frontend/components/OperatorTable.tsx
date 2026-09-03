"use client";

import InfoTip from "./InfoTip";
import { ScheduleResponse } from "@/lib/api";

const OPERATORS: Record<
  string,
  { name: string; plain: string; share: string }
> = {
  relabel: {
    name: "Move one task",
    plain: "Pick a single task and try running it on a different VM.",
    share: "40%",
  },
  label_swap: {
    name: "Swap two tasks",
    plain: "Pick two tasks and have them trade places with each other.",
    share: "25%",
  },
  map_swap: {
    name: "Swap two VMs' workloads",
    plain: "Take everything queued on one VM and swap it with another VM's.",
    share: "20%",
  },
  free_selection: {
    name: "Re-plan from scratch",
    plain:
      "Throw away the current VM choices and let the scheduler re-pick them all.",
    share: "15%",
  },
};

export default function OperatorTable({ data }: { data: ScheduleResponse }) {
  const ops = data.search.operators;
  const totalAccepts = ops.reduce((a, o) => a + o.accepts, 0);

  return (
    <div className="panel">
      <div className="chart-head">
        <h2>
          Inside the search: which rearrangements were tried
          <InfoTip title="What is this table?">
            IKHeft improves HEFT&apos;s answer by trying thousands of small
            random rearrangements and keeping only the ones that make the job
            finish sooner. It has four kinds of rearrangement
            (&ldquo;moves&rdquo;).
            <br />
            <br />
            <b>Tried</b> is how many times it attempted that move. <b>Kept</b>{" "}
            is how many of those actually helped and were kept - most fail,
            which is normal for this kind of search.
            <br />
            <br />
            The key point for our project: the <b>Share</b> column is{" "}
            <i>fixed by the paper</i> and never changes, even when a move is
            clearly not working. Our novelty is to make those shares adapt.
          </InfoTip>
        </h2>
        <div className="ms">
          {data.search.iterations} attempts · {totalAccepts} kept
        </div>
      </div>

      <table className="ops">
        <thead>
          <tr>
            <th>Move</th>
            <th>What it does</th>
            <th className="num">Share</th>
            <th className="num">Tried</th>
            <th className="num">Kept</th>
            <th className="num">Success rate</th>
          </tr>
        </thead>
        <tbody>
          {ops.map((op) => {
            const meta = OPERATORS[op.operator];
            const rate = op.attempts ? (100 * op.accepts) / op.attempts : 0;
            return (
              <tr key={op.operator}>
                <td>
                  <b>{meta?.name ?? op.operator}</b>
                </td>
                <td className="plain">{meta?.plain}</td>
                <td className="num fixed">{meta?.share}</td>
                <td className="num">{op.attempts}</td>
                <td className="num">{op.accepts}</td>
                <td className="num">
                  <span className={rate > 0 ? "good" : "zero"}>
                    {rate.toFixed(2)}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="callout">
        <b>Read this row by row:</b> notice that the <i>Share</i> column never
        changes, no matter what the <i>Success rate</i> column says. The paper
        hard-codes 40 / 25 / 20 / 15 and sticks to it for the whole search - so
        a move with a 0% success rate keeps getting 20% of the budget anyway.{" "}
        <b>
          That wasted effort is exactly what our self-tuning version removes:
        </b>{" "}
        it will watch the success rates live and shift the budget toward
        whatever is working right now.
      </p>
    </div>
  );
}
