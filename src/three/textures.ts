// Images used by the 3D scene. Pure canvas work, no three.js here.

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

/**
 * Basemap (or a flat Mars colour) with the slope heatmap painted on top.
 * WHY one canvas: the terrain mesh gets a single texture, so turning the
 * slope layer on/off is just a repaint, not a second mesh fighting for depth.
 */
export async function composeTerrainTexture(baseUrl: string | null, overlayUrl: string | null): Promise<HTMLCanvasElement> {
  const base = baseUrl ? await loadImage(baseUrl) : null;
  const size = Math.min(2048, base?.naturalWidth ?? 1024);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  if (base) ctx.drawImage(base, 0, 0, size, size);
  else {
    ctx.fillStyle = '#9c6a4a';
    ctx.fillRect(0, 0, size, size);
  }
  if (overlayUrl) {
    const overlay = await loadImage(overlayUrl);
    ctx.imageSmoothingEnabled = false; // keep 5 m cells crisp
    ctx.globalAlpha = 0.7;
    ctx.drawImage(overlay, 0, 0, size, size);
  }
  return canvas;
}

export { loadImage };

/**
 * A detail tile's photo, optionally with the slope heatmap on top (cropped to
 * the tile). The heatmap is lighter here so the 25 cm detail still shows.
 */
export function composeTileTexture(
  photo: HTMLImageElement,
  slope: HTMLImageElement | null,
  crop: { sx: number; sy: number; sw: number; sh: number },
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = photo.naturalWidth;
  canvas.height = photo.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(photo, 0, 0);
  if (slope) {
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.45;
    ctx.drawImage(slope, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
  }
  return canvas;
}

/** A soft round dot, used for point / astronaut markers. */
export function dotCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(32, 32, 26, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.stroke();
  return c;
}
