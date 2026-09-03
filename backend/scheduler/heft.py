"""Classic HEFT baseline.

Implements, in the notation of Desai, Li & Shi (ICSIM 2026):
  - Eq. (1) upward rank
  - Eq. (2) earliest finish time
  - Algorithm 1: TopoOrderWithPriority
  - Algorithm 2: ScheduleWithInsertion
"""

from __future__ import annotations

from bisect import insort
from dataclasses import dataclass

from .dag import Instance


@dataclass
class Placement:
    task: int
    vm: int
    start: float
    finish: float


@dataclass
class Schedule:
    placements: list[Placement]
    makespan: float

    @property
    def vm_of(self) -> list[int]:
        """VM assignment vector, indexed by task id (the label vector L)."""
        out = [0] * len(self.placements)
        for p in self.placements:
            out[p.task] = p.vm
        return out


def rank_u(inst: Instance) -> list[float]:
    """Eq. (1): u_i = avg_ET(t_i) + max_{j in succ(i)} (w_ij + u_j).

    Leaf tasks satisfy u_i = avg_ET(t_i). Tasks are already in topological
    order by construction, so a reverse sweep suffices.
    """
    u = [0.0] * inst.n
    for i in range(inst.n - 1, -1, -1):
        best = 0.0
        for j in inst.children[i]:
            cand = inst.comm[(i, j)] + u[j]
            if cand > best:
                best = cand
        u[i] = inst.avg_et[i] + best
    return u


def find_gap(timeline: list[tuple[float, float]], ready: float, dur: float) -> float:
    """Earliest start >= `ready` where a `dur`-long slot fits between the busy
    intervals of a VM (the insertion policy of Algorithm 2)."""
    t = ready
    for start, finish in timeline:
        if finish <= t:
            continue
        if start - t >= dur:
            return t
        if finish > t:
            t = finish
    return t


def earliest_ready(
    inst: Instance, task: int, vm: int, placed: list[Placement | None]
) -> float:
    """Earliest instant all parents of `task` have finished *and* delivered
    their data to `vm`. Communication is free between tasks on the same VM."""
    r = 0.0
    for p in inst.parents[task]:
        pp = placed[p]
        if pp is None:  # pragma: no cover - topological order guarantees this
            raise RuntimeError(f"parent {p} of task {task} scheduled out of order")
        arrival = pp.finish
        if pp.vm != vm:
            arrival += inst.comm[(p, task)]
        if arrival > r:
            r = arrival
    return r


def schedule_with_insertion(
    inst: Instance,
    order: list[int],
    assignment: list[int] | None = None,
) -> Schedule:
    """Algorithm 2. `assignment=None` means free VM selection (classic HEFT);
    otherwise each task is pinned to assignment[task]."""
    timelines: list[list[tuple[float, float]]] = [[] for _ in range(inst.m)]
    placed: list[Placement | None] = [None] * inst.n
    out: list[Placement] = []
    makespan = 0.0

    for i in order:
        if assignment is None:
            best_vm, best_start, best_finish = -1, 0.0, float("inf")
            for v in range(inst.m):
                r = earliest_ready(inst, i, v, placed)
                d = inst.et[i][v]
                s = find_gap(timelines[v], r, d)
                f = s + d
                if f < best_finish:
                    best_vm, best_start, best_finish = v, s, f
        else:
            best_vm = assignment[i]
            r = earliest_ready(inst, i, best_vm, placed)
            d = inst.et[i][best_vm]
            best_start = find_gap(timelines[best_vm], r, d)
            best_finish = best_start + d

        p = Placement(task=i, vm=best_vm, start=best_start, finish=best_finish)
        out.append(p)
        placed[i] = p
        insort(timelines[best_vm], (best_start, best_finish))
        if best_finish > makespan:
            makespan = best_finish

    return Schedule(placements=out, makespan=makespan)


def topo_order_with_priority(inst: Instance, priority: list[float]) -> list[int]:
    """Algorithm 1: a DAG-valid order that pops the highest-priority ready task.

    `Ready` is kept sorted by non-increasing priority via InsertByPriority.
    """
    indeg = [len(ps) for ps in inst.parents]
    # Ready list holds (-priority, task) so a plain sorted insert keeps it in
    # non-increasing priority order.
    ready: list[tuple[float, int]] = sorted(
        (-priority[i], i) for i in range(inst.n) if indeg[i] == 0
    )
    order: list[int] = []

    while ready:
        _, u = ready.pop(0)
        order.append(u)
        for v in inst.children[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                insort(ready, (-priority[v], v))

    if len(order) != inst.n:  # pragma: no cover - generator guarantees a DAG
        raise RuntimeError("cycle detected: topological order is incomplete")
    return order


def heft(inst: Instance, ranks: list[float] | None = None) -> Schedule:
    """Classic HEFT: sort by upward rank (descending), then insertion-schedule
    with free VM selection."""
    u = ranks if ranks is not None else rank_u(inst)
    order = topo_order_with_priority(inst, u)
    return schedule_with_insertion(inst, order, assignment=None)
