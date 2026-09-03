"""FastAPI wrapper around the HEFT / IKHeft schedulers.

Run with:  uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from scheduler.baseline import round_robin
from scheduler.dag import Instance, generate_instance
from scheduler.heft import Schedule, heft, rank_u
from scheduler.ikheft import OPERATORS, ikheft
from scheduler.metrics import (
    efficiency,
    efficiency_improvement_pct,
    improvement_pct,
    speedup,
    validate,
)

MAX_TASKS = 640
MAX_VMS = 32
PAPER_ITERATIONS = 2000
TRACE_POINTS = 120

app = FastAPI(title="Cloud Task Scheduling Optimizer", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScheduleRequest(BaseModel):
    num_tasks: int = Field(80, ge=2, le=MAX_TASKS)
    num_vms: int = Field(8, ge=2, le=MAX_VMS)
    edge_prob: float = Field(0.3, ge=0.0, le=1.0)
    seed: int | None = Field(None, description="omit for a fresh random workload")
    iterations: int | None = Field(
        None,
        ge=1,
        le=20000,
        description="local-search moves; defaults to a size-aware budget",
    )


def iteration_budget(num_tasks: int) -> int:
    """The paper runs a flat 2,000 moves. That is several seconds of Python at
    n=640, so for interactive use we taper the budget with graph size while
    keeping the paper's budget for the sizes where it is cheap."""
    scaled = int(PAPER_ITERATIONS * (160 / max(num_tasks, 1)) ** 1.5)
    return max(250, min(PAPER_ITERATIONS, scaled))


def _downsample(values: list[float], points: int = TRACE_POINTS) -> list[float]:
    if len(values) <= points:
        return values
    step = len(values) / points
    return [values[min(int(i * step), len(values) - 1)] for i in range(points)]


def _serialize(inst: Instance, sched: Schedule, algorithm: str) -> dict:
    busy = [0.0] * inst.m
    counts = [0] * inst.m
    for p in sched.placements:
        busy[p.vm] += p.finish - p.start
        counts[p.vm] += 1
    ms = sched.makespan
    total_busy = sum(busy)
    total_capacity = ms * inst.m
    return {
        "algorithm": algorithm,
        "makespan": ms,
        "speedup": speedup(inst, sched),
        "efficiency": efficiency(inst, sched),
        # How much of the rented VM time actually did work. The rest is a VM
        # sitting idle with the meter running -- the gaps in the Gantt chart.
        "busy_time": total_busy,
        "idle_time": max(total_capacity - total_busy, 0.0),
        "avg_utilization": (total_busy / total_capacity) if total_capacity else 0.0,
        "vm_utilization": [(b / ms if ms > 0 else 0.0) for b in busy],
        "vm_busy_time": busy,
        "vm_task_count": counts,
        "tasks": sorted(
            (
                {
                    "task": p.task,
                    "vm": p.vm,
                    "start": p.start,
                    "finish": p.finish,
                }
                for p in sched.placements
            ),
            key=lambda t: (t["vm"], t["start"]),
        ),
    }


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/schedule")
def schedule(req: ScheduleRequest) -> dict:
    """Generate a random workflow and schedule it with HEFT and IKHeft."""
    stages: list[dict] = []

    def timed(label: str, description: str, fn):
        t0 = time.perf_counter()
        value = fn()
        stages.append(
            {
                "label": label,
                "description": description,
                "ms": (time.perf_counter() - t0) * 1000,
            }
        )
        return value

    inst = timed(
        "Generate workflow",
        "Build a random task graph: which tasks exist, which must wait for "
        "which, and how long each one takes on each VM.",
        lambda: generate_instance(
            req.num_tasks, req.num_vms, edge_prob=req.edge_prob, seed=req.seed
        ),
    )
    iterations = req.iterations or iteration_budget(req.num_tasks)

    naive_sched = timed(
        "Naive schedule",
        "Deal the tasks out to VMs in a plain round-robin, in dependency order. "
        "No prioritisation, no VM choice.",
        lambda: round_robin(inst),
    )

    ranks = timed(
        "Rank tasks",
        "Score every task by how much work still depends on it (its upward "
        "rank), so the ones holding up the most get scheduled first.",
        lambda: rank_u(inst),
    )

    heft_sched = timed(
        "HEFT schedule",
        "Walk the tasks in rank order and put each one on whichever VM can "
        "finish it earliest, slotting it into idle gaps where it fits.",
        lambda: heft(inst, ranks=ranks),
    )

    result = timed(
        "IKHeft local search",
        f"Take HEFT's answer and try {iterations} small random rearrangements, "
        "keeping only the ones that shorten the finish time.",
        lambda: ikheft(
            inst,
            iterations=iterations,
            seed=inst.seed,
            heft_schedule=heft_sched,
            ranks=ranks,
        ),
    )
    elapsed_ms = sum(st["ms"] for st in stages)

    validate(inst, naive_sched)
    validate(inst, heft_sched)
    validate(inst, result.schedule)

    ik_sched = result.schedule

    return {
        "instance": {
            "num_tasks": inst.n,
            "num_vms": inst.m,
            "num_edges": inst.num_edges,
            "edge_prob": req.edge_prob,
            "seed": inst.seed,
            # Heterogeneous fleet: 2.0 runs a task twice as fast as 1.0.
            "vm_speeds": inst.vm_speed,
        },
        "stages": stages,
        "search": {
            "iterations": iterations,
            "paper_iterations": PAPER_ITERATIONS,
            "elapsed_ms": elapsed_ms,
            "operators": [
                {
                    "operator": op,
                    "attempts": result.stats.attempts[op],
                    "accepts": result.stats.accepts[op],
                }
                for op in OPERATORS
            ],
            "trace": _downsample(result.stats.trace),
        },
        "naive": _serialize(inst, naive_sched, "Round-robin"),
        "heft": _serialize(inst, heft_sched, "HEFT"),
        "ikheft": _serialize(inst, ik_sched, "IKHeft"),
        "comparison": {
            "makespan_improvement_pct": improvement_pct(
                heft_sched.makespan, ik_sched.makespan
            ),
            "efficiency_improvement_pct": efficiency_improvement_pct(
                efficiency(inst, heft_sched), efficiency(inst, ik_sched)
            ),
            "time_saved": heft_sched.makespan - ik_sched.makespan,
            "naive_to_heft_pct": improvement_pct(
                naive_sched.makespan, heft_sched.makespan
            ),
            "naive_to_ikheft_pct": improvement_pct(
                naive_sched.makespan, ik_sched.makespan
            ),
        },
    }
