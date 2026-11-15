import { gridExtent, returnCostAt } from '../engine';
import { MAP_COLORS } from '../theme';
import type { MapPoint, SafeReturn, SlopeGrid, XY } from '../types';

/*
 * Corner minimap for the 3D view: where you are, which way you face (cone),
 * the rover, the points and the safe-return boundary on the current base map.
 * Heading-cone idea from gloriachang's HUD branch; here it sits on the same
 * real grid as everything else, so positions are not illustrative.
 */

const SIZE = 184; // px

interface Props {
  grid: SlopeGrid;
  baseUrl: string;
  viewer: { pos: XY; bearingDeg: number } | null;
  points: MapPoint[];
  astronauts: XY[];
  safe: SafeReturn | null;
  /** Explore mode: click the map to walk there. */
  onPick?: (p: XY) => void;
}

export function MiniMap({ grid, baseUrl, viewer, points, astronauts, safe, onPick }: Props) {
  const e = gridExtent(grid);
  const w = e.east - e.west;
  // Local metres -> minimap pixels (north up).
  const px = (p: XY) => [((p.x - e.west) / w) * SIZE, ((e.north - p.y) / w) * SIZE] as const;
  const ring = safe?.boundaryPolygon ?? [];
  const ringPts = ring.map(([x, y]) => px({ x, y }).join(',')).join(' ');
  const statusColor = MAP_COLORS[safe?.status ?? 'ok'];

  let cone = '';
  if (viewer) {
    const [cx, cy] = px(viewer.pos);
    // Compass bearing (clockwise from north) -> screen angle; 40 degree wide cone.
    const a = ((viewer.bearingDeg - 90) * Math.PI) / 180;
    const half = (20 * Math.PI) / 180;
    const r = 34;
    cone = `${cx},${cy} ${cx + r * Math.cos(a - half)},${cy + r * Math.sin(a - half)} ${cx + r * Math.cos(a + half)},${cy + r * Math.sin(a + half)}`;
  }
  const home = viewer ? returnCostAt(grid, { x: 0, y: 0 }, viewer.pos) : NaN;
  const [rx, ry] = px({ x: 0, y: 0 });

  const click = (ev: React.MouseEvent<SVGSVGElement>) => {
    if (!onPick) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const fx = (ev.clientX - rect.left) / rect.width;
    const fy = (ev.clientY - rect.top) / rect.height;
    onPick({ x: e.west + fx * w, y: e.north - fy * w });
  };

  return (
    <div className="minimap3d panel">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} onClick={click} style={{ cursor: onPick ? 'crosshair' : 'default' }}>
        <image href={baseUrl} width={SIZE} height={SIZE} preserveAspectRatio="none" />
        {ringPts && <polygon points={ringPts} fill="none" stroke={statusColor} strokeWidth="1.2" />}
        {points
          .filter((p) => p.type === 'target' || p.type === 'hazard')
          .map((p) => {
            const [x, y] = px(p);
            return <circle key={p.id} cx={x} cy={y} r="3" fill={MAP_COLORS.point[p.type]} stroke="#111" strokeWidth="0.8" />;
          })}
        {astronauts.map((a, i) => {
          const [x, y] = px(a);
          return <circle key={i} cx={x} cy={y} r="2.5" fill={i ? MAP_COLORS.ev2 : MAP_COLORS.ev1} />;
        })}
        <rect x={rx - 3.5} y={ry - 3.5} width="7" height="7" fill="#fff" stroke="#111" strokeWidth="0.8" />
        {viewer && (
          <>
            <polygon points={cone} fill={MAP_COLORS.ev1} opacity="0.45" />
            <circle cx={px(viewer.pos)[0]} cy={px(viewer.pos)[1]} r="3.5" fill={MAP_COLORS.ev1} stroke="#111" strokeWidth="1" />
          </>
        )}
        <text x={SIZE - 10} y="14" fontSize="11" fill="#fff" textAnchor="middle">N</text>
      </svg>
      {viewer && (
        <small>
          {Math.round(viewer.bearingDeg)}° · {Math.round(Math.hypot(viewer.pos.x, viewer.pos.y))} m from rover ·{' '}
          {Number.isFinite(home) ? `walk home ${home.toFixed(0)} min O2` : 'no walkable way home'}
        </small>
      )}
      <small className="muted">White square = rover · {onPick ? 'click map to walk there' : `${(w / 1000).toFixed(1)} km across`}</small>
    </div>
  );
}
