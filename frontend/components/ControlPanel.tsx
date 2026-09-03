"use client";

interface Props {
  numTasks: number;
  numVms: number;
  seed: string;
  loading: boolean;
  showIdle: boolean;
  onTasksChange: (v: number) => void;
  onVmsChange: (v: number) => void;
  onSeedChange: (v: string) => void;
  onShowIdleChange: (v: boolean) => void;
  onGenerate: () => void;
}

const TASK_STEPS = [40, 80, 160, 320, 640];
const VM_STEPS = [2, 4, 8, 16, 32];

export default function ControlPanel({
  numTasks,
  numVms,
  seed,
  loading,
  showIdle,
  onTasksChange,
  onVmsChange,
  onSeedChange,
  onShowIdleChange,
  onGenerate,
}: Props) {
  return (
    <div className="panel controls">
      <div className="field">
        <label htmlFor="tasks">
          Tasks in the job <b>{numTasks}</b>
        </label>
        <input
          id="tasks"
          type="range"
          min={0}
          max={TASK_STEPS.length - 1}
          step={1}
          value={TASK_STEPS.indexOf(numTasks)}
          onChange={(e) => onTasksChange(TASK_STEPS[Number(e.target.value)])}
        />
      </div>

      <div className="field">
        <label htmlFor="vms">
          Virtual machines <b>{numVms}</b>
        </label>
        <input
          id="vms"
          type="range"
          min={0}
          max={VM_STEPS.length - 1}
          step={1}
          value={VM_STEPS.indexOf(numVms)}
          onChange={(e) => onVmsChange(VM_STEPS[Number(e.target.value)])}
        />
      </div>

      <div className="field" style={{ minWidth: 220 }}>
        <label htmlFor="seed">Seed (blank = random)</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            id="seed"
            type="number"
            placeholder="random"
            value={seed}
            onChange={(e) => onSeedChange(e.target.value)}
          />
          <button
            className="secondary"
            type="button"
            title="Pick a new random seed"
            onClick={() =>
              onSeedChange(String(Math.floor(Math.random() * 100000)))
            }
          >
            Shuffle
          </button>
        </div>
      </div>

      <button className="primary" onClick={onGenerate} disabled={loading}>
        {loading ? "Scheduling…" : "Generate & schedule"}
      </button>

      <label className="toggle">
        <input
          type="checkbox"
          checked={showIdle}
          onChange={(e) => onShowIdleChange(e.target.checked)}
        />
        Highlight idle VM time
      </label>
    </div>
  );
}
