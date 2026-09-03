# Self-Tuning and Adaptive Cloud Task Scheduling System - Review 1 demo

A local, zero-cost demo that generates a random cloud workflow (DAG) and schedules
it three ways -- a naive **round-robin**, classic **HEFT**, and the paper's
**IKHeft** -- showing all three as Gantt charts on a shared time axis with live
"% faster" numbers.

Based on: Desai, Li & Shi, _"From HEFT to IKHeft: Optimization Algorithm for
Efficient Cloud Task Scheduling"_, ICSIM 2026.

> Scope: review 1 only. The adaptive bandit-based operator selection and the
> cost/makespan tradeoff (our two novelty points) are **not** implemented yet.

## Layout

```
backend/
  scheduler/dag.py       random DAG generator (edge prob 0.3, heterogeneous VM
                         speeds: ET(i,v) = task_weight[i] / vm_speed[v] * noise)
  scheduler/baseline.py  naive round-robin control case (no ranking, no VM choice)
  scheduler/heft.py      Eq.(1) upward rank, Alg.1 TopoOrderWithPriority,
                         Alg.2 ScheduleWithInsertion, classic HEFT
  scheduler/ikheft.py    EvaluateFixedMap + Alg.3 local search (4 operators)
  scheduler/metrics.py   Eq.(4)-(9) + a schedule feasibility validator
  main.py                FastAPI: POST /api/schedule
  sanity_check.py        correctness + paper-direction benchmark
frontend/
  app/page.tsx           form, headline numbers, three charts, operator table
  components/
    ControlPanel.tsx     sliders, seed + shuffle, idle-highlight toggle
    PipelineSteps.tsx    "what the backend just did", with measured per-stage ms
    ImprovementBadge.tsx the two headline percentages
    ComparisonBars.tsx   three-way makespan bar chart
    VmFleet.tsx          per-VM speed vs. how much work each scheduler gave it
    ChartGuide.tsx       always-visible key explaining every chart marking
    GanttChart.tsx       one timeline per scheduler, with idle-gap shading
    OperatorTable.tsx    the four IKHeft moves, in plain language
    InfoTip.tsx          the "?" explainer popovers
  lib/api.ts             typed API client
```

## Demo script (about 4 minutes)

1. **Set the scene.** Point at the title paragraph: a cloud job is many small
   tasks with dependencies, and something has to decide which task runs where.
2. **Press "Generate & schedule".** The _What the backend just did_ strip lights
   up step by step. Say: these are five real stages in the Python backend, and
   the millisecond figures are measured, not decorative. Note that IKHeft's
   search dominates the time -- that is the cost of the optimisation.
3. **The two headline numbers.** Left (green) = our IKHeft vs the industry
   standard HEFT. Right = both smart schedulers vs doing nothing clever. Lead
   with the ~50% number for impact, then explain that the honest, publishable
   number is the ~6% one, because HEFT is the real baseline.
4. **The bar chart.** Three bars, same job, shorter is better. No explanation
   needed -- let it land on its own.
5. **The machines are not identical.** This panel is the "why is this hard"
   moment. The VMs draw random speeds, so the fastest is typically 2-4x the
   slowest. Read the sentence above the table out loud: round-robin gives all 8
   machines the same 10 tasks _regardless of speed_, while IKHeft piles ~40 tasks
   onto the fastest machine and often leaves the slowest ones completely empty --
   because starting a task on a slow machine would finish it _later_ than
   queueing it behind other work on a fast one. That is counter-intuitive and
   lands well with an audience.
6. **The three timelines.** The key above them is always visible -- walk the six
   items (row = VM, block = task, red = idle, solid line = finished, dashed line
   = previous scheduler, x-number = machine speed). Then point at the vertical
   "job done" line marching leftward across the three charts, and at the orange
   (fast) rows filling up while the grey (slow) rows stay red. Toggle
   **Highlight idle VM time** off and on -- the red is money spent on machines
   doing nothing.
