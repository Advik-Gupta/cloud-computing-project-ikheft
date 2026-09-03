"""Evaluation metrics (Eq. 4-9) and a schedule feasibility validator."""

from __future__ import annotations

from .dag import Instance
from .heft import Schedule


def makespan(sched: Schedule) -> float:
    """Eq. (4)."""
    return max((p.finish for p in sched.placements), default=0.0)


def t_serial(inst: Instance) -> float:
    """Eq. (5): the single fastest VM running the whole workload."""
    return min(
        sum(inst.et[i][v] for i in range(inst.n)) for v in range(inst.m)
    )


def speedup(inst: Instance, sched: Schedule) -> float:
    """Eq. (6)."""
    return t_serial(inst) / sched.makespan if sched.makespan > 0 else 0.0


def efficiency(inst: Instance, sched: Schedule) -> float:
    """Eq. (7): speedup normalised by VM count."""
    return speedup(inst, sched) / inst.m


def improvement_pct(baseline: float, proposed: float) -> float:
    """Eq. (8), MI_HEFT: percentage makespan reduction vs the HEFT baseline.
    Positive means the proposed schedule finishes sooner."""
    if baseline <= 0:
        return 0.0
    return (baseline - proposed) / baseline * 100.0


def efficiency_improvement_pct(baseline: float, proposed: float) -> float:
    """Eq. (9), EI_HEFT, with the sign that matches the paper's Table 2.

    Eq. (9) is printed as (Eff_HEFT - Eff_proposed) / Eff_HEFT, which is
    negative when the proposal is better, yet Table 2 reports gains as
    positive. We follow the table: higher efficiency -> positive number.
    """
    if baseline <= 0:
        return 0.0
    return (proposed - baseline) / baseline * 100.0


def validate(inst: Instance, sched: Schedule) -> None:
    """Raise if the schedule violates precedence, communication delays, VM
    exclusivity, task durations, or the reported makespan."""
    if len(sched.placements) != inst.n:
        raise AssertionError(
            f"expected {inst.n} placements, got {len(sched.placements)}"
        )

    by_task: dict[int, object] = {}
    for p in sched.placements:
        if p.task in by_task:
            raise AssertionError(f"task {p.task} scheduled twice")
        by_task[p.task] = p
    if len(by_task) != inst.n:
        raise AssertionError("not every task was scheduled")

    eps = 1e-6
    for p in sched.placements:
        if not 0 <= p.vm < inst.m:
            raise AssertionError(f"task {p.task} on out-of-range VM {p.vm}")
        dur = inst.et[p.task][p.vm]
        if abs((p.finish - p.start) - dur) > eps:
            raise AssertionError(
                f"task {p.task} duration {p.finish - p.start} != ET {dur}"
            )
        if p.start < -eps:
            raise AssertionError(f"task {p.task} starts before time 0")

        for parent in inst.parents[p.task]:
            pp = by_task[parent]
            required = pp.finish  # type: ignore[attr-defined]
            if pp.vm != p.vm:  # type: ignore[attr-defined]
                required += inst.comm[(parent, p.task)]
            if p.start < required - eps:
                raise AssertionError(
                    f"task {p.task} starts at {p.start} before parent {parent} "
                    f"delivers at {required}"
                )

    per_vm: dict[int, list[tuple[float, float]]] = {}
    for p in sched.placements:
        per_vm.setdefault(p.vm, []).append((p.start, p.finish))
    for vm, spans in per_vm.items():
        spans.sort()
        for (s1, f1), (s2, _) in zip(spans, spans[1:]):
            if s2 < f1 - eps:
                raise AssertionError(
                    f"VM {vm} runs overlapping tasks: [{s1},{f1}] and [{s2}, ...]"
                )

    reported = max(p.finish for p in sched.placements)
    if abs(reported - sched.makespan) > eps:
        raise AssertionError(
            f"reported makespan {sched.makespan} != actual {reported}"
        )
