"use client";

import { useCallback, useEffect, useState } from "react";

import ChartGuide from "@/components/ChartGuide";
import ComparisonBars from "@/components/ComparisonBars";
import ControlPanel from "@/components/ControlPanel";
import GanttChart from "@/components/GanttChart";
import ImprovementBadge from "@/components/ImprovementBadge";
import InfoTip from "@/components/InfoTip";
import OperatorTable from "@/components/OperatorTable";
import PipelineSteps from "@/components/PipelineSteps";
import VmFleet from "@/components/VmFleet";
import { ScheduleResponse, requestSchedule } from "@/lib/api";

export default function Home() {
  const [numTasks, setNumTasks] = useState(80);
  const [numVms, setNumVms] = useState(8);
  // A fixed default seed keeps the opening screen reproducible; "Shuffle"
  // or clearing the field gives a fresh workload.
  const [seed, setSeed] = useState("42");
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showIdle, setShowIdle] = useState(true);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    const startedAt = Date.now();
    try {
      const parsed = seed.trim() === "" ? null : Number(seed);
      const result = await requestSchedule({
        num_tasks: numTasks,
        num_vms: numVms,
        seed: Number.isFinite(parsed as number) ? parsed : null,
      });
      // Let the pipeline animation play out so the steps are readable even
      // when the backend answers in a few hundred milliseconds.
      const remaining = 1500 - (Date.now() - startedAt);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} - is the Python API running on port 8000?`
          : "Unknown error",
      );
    } finally {
      setLoading(false);
    }
  }, [numTasks, numVms, seed]);

  useEffect(() => {
    void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const timeMax = data
    ? Math.max(data.naive.makespan, data.heft.makespan, data.ikheft.makespan) *
      1.02
    : 1;

  return (
    <main className="page">
      <header className="masthead">
        <span className="eyebrow">Cloud Computing Project · Review 1</span>
        <h1>Self-Tuning and Adaptive Cloud Task Scheduling System</h1>
        <p className="subtitle">
          A big cloud job is really hundreds of small tasks, and some of them
          can&apos;t start until others finish. Somebody has to decide{" "}
          <b>which task runs on which machine, and in what order</b>. Decide
          badly and you pay for machines that sit idle. This page generates such
          a job and lets three different schedulers attempt it, side by side.
        </p>
      </header>

      <ControlPanel
        numTasks={numTasks}
        numVms={numVms}
        seed={seed}
        loading={loading}
        showIdle={showIdle}
        onTasksChange={setNumTasks}
        onVmsChange={setNumVms}
        onSeedChange={setSeed}
        onShowIdleChange={setShowIdle}
        onGenerate={generate}
      />

      {error && <div className="error">{error}</div>}

      <PipelineSteps stages={data?.stages ?? null} loading={loading} />

      {!data && !error && !loading && (
        <div className="panel empty">Generating workload…</div>
      )}

      {data && !loading && (
        <>
          <ImprovementBadge data={data} />
          <ComparisonBars data={data} />

          <div className="section-title">Why this is a hard problem</div>
          <VmFleet data={data} />

          <div className="section-title">The same job, drawn as a timeline</div>
          <ChartGuide />

          <div className="chart-stack">
            <GanttChart
              name="1. Round-robin"
              blurb="the naive way - no strategy at all"
              accent="#ef4444"
              result={data.naive}
              timeMax={timeMax}
              numTasks={data.instance.num_tasks}
              showIdle={showIdle}
              vmSpeeds={data.instance.vm_speeds}
              info={
                <>
                  Goes through the tasks in dependency order and hands each one
                  to the next machine in turn, like dealing cards. It never asks
                  which task is urgent, and never asks which machine is fast.
                  The result is a lot of red: machines waiting around for work
                  that was given to somebody else.
                </>
              }
            />
            <GanttChart
              name="2. HEFT"
              blurb="the industry standard since 2002"
              accent="#94a3b8"
              result={data.heft}
              timeMax={timeMax}
              numTasks={data.instance.num_tasks}
              showIdle={showIdle}
              vmSpeeds={data.instance.vm_speeds}
              referenceMakespan={data.naive.makespan}
              referenceLabel="Round-robin"
              info={
                <>
                  Two ideas. First, it works out how much of the job is stuck
                  waiting behind each task, and does the most
                  &ldquo;blocking&rdquo; tasks first. Second, for each task it
                  checks every machine and picks whichever one would{" "}
                  <i>finish</i> it soonest - including slotting it into an idle
                  gap. This is what real orchestrators do, and it is our honest
                  baseline.
                </>
              }
            />
            <GanttChart
              name="3. IKHeft"
              blurb="the 2026 paper - our starting point"
              accent="#4ade80"
              result={data.ikheft}
              timeMax={timeMax}
              numTasks={data.instance.num_tasks}
              showIdle={showIdle}
              vmSpeeds={data.instance.vm_speeds}
              referenceMakespan={data.heft.makespan}
              referenceLabel="HEFT"
              info={
                <>
                  Starts from HEFT&apos;s answer and refuses to accept it as
                  final. It tries thousands of small random rearrangements -
                  move a task, swap two tasks, swap two machines&apos;
                  workloads, re-plan entirely - and keeps a change only if the
                  job finishes sooner. It can therefore never end up worse than
                  HEFT, only equal or better.
                </>
              }
            />
          </div>

          <div className="section-title">Where our project goes next</div>
          <OperatorTable data={data} />
        </>
      )}
    </main>
  );
}
