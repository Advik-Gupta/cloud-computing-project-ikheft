"""Random DAG workload generator.

Mirrors the experimental setup in Desai, Li & Shi (ICSIM 2026), Section 4.1:
n tasks, m VMs, edge probability 0.3, heterogeneous per-(task, VM) execution
times and per-edge communication costs.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field


@dataclass
class Instance:
    """A DAG scheduling instance.

    et[i][v]        execution time of task i on VM v            -> ET(t_i, v)
    vm_speed[v]     relative speed of VM v (heterogeneous fleet)
    comm[(i, j)]    communication cost on edge i -> j           -> Comm(p, i)
    children[i]     successors of task i
    parents[i]      predecessors of task i
    """

    n: int
    m: int
    et: list[list[float]]
    comm: dict[tuple[int, int], float]
    children: list[list[int]]
    parents: list[list[int]]
    #: Relative speed of each VM. 2.0 runs a task twice as fast as 1.0 does.
    vm_speed: list[float]
    #: Intrinsic size of each task, before any VM's speed is applied.
    task_weight: list[float]
    seed: int = 0
    avg_et: list[float] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.avg_et:
            self.avg_et = [sum(row) / self.m for row in self.et]

    @property
    def num_edges(self) -> int:
        return len(self.comm)


def generate_instance(
    num_tasks: int,
    num_vms: int,
    edge_prob: float = 0.3,
    seed: int | None = None,
    weight_range: tuple[float, float] = (10.0, 100.0),
    speed_range: tuple[float, float] = (0.5, 2.0),
    pair_noise: float = 0.25,
    comm_range: tuple[float, float] = (10.0, 100.0),
) -> Instance:
    """Generate a random DAG with `num_tasks` tasks over `num_vms` VMs.

    Tasks are indexed in a topological order by construction: an edge may only
    run from a lower index to a higher one, so the graph is acyclic by design.

    The VM fleet is *heterogeneous*: each VM draws a relative speed, so some
    machines are genuinely faster than others for every task, the way an
    m5.large differs from an m5.4xlarge. Execution time is then

        ET(i, v) = task_weight[i] / vm_speed[v] * noise

    where the small per-pair noise keeps one VM from being uniformly best (some
    tasks are memory-bound, some CPU-bound). Without a per-VM speed factor every
    machine would have the same average throughput and there would be nothing
    for a scheduler to exploit.
    """
    if num_tasks < 1:
        raise ValueError("num_tasks must be >= 1")
    if num_vms < 1:
        raise ValueError("num_vms must be >= 1")
    if not 0.0 <= edge_prob <= 1.0:
        raise ValueError("edge_prob must be in [0, 1]")

    if seed is None:
        seed = random.randrange(2**31)
    rng = random.Random(seed)

    vm_speed = [rng.uniform(*speed_range) for _ in range(num_vms)]
    task_weight = [rng.uniform(*weight_range) for _ in range(num_tasks)]
    et = [
        [
            task_weight[i]
            / vm_speed[v]
            * rng.uniform(1.0 - pair_noise, 1.0 + pair_noise)
            for v in range(num_vms)
        ]
        for i in range(num_tasks)
    ]

    children: list[list[int]] = [[] for _ in range(num_tasks)]
    parents: list[list[int]] = [[] for _ in range(num_tasks)]
    comm: dict[tuple[int, int], float] = {}

    for i in range(num_tasks):
        for j in range(i + 1, num_tasks):
            if rng.random() < edge_prob:
                children[i].append(j)
                parents[j].append(i)
                comm[(i, j)] = rng.uniform(*comm_range)

    # Keep the workload a single connected workflow: every non-entry task that
    # ended up isolated gets one random predecessor from an earlier index.
    for j in range(1, num_tasks):
        if not parents[j] and not children[j]:
            i = rng.randrange(j)
            children[i].append(j)
            parents[j].append(i)
            comm[(i, j)] = rng.uniform(*comm_range)

    return Instance(
        n=num_tasks,
        m=num_vms,
        et=et,
        comm=comm,
        children=children,
        parents=parents,
        vm_speed=vm_speed,
        task_weight=task_weight,
        seed=seed,
    )
