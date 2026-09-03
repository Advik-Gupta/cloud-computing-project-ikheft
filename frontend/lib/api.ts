export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface TaskPlacement {
  task: number;
  vm: number;
  start: number;
  finish: number;
}

export interface ScheduleResult {
  algorithm: string;
  makespan: number;
  speedup: number;
  efficiency: number;
  busy_time: number;
  idle_time: number;
  avg_utilization: number;
  vm_utilization: number[];
  vm_busy_time: number[];
  vm_task_count: number[];
  tasks: TaskPlacement[];
}

export interface Stage {
  label: string;
  description: string;
  ms: number;
}

export interface OperatorStat {
  operator: string;
  attempts: number;
  accepts: number;
}

export interface ScheduleResponse {
  instance: {
    num_tasks: number;
    num_vms: number;
    num_edges: number;
    edge_prob: number;
    seed: number;
    vm_speeds: number[];
  };
  search: {
    iterations: number;
    paper_iterations: number;
    elapsed_ms: number;
    operators: OperatorStat[];
    trace: number[];
  };
  stages: Stage[];
  naive: ScheduleResult;
  heft: ScheduleResult;
  ikheft: ScheduleResult;
  comparison: {
    makespan_improvement_pct: number;
    efficiency_improvement_pct: number;
    time_saved: number;
    naive_to_heft_pct: number;
    naive_to_ikheft_pct: number;
  };
}

export interface ScheduleRequest {
  num_tasks: number;
  num_vms: number;
  seed?: number | null;
}

export async function requestSchedule(
  body: ScheduleRequest,
): Promise<ScheduleResponse> {
  const res = await fetch(`${API_URL}/api/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Scheduler API returned ${res.status}: ${detail}`);
  }
  return res.json();
}

/** Stable per-task colour, so the same task keeps its colour across both
 *  charts and migrations between VMs are visible at a glance. */
export function taskColor(task: number, total: number): string {
  const hue = (task * 360) / Math.max(total, 1);
  return `hsl(${hue.toFixed(1)} 62% 58%)`;
}
