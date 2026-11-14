import type { LayerVisibility } from './MapView';

interface Props {
  layers: LayerVisibility;
  onChange: (l: LayerVisibility) => void;
  resolution: Partial<Record<keyof LayerVisibility, string>>;
}

const NAMES: Record<keyof LayerVisibility, string> = {
  basemap: 'Basemap',
  slope: 'Slope heatmap',
  boundary: 'Safe-return boundary',
  route: 'Route',
  points: 'Points',
};

export function LayerPanel({ layers, onChange, resolution }: Props) {
  return (
    <section className="panel">
      <h3>Layers</h3>
      {(Object.keys(NAMES) as (keyof LayerVisibility)[]).map((k) => (
        <label key={k} className="row">
          <input type="checkbox" checked={layers[k]} onChange={(e) => onChange({ ...layers, [k]: e.target.checked })} />
          <span>{NAMES[k]}</span>
          {resolution[k] && <small className="muted">{resolution[k]}</small>}
        </label>
      ))}
    </section>
  );
}
