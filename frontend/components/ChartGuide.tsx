"use client";

/** An always-visible key for the Gantt charts, drawn with the same marks the
 *  charts actually use, so nobody has to guess what a marking means. */
export default function ChartGuide() {
  return (
    <div className="panel guide">
      <div className="guide-title">How to read the three timelines below</div>
      <div className="guide-grid">
        <div className="guide-item">
          <svg viewBox="0 0 120 34" className="guide-svg">
            <rect x={0} y={6} width={120} height={22} fill="#191b1f" rx={3} />
            <rect x={6} y={9} width={26} height={16} fill="#a78bfa" rx={2} />
            <rect x={44} y={9} width={16} height={16} fill="#4ade80" rx={2} />
            <rect x={76} y={9} width={34} height={16} fill="#f472b6" rx={2} />
          </svg>
          <div>
            <b>One row = one virtual machine.</b> Time runs left to right, so a
            row is that machine&apos;s day: what it ran, and when.
          </div>
        </div>

        <div className="guide-item">
          <svg viewBox="0 0 120 34" className="guide-svg">
            <rect x={0} y={6} width={120} height={22} fill="#191b1f" rx={3} />
            <rect x={8} y={9} width={14} height={16} fill="#60a5fa" rx={2} />
            <rect x={30} y={9} width={54} height={16} fill="#60a5fa" rx={2} />
          </svg>
          <div>
            <b>Each coloured block = one task running.</b> Wider means it takes
            longer. A task keeps its colour in all three charts, so you can spot
            the same task moving to a different machine.
          </div>
        </div>

        <div className="guide-item">
          <svg viewBox="0 0 120 34" className="guide-svg">
            <rect x={0} y={6} width={120} height={22} fill="#191b1f" rx={3} />
            <rect x={6} y={9} width={18} height={16} fill="#a78bfa" rx={2} />
            <rect
              x={24}
              y={9}
              width={62}
              height={16}
              fill="#ef4444"
              opacity={0.32}
              rx={2}
            />
            <rect x={86} y={9} width={22} height={16} fill="#a78bfa" rx={2} />
          </svg>
          <div>
            <b>Red = the machine is idle.</b> Rented, powered on, billed by the
            hour - and doing nothing. Less red is a better schedule.
          </div>
        </div>

        <div className="guide-item">
          <svg viewBox="0 0 120 34" className="guide-svg">
            <rect x={0} y={6} width={120} height={22} fill="#191b1f" rx={3} />
            <rect x={6} y={9} width={40} height={16} fill="#a78bfa" rx={2} />
            <line
              x1={56}
              y1={2}
              x2={56}
              y2={32}
              stroke="#4ade80"
              strokeWidth={2}
            />
            <line
              x1={96}
              y1={2}
              x2={96}
              y2={32}
              stroke="#7c8494"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          </svg>
          <div>
            <b>The solid line is when the job finishes</b> - the number we are
            trying to shrink. The dashed line marks where the previous scheduler
            finished, so you can see how much was gained. Further left is
            better.
          </div>
        </div>

        <div className="guide-item">
          <svg viewBox="0 0 120 34" className="guide-svg">
            <line x1={4} y1={20} x2={116} y2={20} stroke="#33373e" />
            {[4, 41, 78, 115].map((x, i) => (
              <text key={i} x={x} y={13} fontSize={9} fill="#6b7280">
                {i * 500}
              </text>
            ))}
          </svg>
          <div>
            <b>The numbers along the bottom are simulated time units</b> - not
            seconds. Only their ratio matters, and all three charts share one
            scale so the finish lines are directly comparable.
          </div>
        </div>

        <div className="guide-item">
          <svg viewBox="0 0 120 34" className="guide-svg">
            <text x={2} y={16} fontSize={10} fill="#9aa0aa">
              VM3
            </text>
            <text x={28} y={16} fontSize={10} fill="#f59e0b" fontWeight={700}>
              1.84×
            </text>
            <rect x={62} y={5} width={54} height={14} fill="#191b1f" rx={3} />
          </svg>
          <div>
            <b>The ×number next to each machine is its speed.</b> 1.84× runs a
            task nearly twice as fast as a 1.0× machine. Watch the smart
            schedulers crowd onto the high numbers.
          </div>
        </div>
      </div>
    </div>
  );
}
