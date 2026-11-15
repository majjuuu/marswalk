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

// ---- public/data/layers.json -------------------------------------------
/** A picture draped under everything (2D and 3D): HiRISE, colour, minerals, thermal... */
export interface MapLayer {
  id: string;
  label: string;
  src: string; // image covering exactly the slope grid's extent
  resolution: string;
  citation: string;
  note?: string;
  /** Categorical key (e.g. minerals), with % of the area. */
  legend?: { color: string; label: string; percent: number }[];
  /** Continuous ramp (e.g. thermal inertia). */
  gradient?: { stops: string[]; min: number; max: number; units: string };
}

/** Optional geo-reference stored in elevation.json, for lat/lon readouts. */
export interface GeoRef {
  rover_lon: number; // degrees east
  rover_lat: number; // degrees north
  rover_elevation_m: number; // height of the rover's ground above the Mars areoid
}

// ---- public/data/detail/tiles.json (optional, 3D close-up) ---------------
/** 1 m terrain + 25 cm imagery tiles around the work area, for the 3D eye view. */
export interface DetailIndex {
  size_m: number; // tile edge length
  vertices: number; // vertices per edge (size_m / cell_m + 1, edges shared)
  cell_m: number;
  height_unit_m: number; // .bin stores int16 heights in these units, relative to the rover
  tex_px: number;
  citation: string;
  tiles: { id: string; x0: number; y0: number; dem: string; tex: string }[]; // x0,y0 = north-west vertex
}

// ---- public/data/science.json (optional) ---------------------------------
/** Short, sourced science notes shown with a target's images. */
export interface ScienceNote {
  id: string;
  point_ids: string[];
  title: string;
  paragraphs: string[];
  eva_note?: string; // our own planning advice, kept apart from the published science
  sources: { label: string; url: string }[];
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

// ---- public/data/elevation.json -----------------------------------------
/**
 * Same shape and grid as SlopeGrid, but data = metres RELATIVE TO THE ROVER
 * (rover ground = 0). Optional: only the 3D view needs it.
 */
export type ElevationGrid = SlopeGrid & Partial<GeoRef>;

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
