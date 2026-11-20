// Panel layout templates for the cover collage. Each layout is a set of polygons in unit space (0..1 on both
// axes) that tile the whole frame with shared, slightly diagonal edges: the angled cuts between panels are
// what give a cover the GTA-poster collage feel. The renderer scales the polygons to any post size, so one
// template serves the square, portrait, story and wide frames alike.

/** One panel of a layout: a polygon of [x, y] points in unit space. */
export const LAYOUTS = {
  // The classic poster: a big hero panel across the top left, a second scene top right, two mid panels and
  // a wide strip along the foot.
  classic: {
    name: 'Classic Collage',
    panels: [
      [[0, 0], [0.6, 0], [0.5, 0.54], [0, 0.6]],
      [[0.6, 0], [1, 0], [1, 0.42], [0.5, 0.54]],
      [[0, 0.6], [0.5, 0.54], [0.44, 0.8], [0, 0.84]],
      [[0.5, 0.54], [1, 0.42], [1, 0.8], [0.44, 0.8]],
      [[0, 0.84], [0.44, 0.8], [1, 0.8], [1, 1], [0, 1]],
    ],
  },
  // One tall hero panel on the left and three stacked strips on the right.
  hero: {
    name: 'Hero & Strips',
    panels: [
      [[0, 0], [0.56, 0], [0.48, 1], [0, 1]],
      [[0.56, 0], [1, 0], [1, 0.34], [0.5328, 0.34]],
      [[0.5328, 0.34], [1, 0.34], [1, 0.67], [0.5064, 0.67]],
      [[0.5064, 0.67], [1, 0.67], [1, 1], [0.48, 1]],
    ],
  },
  // Six panels in two columns and three rows, the column split drifting a little from row to row.
  grid: {
    name: 'Six Panel Grid',
    panels: [
      [[0, 0], [0.52, 0], [0.48, 0.34], [0, 0.34]],
      [[0.52, 0], [1, 0], [1, 0.34], [0.48, 0.34]],
      [[0, 0.34], [0.48, 0.34], [0.52, 0.67], [0, 0.67]],
      [[0.48, 0.34], [1, 0.34], [1, 0.67], [0.52, 0.67]],
      [[0, 0.67], [0.52, 0.67], [0.48, 1], [0, 1]],
      [[0.52, 0.67], [1, 0.67], [1, 1], [0.48, 1]],
    ],
  },
  // Two scenes split by one long diagonal.
  duo: {
    name: 'Diagonal Duo',
    panels: [
      [[0, 0], [1, 0], [0.38, 1], [0, 1]],
      [[1, 0], [1, 1], [0.38, 1]],
    ],
  },
  // A single full-bleed frame.
  single: {
    name: 'Full Frame',
    panels: [
      [[0, 0], [1, 0], [1, 1], [0, 1]],
    ],
  },
};

/** The layout ids in the order the editor offers them. */
export const LAYOUT_ORDER = ['classic', 'hero', 'grid', 'duo', 'single'];

/** The polygons of a layout, scaled to a w x h frame: an array of panels, each an array of [x, y] pixels. */
export function scaledPanels(layoutId, w, h) {
  const layout = LAYOUTS[layoutId] ?? LAYOUTS.classic;
  return layout.panels.map((panel) => panel.map(([x, y]) => [x * w, y * h]));
}

/** The bounding box {x, y, w, h} of a pixel-space polygon. */
export function panelBounds(panel) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of panel) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Whether the pixel point (px, py) falls inside a pixel-space polygon (ray cast). */
export function pointInPanel(panel, px, py) {
  let inside = false;
  for (let i = 0, j = panel.length - 1; i < panel.length; j = i++) {
    const [xi, yi] = panel[i];
    const [xj, yj] = panel[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
