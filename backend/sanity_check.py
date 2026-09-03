"""Correctness + direction check for the HEFT / IKHeft implementation.

Runs a scaled-down version of the paper's (n, m) grid (Section 4.1) and checks:
  1. every schedule produced is feasible (precedence, comm delays, no overlap);
  2. IKHeft never does worse than HEFT on any run (strict improve-or-discard);
  3. mean makespan improvement vs HEFT is positive and shrinks as n grows,
     which is the trend reported in Table 2.

Usage:  python sanity_check.py [--runs 5] [--iters 2000]
"""

from __future__ import annotations

import argparse
import time

from scheduler.dag import generate_instance
from scheduler.ikheft import ikheft
from scheduler.metrics import (
    efficiency,
    efficiency_improvement_pct,
    improvement_pct,
    validate,
)

TASK_COUNTS = (40, 80, 160)
VM_COUNTS = (2, 4, 8, 16)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", type=int, default=5, help="runs per (n, m) cell")
    ap.add_argument("--iters", type=int, default=2000, help="local-search moves")
    args = ap.parse_args()

    failures: list[str] = []
    per_n: dict[int, list[float]] = {n: [] for n in TASK_COUNTS}
    per_n_eff: dict[int, list[float]] = {n: [] for n in TASK_COUNTS}

    print(f"grid: n={TASK_COUNTS} x m={VM_COUNTS}, {args.runs} runs, "
          f"T={args.iters} moves\n")
    header = "   n |  m | HEFT mspan | IKHeft mspan |   MI% |  EI%"
    print(header)
    print("-" * len(header))

    start = time.time()
    for n in TASK_COUNTS:
        for m in VM_COUNTS:
            mi, ei, h_ms, k_ms = [], [], [], []
            for run in range(args.runs):
                inst = generate_instance(n, m, edge_prob=0.3, seed=1000 * n + 10 * m + run)
                res = ikheft(inst, iterations=args.iters, seed=run)

                try:
                    validate(inst, res.heft_schedule)
                    validate(inst, res.schedule)
                except AssertionError as exc:
                    failures.append(f"n={n} m={m} run={run}: {exc}")

                hm, km = res.heft_schedule.makespan, res.schedule.makespan
                if km > hm + 1e-9:
                    failures.append(
                        f"n={n} m={m} run={run}: IKHeft {km} worse than HEFT {hm}"
                    )
                h_ms.append(hm)
                k_ms.append(km)
                mi.append(improvement_pct(hm, km))
                ei.append(
                    efficiency_improvement_pct(
                        efficiency(inst, res.heft_schedule),
                        efficiency(inst, res.schedule),
                    )
                )

            avg = lambda xs: sum(xs) / len(xs)
            per_n[n].extend(mi)
            per_n_eff[n].extend(ei)
            print(f"{n:4d} | {m:2d} | {avg(h_ms):10.1f} | {avg(k_ms):12.1f} | "
                  f"{avg(mi):5.2f} | {avg(ei):5.2f}")

    elapsed = time.time() - start
    print("\nAverage makespan improvement vs HEFT, by task count "
          "(paper Table 2: 3.69 / 2.22 / 1.21):")
    for n in TASK_COUNTS:
        print(f"  n={n:3d}: {sum(per_n[n]) / len(per_n[n]):5.2f}%")

    print(f"\nfinished in {elapsed:.1f}s")

    trend = [sum(per_n[n]) / len(per_n[n]) for n in TASK_COUNTS]
    if any(t <= 0 for t in trend):
        failures.append(f"non-positive mean improvement somewhere: {trend}")
    if not (trend[0] > trend[-1]):
        failures.append(
            f"improvement does not taper with task count as in Table 2: {trend}"
        )

    if failures:
        print(f"\nFAILED ({len(failures)}):")
        for f in failures[:20]:
            print("  -", f)
        return 1
    print("\nAll checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