7. **The operator table.** This is the punchline. Walk one row: "Swap two VMs'
   workloads gets 20% of the budget and has a 0% success rate -- and it _still_
   gets 20% next time, because the paper hard-codes the split." That is exactly
   the gap our novelty fills.
8. **Press Shuffle, then Generate again** to show it is not one cherry-picked
   case. (If you land on a 0.0% result, that is a real and interesting finding --
   see the notes below.)

Sliders worth trying live: **8 VMs** is where the gains are largest; **2 VMs**
shows near-zero gain because there is almost no assignment freedom to exploit.

## Running it

Two terminals.

```bash
# 1) backend
cd backend
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
./.venv/bin/uvicorn main:app --reload --port 8000

# 2) frontend
cd frontend
npm install
npm run dev          # http://localhost:3000
```

The page loads a workload on first paint. Sliders pick task count (40–640) and VM
count (2–32); **Shuffle** picks a new seed. Every run is reproducible from the seed
in the box. Every "?" button on the page opens a plain-language explanation of the
thing next to it.

## Verifying the implementation

```bash
cd backend && ./.venv/bin/python sanity_check.py --runs 3
```

It runs a scaled-down version of the paper's (n, m) grid and asserts that every
schedule is feasible (precedence, communication delays, no VM overlap, correct
durations), that IKHeft never returns a worse schedule than HEFT, and that mean
improvement is positive and tapers with task count.

Measured against the paper's Table 2 (avg makespan improvement vs HEFT):

| tasks | paper | ours (3 runs × 4 VM counts) |
| ----: | ----: | --------------------------: |
|    40 | 3.69% |                       3.65% |
|    80 | 2.22% |                       2.72% |
|   160 | 1.21% |                       1.45% |

The per-VM shape also matches the paper's figures: gains peak around m = 8 and
are near zero at m = 2, where there is little assignment freedom to exploit.

## Implementation notes worth raising in the review

**1. Algorithm 3 has a stagnation corner.** Lines 4–7 set the incumbent _makespan_
to HEFT's when HEFT beats the first fixed-map evaluation, but set the incumbent
_state_ `(L*, Map*)` unconditionally to the HEFT labels + identity map - a state
that evaluates to the worse makespan. Since every mutation restarts from that state
and acceptance is strict improvement, one move often cannot close the gap and the
search accepts nothing at all. We implemented the pseudocode exactly as printed, so
this shows up as a flat 0.00% result on roughly **13% of random instances** at
n = 80, m = 8. This is a genuine argument for our novelty: an adaptive operator
selector that tracks recent gains has a natural escape from exactly this trap.

**2. Efficiency sign.** Eq. (9) as printed is
`(Eff_HEFT − Eff_proposed) / Eff_HEFT`, which is _negative_ when the proposal is
better, yet Table 2 reports gains as positive. We follow the table.

**3. VM heterogeneity is modelled explicitly.** The paper treats ET(i, v) as an
arbitrary matrix. Drawing every entry independently would make all VMs equal on
average, leaving nothing for a scheduler to exploit, so each VM draws a relative
speed in [0.5, 2.0] and `ET(i,v) = task_weight[i] / vm_speed[v] * U(0.75, 1.25)`.
The small per-pair noise stops one VM from being uniformly best. This moved our
reproduction _closer_ to the paper's Table 2, not further away.

**4. Iteration budget.** The paper runs a flat 2,000 local-search moves. That is
several seconds of pure Python at n = 640, so the API tapers the budget with graph
size (2,000 moves up to n = 160, 707 at n = 320, 250 at n = 640) to keep the demo
interactive. `sanity_check.py` and the library default both use the paper's 2,000;
the API accepts an explicit `iterations` override.

## API

`POST /api/schedule`

```json
{
  "num_tasks": 80,
  "num_vms": 8,
  "edge_prob": 0.3,
  "seed": 42,
  "iterations": null
}
```

Returns `instance`, `search` (iterations, per-operator attempt/accept counts,
incumbent-makespan trace), `heft` and `ikheft` (makespan, speedup, efficiency,
per-VM utilization, and every task's `{task, vm, start, finish}`), and `comparison`.
