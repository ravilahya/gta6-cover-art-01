// The cover renderer: draws a whole GTA-style poster from a plain state object onto any 2D context at any
// size, so the editor preview, the PNG export and the screenshot scenes all show the same art. A cover is a
// collage of angled panels (layouts.js), each filled with one photo the owner framed (zoom and pan), washed
// with a sunset or neon grade (grade.js), separated by bright poster lines, and finished with the caption in
// big condensed poster lettering with an outline and a colour shadow. No Rockstar artwork, logo or font is
// used: the lettering is drawn with heavy system font stacks.

import { panelBounds, scaledPanels } from './layouts.js';
import { gradeFilter, grainPattern, paintWash } from './grade.js';

/** The post sizes the exporter offers: the common square, portrait, story and wide frames. */
export const POST_SIZES = {
  square: { name: 'Square', w: 1080, h: 1080 },
  portrait: { name: 'Portrait', w: 1080, h: 1350 },
  story: { name: 'Story', w: 1080, h: 1920 },
  wide: { name: 'Wide', w: 1920, h: 1080 },
};
export const SIZE_ORDER = ['square', 'portrait', 'story', 'wide'];

/** Heavy condensed system stacks for the poster lettering (no bundled or proprietary font files). */
const TITLE_FONT = '"Arial Narrow", "HelveticaNeue-CondensedBold", "Franklin Gothic Medium", Impact, "Arial Black", sans-serif';

/** How each title theme fills the letters, outlines them and colours their offset shadow. */
const TITLE_THEMES = {
  classic: { name: 'Classic White', top: '#ffffff', bottom: '#ffe9c9', outline: '#171019', accent: '#ff7847', sub: '#ffd166' },
  neon: { name: 'Neon Nights', top: '#ffffff', bottom: '#c9f6ff', outline: '#0d0a1a', accent: '#ff2e88', accent2: '#19e3ff', sub: '#7df9ff' },
  gold: { name: 'Gold Rush', top: '#fff3b0', bottom: '#f5a623', outline: '#241203', accent: '#7a1f3d', sub: '#ffe9a8' },
};
export const TITLE_THEME_ORDER = ['classic', 'neon', 'gold'];
export const titleThemeName = (id) => (TITLE_THEMES[id] ?? TITLE_THEMES.classic).name;

/** A fresh framing for one panel: which photo fills it, and how it is zoomed and panned (-1..1). */
export function makePanel(photo, zoom = 1, panX = 0, panY = 0, flip = false) {
  return { photo, zoom, panX, panY, flip };
}

/**
 * Default framings for a layout with `photoCount` photos loaded: the panels cycle through the photos with
 * varied crops, so a fresh collage already looks composed before the owner touches a slider.
 */
export function defaultPanels(layoutId, photoCount) {
  const zooms = [1.06, 1.18, 1.55, 1.35, 1.22, 1.45];
  const pans = [[0, -0.08], [0.1, 0], [0.35, 0.1], [-0.2, 0.3], [0, 0.55], [-0.3, -0.2]];
  const count = { classic: 5, hero: 4, grid: 6, duo: 2, single: 1 }[layoutId] ?? 5;
  const out = [];
  for (let i = 0; i < count; i++) {
    const [panX, panY] = pans[i % pans.length];
    out.push(makePanel(photoCount > 0 ? i % photoCount : 0, zooms[i % zooms.length], panX, panY));
  }
  return out;
}

/** Traces a panel polygon as the context's current path. */
function tracePanel(ctx, panel) {
  ctx.beginPath();
  panel.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

/** Draws one panel: its photo framed by the panel's zoom and pan, with the grade's filter and a soft wash. */
function drawPanelPhoto(ctx, panel, framing, state) {
  const b = panelBounds(panel);
  ctx.save();
  tracePanel(ctx, panel);
  ctx.clip();
  const img = state.photos[framing.photo] ?? state.photos[0];
  if (img) {
    const base = Math.max(b.w / img.naturalWidth, b.h / img.naturalHeight);
    const scale = base * Math.max(1, framing.zoom);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const dx = b.x + (b.w - dw) / 2 + framing.panX * Math.max(0, (dw - b.w) / 2);
    const dy = b.y + (b.h - dh) / 2 + framing.panY * Math.max(0, (dh - b.h) / 2);
    if (framing.flip) {
      ctx.translate(b.x + b.w / 2, 0);
      ctx.scale(-1, 1);
      ctx.translate(-(b.x + b.w / 2), 0);
    }
    ctx.filter = gradeFilter(state.grade, state.gradeStrength);
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = 'none';
  } else {
    const grad = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    grad.addColorStop(0, '#3a2150');
    grad.addColorStop(1, '#b03060');
    ctx.fillStyle = grad;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }
  paintWash(ctx, state.grade, state.gradeStrength, b.x, b.y, b.w, b.h, 0.55);
  ctx.restore();
}

/** Splits the caption into one or two balanced lines and shrinks the lettering until it fits the frame. */
function fitTitle(ctx, text, maxWidth, startSize) {
  let size = startSize;
  const setFont = () => { ctx.font = `italic 900 ${size}px ${TITLE_FONT}`; };
  setFont();
  const widest = (lines) => Math.max(...lines.map((l) => ctx.measureText(l).width));
  let lines = [text];
  if (widest(lines) > maxWidth && text.includes(' ')) {
    const words = text.split(/\s+/);
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const pair = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
      const w = widest(pair);
      if (best === null || w < best.w) best = { lines: pair, w };
    }
    if (best !== null && best.w < widest(lines)) lines = best.lines;
  }
  while (widest(lines) > maxWidth && size > 10) {
    size -= 2;
    setFont();
  }
  return { lines, size };
}

