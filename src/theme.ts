// Map colours live here (Leaflet draws SVG, which can't read CSS variables
// reliably). UI colours live in src/styles.css. Keep the two in sync.
export const MAP_COLORS = {
  ok: '#3ddc84',
  warn: '#ffcc33',
  turnback: '#ff4d4d',
  route: '#7fb3ff',
  ev1: '#4fd1ff',
  ev2: '#ffb347',
  point: { rover: '#99aadd', target: '#cc99ff', sample: '#66ccff', hazard: '#ff6666' },
} as const;
