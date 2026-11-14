import type { SlopeGrid } from '../types';

// Turn the slope grid into images Leaflet can drop on the map.
// One pixel = one grid cell; row 0 (north) is the top of the image, which is
// exactly how canvas and Leaflet image overlays expect it.

function paint(g: SlopeGrid, color: (slope: number, i: number) => [number, number, number, number]) {
  const canvas = document.createElement('canvas');
  canvas.width = g.width;
  canvas.height = g.height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(g.width, g.height);
  for (let i = 0; i < g.data.length; i++) {
    const [r, gr, b, a] = color(g.data[i], i);
    img.data.set([r, gr, b, a], i * 4);
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

/** Slope heatmap: transparent when flat, yellow -> red, magenta = impassable. */
export function slopeHeatmapUrl(g: SlopeGrid): string {
  return paint(g, (s) => {
    if (s < 5) return [0, 0, 0, 0];
    if (s > 20) return [220, 40, 160, 220];
    const t = (s - 5) / 15; // 0..1
    return [255, Math.round(220 - 170 * t), 40, Math.round(60 + 140 * t)];
  });
}

/**
 * Placeholder basemap: rusty ground shaded by slope so you can "see" terrain.
 * Replace with a HiRISE-derived PNG via DataSource.basemap.url.
 */
export function placeholderBasemapUrl(g: SlopeGrid): string {
  return paint(g, (s, i) => {
    // Shade using the difference to the east neighbour = fake hillshade.
    const east = g.data[i + 1] ?? s;
    const shade = Math.max(0.45, Math.min(1.15, 0.95 - s / 60 + (east - s) / 25));
    return [Math.round(150 * shade), Math.round(88 * shade), Math.round(60 * shade), 255];
  });
}
