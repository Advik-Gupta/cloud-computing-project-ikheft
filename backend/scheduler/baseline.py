"""A naive scheduler, standing in for "what you get without HEFT".

This is the control case for the demo's three-way comparison. It keeps the same
insertion-based runtime kernel as HEFT so the comparison is apples-to-apples --
the *only* things it gives up are the two ideas HEFT contributes:

  1. no priority ordering: tasks run in plain dependency order, not sorted by
     upward rank, so work on the critical path is not hurried along;
  2. no VM choice: tasks are dealt out round-robin instead of being placed on
     the VM that finishes them earliest, so fast VMs and slow VMs get equal work
     even though they are heterogeneous.

That is a fair picture of a default "spread the tasks evenly" orchestrator.
"""

from __future__ import annotations

from .dag import Instance
from .heft import Schedule, schedule_with_insertion, topo_order_with_priority


def round_robin(inst: Instance) -> Schedule:
    """Plain topological order, VMs assigned cyclically."""
    # Priority = -index gives the natural task order among ready tasks, i.e. no
    # rank-based prioritisation at all.
    order = topo_order_with_priority(inst, [-float(i) for i in range(inst.n)])
    assignment = [0] * inst.n
    for position, task in enumerate(order):
        assignment[task] = position % inst.m
    return schedule_with_insertion(inst, order, assignment=assignment)
