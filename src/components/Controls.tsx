export type Mode = 'plan' | 'navigate';

export function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="segmented">
      {(['plan', 'navigate'] as Mode[]).map((m) => (
        <button key={m} className={mode === m ? 'active' : ''} onClick={() => onChange(m)}>
          {m === 'plan' ? 'Plan' : 'Navigate'}
        </button>
      ))}
    </div>
  );
}

export function PlanControls(props: {
  waypointCount: number;
  summary: string;
  onUndo: () => void;
  onClear: () => void;
}) {
  return (
    <section className="panel">
      <h3>Plan</h3>
      <p className="muted">Click the map to add waypoints. The boundary shows the safe zone at arrival.</p>
      <p>{props.summary}</p>
      <div className="row">
        <button onClick={props.onUndo} disabled={!props.waypointCount}>Undo</button>
        <button onClick={props.onClear} disabled={!props.waypointCount}>Clear</button>
      </div>
    </section>
  );
}

export const SPEEDS = [1, 2, 5, 10];

export function NavControls(props: {
  playing: boolean;
  speed: number;
  onPlayPause: () => void;
  onReset: () => void;
  onReturn: () => void;
  onSpeed: (s: number) => void;
}) {
  return (
    <section className="panel">
      <h3>Navigate</h3>
      <div className="row">
        <button className="primary" onClick={props.onPlayPause}>{props.playing ? 'Pause' : 'Play'}</button>
        <button onClick={props.onReset}>Reset</button>
        <button onClick={props.onReturn}>Return to rover</button>
      </div>
      <label className="row">
        <span>Speed</span>
        <select value={props.speed} onChange={(e) => props.onSpeed(Number(e.target.value))}>
          {SPEEDS.map((s) => <option key={s} value={s}>{s} sim-min / s</option>)}
        </select>
      </label>
    </section>
  );
}
