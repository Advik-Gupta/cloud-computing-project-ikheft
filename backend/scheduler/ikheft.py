"""IKHeft: iterative label-based local search on top of a HEFT schedule.

Follows Desai, Li & Shi (ICSIM 2026) Section 3.3-3.5 and Algorithm 3:
the HEFT VM vector is reinterpreted as a cluster-label vector L, a
cluster-to-VM lookup Map is maintained alongside it, and four stochastic
operators perturb (L, Map) under a strict improve-or-discard acceptance rule.

Operator probabilities are the paper's fixed distribution:
    single-task relabel 40% | label swap 25% | map swap 20% | free selection 15%
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

from .dag import Instance
from .heft import (
    Schedule,
    heft,
    rank_u,
    schedule_with_insertion,
    topo_order_with_priority,
)

# Cumulative thresholds for the operator draw r ~ U(0, 1) (Algorithm 3, l.11-19).
P_RELABEL = 0.40
P_LABEL_SWAP = 0.65
P_MAP_SWAP = 0.85

OPERATORS = ("relabel", "label_swap", "map_swap", "free_selection")

# Eq. (3): the constant that makes cluster tier dominate the upward rank.
TIER_WEIGHT = 1000.0


@dataclass
class SearchStats:
    """Per-operator bookkeeping. Not used by IKHeft itself, but it is the
    signal the adaptive (bandit) variant will learn from in a later milestone."""

    attempts: dict[str, int] = field(
        default_factory=lambda: {op: 0 for op in OPERATORS}
    )
    accepts: dict[str, int] = field(
        default_factory=lambda: {op: 0 for op in OPERATORS}
    )
    trace: list[float] = field(default_factory=list)  # incumbent makespan per iter


def _priority_key(
    inst: Instance, labels: list[int], ranks: list[float]
) -> list[float]:
    """Eq. (3): pi(t_i) = 1000 * rho(L_i) + u_i + eps_i.

    Clusters are scored by the mean upward rank of their members and sorted so
    that the highest-mean cluster receives the highest tier rho.
    """
    members: dict[int, list[int]] = {}
    for i, c in enumerate(labels):
        members.setdefault(c, []).append(i)

    means = {c: sum(ranks[i] for i in ts) / len(ts) for c, ts in members.items()}
    # Ascending mean -> tier index: best cluster ends up with the largest rho.
    tier = {c: t for t, c in enumerate(sorted(means, key=lambda c: means[c]))}

    n = inst.n
    return [
        TIER_WEIGHT * tier[labels[i]] + ranks[i] + (n - i) * 1e-6
        for i in range(n)
    ]


def evaluate_fixed_map(
    inst: Instance, labels: list[int], vm_map: list[int], ranks: list[float]
) -> Schedule:
    """EvaluateFixedMap: order tasks by the cluster-aware priority key, then
    insertion-schedule them onto the VMs dictated by Map (no free choice)."""
    priority = _priority_key(inst, labels, ranks)
    order = topo_order_with_priority(inst, priority)
    assignment = [vm_map[labels[i]] % inst.m for i in range(inst.n)]
    return schedule_with_insertion(inst, order, assignment=assignment)


def _free_selection(
    inst: Instance, labels: list[int], ranks: list[float]
) -> Schedule:
    """Free-selection step: drop the current Map, rebuild the priority order
    from cluster statistics, and replay the HEFT insertion kernel."""
    priority = _priority_key(inst, labels, ranks)
    order = topo_order_with_priority(inst, priority)
    return schedule_with_insertion(inst, order, assignment=None)


def _identity_map(k: int, m: int) -> list[int]:
    """Map defaults to identity padded to cover every cluster (Section 3.3),
    so every VM stays reachable."""
    return [c % m for c in range(k)]


@dataclass
class IKHeftResult:
    heft_schedule: Schedule
    schedule: Schedule
    iterations: int
    stats: SearchStats


def ikheft(
    inst: Instance,
    iterations: int = 2000,
    seed: int | None = None,
    heft_schedule: Schedule | None = None,
    ranks: list[float] | None = None,
) -> IKHeftResult:
    """Algorithm 3. Returns both the HEFT baseline and the refined schedule."""
    rng = random.Random(seed)
    u = ranks if ranks is not None else rank_u(inst)
    s_heft = heft_schedule if heft_schedule is not None else heft(inst, ranks=u)

    # l.1-3: seed the search from HEFT's VM decisions, read as cluster labels.
    labels = s_heft.vm_of
    k = max(max(labels) + 1, inst.m)
    vm_map = _identity_map(k, inst.m)

    # l.4-7: the incumbent is the better of the fixed-map replay and HEFT itself.
    best = evaluate_fixed_map(inst, labels, vm_map, u)
    if s_heft.makespan < best.makespan:
        best = s_heft
    best_labels, best_map = list(labels), list(vm_map)

    stats = SearchStats()

    for _ in range(iterations):
        # l.9: every mutation starts from the incumbent state.
        cand_labels, cand_map = list(best_labels), list(best_map)
        k = len(cand_map)
        r = rng.random()

        if r < P_RELABEL and inst.n > 0:
            op = "relabel"
            i = rng.randrange(inst.n)
            cand_labels[i] = rng.randrange(k)
        elif r < P_LABEL_SWAP and inst.n >= 2:
            op = "label_swap"
            i, j = rng.sample(range(inst.n), 2)
            cand_labels[i], cand_labels[j] = cand_labels[j], cand_labels[i]
        elif r < P_MAP_SWAP and k >= 2:
            op = "map_swap"
            a, b = rng.sample(range(k), 2)
            cand_map[a], cand_map[b] = cand_map[b], cand_map[a]
        else:
            op = "free_selection"

        stats.attempts[op] += 1

        if op == "free_selection":
            # l.20-26
            cand = _free_selection(inst, cand_labels, u)
            if cand.makespan < best.makespan:
                stats.accepts[op] += 1
                best = cand
                best_labels = cand.vm_of
                k = max(max(best_labels) + 1, inst.m)
                best_map = _identity_map(k, inst.m)
        else:
            # l.28-31
            cand = evaluate_fixed_map(inst, cand_labels, cand_map, u)
            if cand.makespan < best.makespan:
                stats.accepts[op] += 1
                best, best_labels, best_map = cand, cand_labels, cand_map

        stats.trace.append(best.makespan)

    return IKHeftResult(
        heft_schedule=s_heft,
        schedule=best,
        iterations=iterations,
        stats=stats,
    )