/** Draws one lettered line: colour shadow first, then the dark outline, then the gradient face. */
function drawTitleLine(ctx, line, cx, baseline, size, theme) {
  ctx.save();
  ctx.translate(cx, baseline);
  ctx.transform(1, 0, -0.07, 1, 0, 0);
  ctx.font = `italic 900 ${size}px ${TITLE_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  if (theme.accent2) {
    ctx.fillStyle = theme.accent2;
    ctx.fillText(line, -size * 0.045, -size * 0.035);
  }
  ctx.fillStyle = theme.accent;
  ctx.fillText(line, size * 0.05, size * 0.055);
  ctx.strokeStyle = theme.outline;
  ctx.lineWidth = size * 0.17;
  ctx.strokeText(line, 0, 0);
  const face = ctx.createLinearGradient(0, -size * 0.82, 0, size * 0.12);
  face.addColorStop(0, theme.top);
  face.addColorStop(1, theme.bottom);
  ctx.fillStyle = face;
  ctx.fillText(line, 0, 0);
  ctx.restore();
}

/** Draws the caption block: the big title and, under or over it, the letter-spaced subtitle with its rules. */
function drawCaption(ctx, w, h, state) {
  const title = (state.title ?? '').trim().toUpperCase();
  const subtitle = (state.subtitle ?? '').trim().toUpperCase();
  if (!title && !subtitle) return;
  const theme = TITLE_THEMES[state.titleTheme] ?? TITLE_THEMES.classic;
  const atBottom = state.titlePos === 'bottom';
  const startSize = Math.min(w, h) * 0.135 * (state.titleSize ?? 1);
  let blockTop = 0;
  let titleBottom = 0;
  if (title) {
    const { lines, size } = fitTitle(ctx, title, w * 0.94, startSize);
    const lineHeight = size * 1.02;
    const blockH = lineHeight * lines.length;
    const top = atBottom ? h - h * 0.035 - blockH : h * 0.028;
    blockTop = top;
    lines.forEach((line, i) => drawTitleLine(ctx, line, w / 2, top + size * 0.86 + i * lineHeight, size, theme));
    titleBottom = top + blockH;
    if (subtitle) {
      const subSize = Math.max(13, size * 0.3);
      ctx.save();
      ctx.font = `700 ${subSize}px ${TITLE_FONT}`;
      try { ctx.letterSpacing = `${Math.round(subSize * 0.34)}px`; } catch { /* older engines: no tracking */ }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      const y = atBottom ? blockTop - subSize * 0.7 : titleBottom + subSize * 1.25;
      ctx.strokeStyle = theme.outline;
      ctx.lineWidth = subSize * 0.22;
      ctx.strokeText(subtitle, w / 2, y);
      ctx.fillStyle = theme.sub;
      ctx.fillText(subtitle, w / 2, y);
      const half = ctx.measureText(subtitle).width / 2 + subSize * 0.9;
      ctx.strokeStyle = theme.sub;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = Math.max(2, subSize * 0.09);
      ctx.beginPath();
      ctx.moveTo(w * 0.06, y - subSize * 0.32);
      ctx.lineTo(w / 2 - half, y - subSize * 0.32);
      ctx.moveTo(w / 2 + half, y - subSize * 0.32);
      ctx.lineTo(w * 0.94, y - subSize * 0.32);
      ctx.stroke();
      ctx.restore();
    }
  }
}

/**
 * Draws the whole cover described by `state` onto ctx at w x h and returns the panels in pixels (the editor
 * uses them for hit-testing). State: {photos, layout, panels, grade, gradeStrength, title, subtitle,
 * titleSize, titlePos, titleTheme}.
 */
export function drawCover(ctx, w, h, state) {
  const panels = scaledPanels(state.layout, w, h);
  ctx.fillStyle = '#0b0b10';
  ctx.fillRect(0, 0, w, h);
  panels.forEach((panel, i) => drawPanelPhoto(ctx, panel, state.panels[i] ?? makePanel(0), state));

  // One wash over the whole collage, a vignette and a breath of grain, so the panels read as one poster.
  paintWash(ctx, state.grade, state.gradeStrength, 0, 0, w, h, 0.8);
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
  vig.addColorStop(0, 'rgba(8, 3, 16, 0)');
  vig.addColorStop(1, `rgba(8, 3, 16, ${0.16 + state.gradeStrength * 0.22})`);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grainPattern(ctx);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // The bright poster lines between panels and around the frame.
  const line = Math.max(4, Math.min(w, h) * 0.011);
  ctx.strokeStyle = '#f7f3e9';
  ctx.lineWidth = line;
  ctx.lineJoin = 'round';
  for (const panel of panels) {
    tracePanel(ctx, panel);
    ctx.stroke();
  }
  ctx.strokeRect(line / 2, line / 2, w - line, h - line);

  drawCaption(ctx, w, h, state);
  return panels;
}

/** Renders the cover to an offscreen canvas at a post size: what the Export button downloads. */
export function renderCoverCanvas(state, sizeId) {
  const size = POST_SIZES[sizeId] ?? POST_SIZES.square;
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  drawCover(canvas.getContext('2d'), size.w, size.h, state);
  return canvas;
}
