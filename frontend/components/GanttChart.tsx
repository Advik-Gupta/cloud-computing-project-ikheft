"use client";

import InfoTip from "./InfoTip";
import { ScheduleResult, taskColor } from "@/lib/api";

const ROW_H = 22;
const ROW_GAP = 4;
const PAD_L = 96;
const PAD_R = 120;
const PAD_T = 30;
const AXIS_H = 30;
const WIDTH = 1260;

interface Props {
  name: string;
  blurb: string;
  accent: string;
  result: ScheduleResult;
  /** Shared across all three charts so the bars are directly comparable. */
  timeMax: number;
  numTasks: number;
  showIdle: boolean;
  /** Relative speed of each VM, shown next to its row label. */
  vmSpeeds: number[];
  /** Drawn as a dashed "this is what we have to beat" line. */
  referenceMakespan?: number;
  referenceLabel?: string;
  info?: React.ReactNode;
}

/** Gaps on each VM lane between 0 and this schedule's makespan. */
function idleGaps(
  result: ScheduleResult,
): { vm: number; start: number; end: number }[] {
  const perVm = new Map<number, { start: number; finish: number }[]>();
  for (const t of result.tasks) {
    if (!perVm.has(t.vm)) perVm.set(t.vm, []);
    perVm.get(t.vm)!.push({ start: t.start, finish: t.finish });
  }
  const gaps: { vm: number; start: number; end: number }[] = [];
  for (let vm = 0; vm < result.vm_utilization.length; vm++) {
    const spans = (perVm.get(vm) ?? []).sort((a, b) => a.start - b.start);
    let cursor = 0;
    for (const s of spans) {
      if (s.start > cursor) gaps.push({ vm, start: cursor, end: s.start });
      cursor = Math.max(cursor, s.finish);
    }
    if (cursor < result.makespan)
      gaps.push({ vm, start: cursor, end: result.makespan });
  }
  return gaps;
}

export default function GanttChart({
  name,
  blurb,
  accent,
  result,
  timeMax,
  numTasks,
  showIdle,
  vmSpeeds,
  referenceMakespan,
  referenceLabel,
  info,
}: Props) {
  const numVms = result.vm_utilization.length;
  const plotW = WIDTH - PAD_L - PAD_R;
  const plotH = numVms * (ROW_H + ROW_GAP) - ROW_GAP;
  const height = plotH + PAD_T + AXIS_H;

  const x = (t: number) => PAD_L + (t / timeMax) * plotW;
  const rowY = (vm: number) => PAD_T + vm * (ROW_H + ROW_GAP);
  // Four ticks only: a fifth would collide with the "time →" label.
  const ticks = Array.from({ length: 4 }, (_, i) => (timeMax * i) / 4);
  const gaps = showIdle ? idleGaps(result) : [];

  return (
    <div className="panel chart">
      <div className="chart-head">
        <h2>
          <span className="dot" style={{ background: accent }} />
          {name}
          {info && <InfoTip title={`${name}: how it decides`}>{info}</InfoTip>}
          <span className="blurb">{blurb}</span>
        </h2>
        <div className="ms">
          finishes at <b style={{ color: accent }}>{result.makespan.toFixed(0)}</b>
          <span className="util">
            · VMs busy {(result.avg_utilization * 100).toFixed(0)}% of the time
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        width="100%"
        role="img"
        aria-label={`${name}: ${numTasks} tasks across ${numVms} VMs, finishing at ${result.makespan.toFixed(0)}`}
      >
        {Array.from({ length: numVms }, (_, vm) => (
          <g key={`lane-${vm}`}>
            <rect
              x={PAD_L}
              y={rowY(vm)}
              width={plotW}
              height={ROW_H}
              fill="#191b1f"
              rx={3}
            />
            <text
              x={2}
              y={rowY(vm) + ROW_H / 2 + 4}
              textAnchor="start"
              fontSize={11}
              fill="#9aa0aa"
            >
              VM{vm}
            </text>
            <text
              x={PAD_L - 10}
              y={rowY(vm) + ROW_H / 2 + 4}
              textAnchor="end"
              fontSize={10}
              fill={vmSpeeds[vm] >= 1.35 ? "#f59e0b" : "#6b7280"}
              fontWeight={vmSpeeds[vm] >= 1.35 ? 700 : 400}
            >
              {vmSpeeds[vm].toFixed(2)}×
            </text>
          </g>
        ))}

        {/* idle time: VM rented and paid for, doing nothing */}
        {gaps.map((g, i) => (
          <rect
            key={`gap-${i}`}
            x={x(g.start)}
            y={rowY(g.vm) + 3}
            width={Math.max(x(g.end) - x(g.start), 0.5)}
            height={ROW_H - 6}
            fill="#ef4444"
            opacity={0.13}
          >
            <title>{`VM${g.vm} idle for ${(g.end - g.start).toFixed(0)}`}</title>
          </rect>
        ))}

        {result.tasks.map((t) => (
          <rect
            key={t.task}
            x={x(t.start)}
            y={rowY(t.vm) + 3}
            width={Math.max(x(t.finish) - x(t.start), 1)}
            height={ROW_H - 6}
            fill={taskColor(t.task, numTasks)}
            rx={2}
          >
            <title>
              {`task ${t.task} runs on VM${t.vm} from ${t.start.toFixed(0)} to ${t.finish.toFixed(0)}`}
            </title>
          </rect>
        ))}

        {referenceMakespan !== undefined && (
          <g>
            <line
              x1={x(referenceMakespan)}
              x2={x(referenceMakespan)}
              y1={PAD_T - 14}
              y2={PAD_T + plotH + 4}
              stroke="#7c8494"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
            <text
              x={x(referenceMakespan) + 6}
              y={PAD_T - 17}
              fontSize={10}
              fill="#9aa0aa"
            >
              {referenceLabel} ends here
            </text>
          </g>
        )}

        <line
          x1={x(result.makespan)}
          x2={x(result.makespan)}
          y1={PAD_T - 6}
          y2={PAD_T + plotH + 4}
          stroke={accent}
          strokeWidth={2}
        />
        <text
          x={x(result.makespan) + 6}
          y={PAD_T + plotH + 1}
          fontSize={11}
          fill={accent}
          fontWeight={600}
        >
          job done
        </text>

        <line
          x1={PAD_L}
          x2={PAD_L + plotW}
          y1={PAD_T + plotH + 8}
          y2={PAD_T + plotH + 8}
          stroke="#33373e"
        />
        {ticks.map((t, i) => (
          <text
            key={`tick-${i}`}
            x={x(t)}
            y={PAD_T + plotH + 22}
            textAnchor={i === 0 ? "start" : "middle"}
            fontSize={10}
            fill="#6b7280"
          >
            {t.toFixed(0)}
          </text>
        ))}
        <text
          x={PAD_L + plotW + 8}
          y={PAD_T + plotH + 22}
          textAnchor="start"
          fontSize={10}
          fill="#6b7280"
        >
          time →
        </text>
      </svg>
    </div>
  );
}
