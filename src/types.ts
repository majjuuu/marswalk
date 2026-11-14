// Shared data contract. Keep in sync with docs/CONTRACT.md.
// Coordinates everywhere: local meters, (0,0) = rover parking spot, x = east, y = north.

export type XYPair = [number, number];

export interface XY {
  x: number;
  y: number;
}

// ---- public/data/points.json --------------------------------------------
export type PointType = 'rover' | 'target' | 'sample' | 'hazard';
export type SampleKind = 'spot' | 'no-spot' | 'blank';

export interface MapPoint {
  id: string;
  name: string;
  type: PointType;
  x: number;
  y: number;
  note?: string;
  /** Only for type "sample" (extension to the base contract). */
  sample_kind?: SampleKind;
}

// ---- public/data/images.json --------------------------------------------
/** A real rover image tied to one or more map points (shown in the image panel). */
export interface SiteImage {
  id: string; // e.g. NASA photojournal id "PIA26368"
  point_ids: string[];
  src: string;
  title: string;
  role: 'context' | 'closeup';
  camera: string;
  sol: number;
  date: string; // Earth date taken, YYYY-MM-DD
  credit: string; // exactly as NASA gives it
  caption: string;
  source_url: string;
}

// ---- public/data/slope.json ---------------------------------------------
export interface SlopeGrid {
  width: number; // columns
  height: number; // rows
  cell_m: number;
  /** Local x of the grid's WEST edge. */
  origin_x: number;
  /** Local y of the grid's NORTH edge (row 0 is the northernmost row). */
  origin_y: number;
  /** Row-major slope in degrees, length = width * height. */
  data: number[];
}

// ---- simulation ---------------------------------------------------------
export interface SimState {
  astronauts: XY[];
  rover: XY;
  o2_min_left: number;
  elapsed_min: number;
  clock_local: string; // "HH:MM" local solar time
}

// ---- safe-return output -------------------------------------------------
export type ReturnStatus = 'ok' | 'warn' | 'turnback';

export interface SafeReturn {
  maxDistance_m: number;
  /** Largest ring of the reachable area (outer boundary). */
  boundaryPolygon: XYPair[];
  status: ReturnStatus;
  /** Minutes until margin hits 0: walking the route if a plan is given, else standing still. */
  minutesToTurnback: number;
  /** Extension: every contour ring (outer + holes around steep patches). */
  rings?: XYPair[][];
  /** Extension: O2 minutes left after the worst astronaut walks home, beyond the reserve. */
  margin_min?: number;
}
