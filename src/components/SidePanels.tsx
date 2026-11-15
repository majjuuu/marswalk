import { DUST_DEVIL_WINDOW, OBJECTIVES, RESERVE_MIN, START_O2_MIN, type MissionFlags } from '../engine';
import type { MapPoint, SafeReturn, SimState } from '../types';

const STATUS_LABEL = { ok: 'Safe', warn: 'Caution', turnback: 'Turn back' } as const;

export function Readout({ state, safe }: { state: SimState; safe: SafeReturn | null }) {
  const frac = Math.max(0, Math.min(1, state.o2_min_left / START_O2_MIN));
  const status = safe?.status ?? 'ok';
  // Ring gauge: circumference of r=34 is ~213.6.
  const C = 2 * Math.PI * 34;
  return (
    <section className={`panel readout status-${status}`}>
      <div className="readout-head">
        <svg className="gauge" viewBox="0 0 80 80" aria-hidden>
          <circle cx="40" cy="40" r="34" className="gauge-track" />
          <circle cx="40" cy="40" r="34" className="gauge-fill" strokeDasharray={`${C * frac} ${C}`} />
        </svg>
        <div className="gauge-text">
          <span className="big">{state.o2_min_left.toFixed(0)}</span>
          <span className="unit">min O₂</span>
        </div>
        <div className="readout-title">
          <h3>Life support</h3>
          <span className="status-chip"><i />{STATUS_LABEL[status]}</span>
          <span className="clock">{state.clock_local} <small>LMST</small></span>
        </div>
      </div>
      <dl className="metrics">
        <div><dt>Turn back in</dt><dd>{safe ? `${Math.floor(safe.minutesToTurnback)}` : '–'}<small>min</small></dd></div>
        <div><dt>Margin</dt><dd>{safe?.margin_min !== undefined ? safe.margin_min.toFixed(0) : '–'}<small>min</small></dd></div>
        <div><dt>Max range</dt><dd>{safe ? (safe.maxDistance_m / 1000).toFixed(2) : '–'}<small>km</small></dd></div>
        <div><dt>Elapsed</dt><dd>{state.elapsed_min.toFixed(0)}<small>min</small></dd></div>
        <div><dt>Reserve</dt><dd>{RESERVE_MIN}<small>min</small></dd></div>
      </dl>
    </section>
  );
}

const KIND_LABEL = { spot: 'spot', 'no-spot': 'no-spot', blank: 'blank' } as const;

export function SampleChecklist(props: {
  points: MapPoint[];
  collected: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const samples = props.points.filter((p) => p.type === 'sample');
  return (
    <section className="panel">
      <h3>Samples</h3>
      {samples.map((s) => (
        <label key={s.id} className="row check">
          <input type="checkbox" checked={!!props.collected[s.id]} onChange={() => props.onToggle(s.id)} />
          <span>{s.name}</span>
          {s.sample_kind && <span className={`tag tag-${s.sample_kind}`}>{KIND_LABEL[s.sample_kind]}</span>}
        </label>
      ))}
    </section>
  );
}

export function DustDevilPanel({ clock }: { clock: string }) {
  const active = clock >= DUST_DEVIL_WINDOW.start && clock < DUST_DEVIL_WINDOW.end;
  return (
    <section className={`panel ${active ? 'dust-active' : ''}`}>
      <h3>Dust devils</h3>
      <p>{DUST_DEVIL_WINDOW.label}</p>
      <small className={active ? 'live' : 'muted'}>{active ? 'Active now' : 'Hard-coded forecast (placeholder)'}</small>
    </section>
  );
}

export function MissionPanel({ flags }: { flags: MissionFlags }) {
  const done = OBJECTIVES.filter((o) => flags[o.key]).length;
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Objectives</h3>
        <span className="count">{done}/{OBJECTIVES.length}</span>
      </div>
      <div className="progress"><div style={{ width: `${(done / OBJECTIVES.length) * 100}%` }} /></div>
      {OBJECTIVES.map((o) => (
        <div key={o.key} className={`row objective ${flags[o.key] ? 'done' : ''}`}>
          <span className="tick" aria-hidden />
          <span>{o.label}</span>
        </div>
      ))}
      <small className="muted">Ticks itself off as the crew does each step.</small>
    </section>
  );
}
