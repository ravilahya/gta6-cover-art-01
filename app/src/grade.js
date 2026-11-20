// Colour grades: the Vice City sunset / neon treatments laid over the photos. A grade is a CSS-filter style
// boost applied to each photo as it is drawn (saturation, contrast, brightness) plus a vertical colour wash
// (transparent at the top, saturated at the foot) whose stops are [position, red, green, blue] with the alpha
// scaled by the grade's strength. The same wash is drawn per panel and once more over the whole cover, so a
// collage of different photos still reads as one poster.

export const GRADES = {
  sunset: {
    name: 'Vice Sunset',
    sat: 1.3, con: 1.09, bri: 1.03,
    stops: [
      [0, 255, 176, 66],
      [0.45, 255, 94, 98],
      [1, 150, 34, 148],
    ],
    wash: 0.5,
  },
  neon: {
    name: 'Neon Nights',
    sat: 1.42, con: 1.13, bri: 1.0,
    stops: [
      [0, 0, 229, 255],
      [0.5, 64, 30, 160],
      [1, 255, 46, 136],
    ],
    wash: 0.46,
  },
  dusk: {
    name: 'Dusk Purple',
    sat: 1.18, con: 1.1, bri: 0.97,
    stops: [
      [0, 88, 60, 180],
      [0.55, 120, 40, 140],
      [1, 30, 10, 60],
    ],
    wash: 0.5,
  },
  gold: {
    name: 'Golden Hour',
    sat: 1.22, con: 1.05, bri: 1.06,
    stops: [
      [0, 255, 205, 110],
      [0.6, 255, 140, 60],
      [1, 160, 60, 90],
    ],
    wash: 0.42,
  },
  clean: {
    name: 'Clean',
    sat: 1.08, con: 1.04, bri: 1.01,
    stops: [
      [0, 255, 170, 90],
      [1, 200, 60, 120],
    ],
    wash: 0.16,
  },
};

/** The grade ids in the order the editor offers them. */
export const GRADE_ORDER = ['sunset', 'neon', 'dusk', 'gold', 'clean'];

/** The canvas filter string for a grade at a strength (0..1): a lerp from no boost to the grade's full boost. */
export function gradeFilter(gradeId, strength) {
  const g = GRADES[gradeId] ?? GRADES.sunset;
  const mix = (full) => 1 + (full - 1) * strength;
  return `saturate(${mix(g.sat).toFixed(3)}) contrast(${mix(g.con).toFixed(3)}) brightness(${mix(g.bri).toFixed(3)})`;
}

/** Fills the rect (x, y, w, h) with the grade's vertical wash at the given strength and alpha scale. */
export function paintWash(ctx, gradeId, strength, x, y, w, h, scale = 1) {
  const g = GRADES[gradeId] ?? GRADES.sunset;
  const alpha = g.wash * strength * scale;
  if (alpha <= 0.003 || h <= 0) return;
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  for (const [pos, r, gg, b] of g.stops) grad.addColorStop(pos, `rgba(${r}, ${gg}, ${b}, ${alpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
}

let grainTile = null;

/** A 256 x 256 tile of random grey noise, made once: drawn tiled over the cover it reads as film grain. */
export function grainPattern(ctx) {
  if (grainTile === null) {
    grainTile = document.createElement('canvas');
    grainTile.width = 256;
    grainTile.height = 256;
    const g = grainTile.getContext('2d');
    const img = g.createImageData(256, 256);
    let seed = 20261119;
    for (let i = 0; i < img.data.length; i += 4) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const v = 96 + (seed % 128);
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  return ctx.createPattern(grainTile, 'repeat');
}
