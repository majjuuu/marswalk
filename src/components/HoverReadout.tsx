import { MAX_PASSABLE_SLOPE_DEG, elevationAt, returnCostAt, slopeAt } from '../engine';
import type { ElevationGrid, SlopeGrid, XY } from '../types';

const MARS_M_PER_DEG = (3396190 * Math.PI) / 180;

/**
 * What's under the pointer: position, height, slope, and the O2 it costs to
 * walk home from there. Lat/lon idea from Mughani05's marswalk3d.
 */
export function HoverReadout({ p, grid, elevation }: { p: XY; grid: SlopeGrid; elevation: ElevationGrid | null }) {
  const slope = slopeAt(grid, p);
  const home = returnCostAt(grid, { x: 0, y: 0 }, p);
  const geo = elevation?.rover_lon !== undefined && elevation.rover_lat !== undefined;
  // Our grid is equirectangular (lat_ts = 0), so degrees are a straight division.
  const lon = geo ? elevation!.rover_lon! + p.x / MARS_M_PER_DEG : null;
  const lat = geo ? elevation!.rover_lat! + p.y / MARS_M_PER_DEG : null;
  const rel = elevation ? elevationAt(elevation, p) : null;
  return (
    <div className="hover-readout">
      {lat !== null && lon !== null && (
        <div>{lat.toFixed(5)}°N {lon.toFixed(5)}°E</div>
      )}
      {rel !== null && (
        <div>
          {rel >= 0 ? '+' : ''}{rel.toFixed(1)} m vs rover
          {elevation?.rover_elevation_m !== undefined && (
            <span className="muted"> ({(elevation.rover_elevation_m + rel).toFixed(0)} m areoid)</span>
          )}
        </div>
      )}
      <div className={slope > MAX_PASSABLE_SLOPE_DEG ? 'bad' : ''}>
        Slope {slope.toFixed(0)}°{slope > MAX_PASSABLE_SLOPE_DEG ? ' · impassable' : ''}
      </div>
      <div>
        {Number.isFinite(home) ? `Walk home: ${home.toFixed(0)} min O2` : 'No walkable way home'}
        <span className="muted"> · {Math.round(Math.hypot(p.x, p.y))} m from rover</span>
      </div>
    </div>
  );
}
