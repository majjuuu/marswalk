import { DUST_DEVIL_WINDOW, RESERVE_MIN, START_O2_MIN } from '../engine';
import type { MapPoint, SafeReturn, SimState } from '../types';

export function Readout({ state, safe }: { state: SimState; safe: SafeReturn | null }) {
  const pct = Math.max(0, Math.min(100, (state.o2_min_left / START_O2_MIN) * 100));
  return (
    <section className={`panel readout status-${safe?.status ?? 'ok'}`}>
      <h3>Status</h3>
      <div className="big">{state.o2_min_left.toFixed(0)} min O2</div>
      <div className="bar"><div style={{ width: `${pct}%` }} /></div>
      <dl>
        <dt>Local time</dt><dd>{state.clock_local}</dd>
        <dt>Elapsed</dt><dd>{state.elapsed_min.toFixed(0)} min</dd>
        <dt>Reserve</dt><dd>{RESERVE_MIN} min</dd>
        <dt>Margin</dt><dd>{safe?.margin_min !== undefined ? `${safe.margin_min.toFixed(0)} min` : '-'}</dd>
        <dt>Max range</dt><dd>{safe ? `${(safe.maxDistance_m / 1000).toFixed(2)} km` : '-'}</dd>
        <dt>Status</dt><dd className="status-text">{safe?.status ?? '-'}</dd>
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
        <label key={s.id} className="row">
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
      <small className="muted">{active ? 'ACTIVE NOW' : 'Hard-coded forecast (placeholder)'}</small>
    </section>
  );
}
