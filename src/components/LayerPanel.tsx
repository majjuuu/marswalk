import type { MapLayer } from '../types';
import type { LayerVisibility } from './MapView';

interface Props {
  layers: LayerVisibility;
  onChange: (l: LayerVisibility) => void;
  resolution: Partial<Record<keyof LayerVisibility, string>>;
  baseLayers: MapLayer[];
  baseId: string;
  onBaseChange: (id: string) => void;
}

const NAMES: Record<keyof LayerVisibility, string> = {
  basemap: 'Base map',
  slope: 'Slope heatmap',
  boundary: 'Safe-return boundary',
  route: 'Route',
  points: 'Points',
};

export function LayerPanel({ layers, onChange, resolution, baseLayers, baseId, onBaseChange }: Props) {
  const base = baseLayers.find((l) => l.id === baseId);
  return (
    <section className="panel">
      <h3>Layers</h3>
      {baseLayers.length > 1 && (
        <label className="row">
          <span>Base</span>
          <select value={baseId} onChange={(e) => onBaseChange(e.target.value)}>
            {baseLayers.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </label>
      )}
      {(Object.keys(NAMES) as (keyof LayerVisibility)[]).map((k) => (
        <label key={k} className="row">
          <input type="checkbox" checked={layers[k]} onChange={(e) => onChange({ ...layers, [k]: e.target.checked })} />
          <span>{NAMES[k]}</span>
          {resolution[k] && <small className="muted">{resolution[k]}</small>}
        </label>
      ))}
      {base && layers.basemap && <LayerKey layer={base} />}
    </section>
  );
}

/** Legend + caveat + citation for the current base map. */
function LayerKey({ layer }: { layer: MapLayer }) {
  return (
    <div className="layer-key">
      {layer.legend?.map((l) => (
        <div key={l.label} className="row">
          <span className="swatch" style={{ background: l.color }} />
          <span>{l.label}</span>
          <small className="muted">{l.percent}%</small>
        </div>
      ))}
      {layer.gradient && (
        <div>
          <div className="ramp" style={{ background: `linear-gradient(90deg, ${layer.gradient.stops.join(', ')})` }} />
          <div className="row">
            <small>{layer.gradient.min}</small>
            <small className="muted" style={{ margin: '0 auto' }}>{layer.gradient.units}</small>
            <small>{layer.gradient.max}</small>
          </div>
        </div>
      )}
      {layer.note && <p className="muted">{layer.note}</p>}
      <p className="cite">{layer.citation}</p>
    </div>
  );
}
