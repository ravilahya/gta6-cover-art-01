// ViceFrame, a GTA-style cover art studio: wires the editor page to the cover renderer (cover.js). The owner
// adds photos from their own machine (they are read locally and never uploaded), fills the angled panels of
// a collage layout with them, frames each panel by dragging on the cover or with sliders, picks a sunset or
// neon grade, writes the caption, and exports a PNG in the common post sizes. A `?shot=` query sets up a
// fixed scene for screenshots instead (shots.js).
import {
  POST_SIZES, SIZE_ORDER, TITLE_THEME_ORDER, defaultPanels, drawCover, makePanel, renderCoverCanvas, titleThemeName,
} from './cover.js';
import { GRADE_ORDER, GRADES } from './grade.js';
import { LAYOUT_ORDER, LAYOUTS, panelBounds, pointInPanel } from './layouts.js';
import { coverSizeForViewport, parseShot } from './shots.js';

/** The built-in sample scenes, free to use: the studio works, and can be screenshotted, with no upload. */
const SAMPLES = [
  { id: 'boulevard', name: 'Boulevard', url: 'samples/boulevard.jpg' },
  { id: 'pier', name: 'Pier', url: 'samples/pier.jpg' },
];

const state = {
  photos: [],
  photoNames: [],
  layout: 'classic',
  panels: [],
  grade: 'sunset',
  gradeStrength: 0.85,
  title: 'Sunset Heist',
  subtitle: 'Neon Coast Nights',
  titleSize: 1,
  titlePos: 'top',
  titleTheme: 'classic',
  size: 'portrait',
};
let selected = 0;
let lastPanels = [];
let shotMode = null;

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const ctx = canvas.getContext('2d');
const status = $('status');

/** Loads an image from a URL (a sample file or an object URL for an owner's photo), resolving once drawable. */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Redraws the preview at the current post size, then outlines the selected panel (never in a cover shot). */
function render() {
  const size = POST_SIZES[state.size];
  if (canvas.width !== size.w) canvas.width = size.w;
  if (canvas.height !== size.h) canvas.height = size.h;
  lastPanels = drawCover(ctx, size.w, size.h, state);
  if (shotMode !== 'cover' && lastPanels[selected]) {
    ctx.save();
    ctx.strokeStyle = '#19e3ff';
    ctx.lineWidth = Math.max(3, size.w * 0.004);
    ctx.setLineDash([size.w * 0.02, size.w * 0.014]);
    ctx.beginPath();
    lastPanels[selected].forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

/** Rebuilds the photo tray: one thumbnail button per photo; clicking one fills the selected panel with it. */
function renderTray() {
  const tray = $('tray');
  tray.replaceChildren();
  state.photos.forEach((img, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'thumb' + (state.panels[selected]?.photo === i ? ' active' : '');
    const thumb = document.createElement('img');
    thumb.src = img.src;
    thumb.alt = state.photoNames[i];
    const label = document.createElement('span');
    label.textContent = state.photoNames[i];
    btn.append(thumb, label);
    btn.addEventListener('click', () => {
      if (state.panels[selected]) state.panels[selected].photo = i;
      syncPanelControls();
      renderTray();
      render();
    });
    tray.append(btn);
  });
}

/** Copies the selected panel's framing into its controls (photo, zoom, pan, flip). */
function syncPanelControls() {
  const p = state.panels[selected];
  if (!p) return;
  $('panelPhoto').value = String(p.photo);
  $('zoom').value = String(p.zoom);
  $('panX').value = String(p.panX);
  $('panY').value = String(p.panY);
  $('flip').checked = p.flip;
  $('panelTitle').textContent = `Panel ${selected + 1} of ${state.panels.length}`;
  renderTray();
}

/** Rebuilds the photo <select> of the panel controls from the loaded photos. */
function syncPhotoOptions() {
  const select = $('panelPhoto');
  select.replaceChildren();
  state.photoNames.forEach((name, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = name;
    select.append(opt);
  });
}

/** Adds a loaded photo to the studio; the first photos also seed the collage's panel framings. */
function addPhoto(img, name) {
  state.photos.push(img);
  state.photoNames.push(name);
  if (state.panels.length === 0 || state.photos.length <= 2) {
    state.panels = defaultPanels(state.layout, state.photos.length);
    selected = 0;
  }
  syncPhotoOptions();
  syncPanelControls();
  render();
}

/** Sends a rendered cover canvas to the owner's downloads as a PNG and says so in the status line. */
function downloadPNG(canvasEl, sizeId) {
  const size = POST_SIZES[sizeId];
  canvasEl.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `viceframe-cover-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    status.textContent = `Saved viceframe-cover-${size.w}x${size.h}.png — ready to post.`;
  }, 'image/png');
}

function exportPNG(sizeId) {
  downloadPNG(renderCoverCanvas(state, sizeId), sizeId);
}

/** Builds the layout picker: one button per collage template, the current one lit. */
function buildLayoutButtons() {
  const host = $('layouts');
  host.replaceChildren();
  for (const id of LAYOUT_ORDER) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'layout-btn' + (state.layout === id ? ' active' : '');
    btn.textContent = LAYOUTS[id].name;
    btn.addEventListener('click', () => {
      if (state.layout === id) return;
      const before = state.panels;
      state.layout = id;
      const fresh = defaultPanels(id, Math.max(1, state.photos.length));
      state.panels = fresh.map((d, i) => (before[i] ? { ...before[i], photo: before[i].photo % Math.max(1, state.photos.length) } : d));
      selected = 0;
      buildLayoutButtons();
      syncPanelControls();
      render();
    });
    host.append(btn);
  }
}

/** Fills a <select> with [value, label] options and a current value. */
function fillSelect(select, options, value) {
  select.replaceChildren();
  for (const [v, label] of options) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = label;
    select.append(opt);
  }
  select.value = value;
}

/** Wires every control of the editor to the state. Called once, at boot. */
function wireControls() {
  fillSelect($('size'), SIZE_ORDER.map((id) => [id, `${POST_SIZES[id].name} · ${POST_SIZES[id].w}x${POST_SIZES[id].h}`]), state.size);
  fillSelect($('grade'), GRADE_ORDER.map((id) => [id, GRADES[id].name]), state.grade);
  fillSelect($('titleTheme'), TITLE_THEME_ORDER.map((id) => [id, titleThemeName(id)]), state.titleTheme);
  fillSelect($('titlePos'), [['top', 'Top'], ['bottom', 'Bottom']], state.titlePos);
  buildLayoutButtons();

  $('size').addEventListener('change', (e) => { state.size = e.target.value; render(); });
  $('grade').addEventListener('change', (e) => { state.grade = e.target.value; render(); });
  $('gradeStrength').addEventListener('input', (e) => { state.gradeStrength = Number(e.target.value); render(); });
  $('title').addEventListener('input', (e) => { state.title = e.target.value; render(); });
  $('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; render(); });
  $('titleSize').addEventListener('input', (e) => { state.titleSize = Number(e.target.value); render(); });
  $('titleTheme').addEventListener('change', (e) => { state.titleTheme = e.target.value; render(); });
  $('titlePos').addEventListener('change', (e) => { state.titlePos = e.target.value; render(); });

  $('panelPhoto').addEventListener('change', (e) => { state.panels[selected].photo = Number(e.target.value); renderTray(); render(); });
  $('zoom').addEventListener('input', (e) => { state.panels[selected].zoom = Number(e.target.value); render(); });
  $('panX').addEventListener('input', (e) => { state.panels[selected].panX = Number(e.target.value); render(); });
  $('panY').addEventListener('input', (e) => { state.panels[selected].panY = Number(e.target.value); render(); });
  $('flip').addEventListener('change', (e) => { state.panels[selected].flip = e.target.checked; render(); });
  $('fillAll').addEventListener('click', () => {
    const photo = state.panels[selected].photo;
    for (const p of state.panels) p.photo = photo;
    render();
    status.textContent = `Every panel now shows ${state.photoNames[photo]}.`;
  });
  $('resetFraming').addEventListener('click', () => {
    const photo = state.panels[selected].photo;
    state.panels[selected] = makePanel(photo, 1.06, 0, 0);
    syncPanelControls();
    render();
  });

  $('photoFiles').addEventListener('change', async (e) => {
    for (const file of e.target.files) {
      if (file.type.startsWith('image/')) addPhoto(await loadImage(URL.createObjectURL(file)), file.name);
    }
    e.target.value = '';
  });
  for (const id of SIZE_ORDER) {
    $(`export-${id}`).addEventListener('click', () => exportPNG(id));
  }
  $('export').addEventListener('click', () => exportPNG(state.size));

  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    for (const file of e.dataTransfer.files) {
      if (file.type.startsWith('image/')) addPhoto(await loadImage(URL.createObjectURL(file)), file.name);
    }
  });
}

/** Canvas pointer work: click selects a panel, dragging pans its photo, the wheel zooms it. */
function wireCanvas() {
  let drag = null;
  const toCanvas = (e) => {
    const rect = canvas.getBoundingClientRect();
    return [(e.clientX - rect.left) * (canvas.width / rect.width), (e.clientY - rect.top) * (canvas.height / rect.height)];
  };
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = toCanvas(e);
    for (let i = lastPanels.length - 1; i >= 0; i--) {
      if (pointInPanel(lastPanels[i], x, y)) {
        selected = i;
        syncPanelControls();
        render();
        drag = { x, y, panX: state.panels[i].panX, panY: state.panels[i].panY };
        canvas.setPointerCapture(e.pointerId);
        break;
      }
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const [x, y] = toCanvas(e);
    const p = state.panels[selected];
    const img = state.photos[p.photo];
    if (!img) return;
    const b = panelBounds(lastPanels[selected]);
    const base = Math.max(b.w / img.naturalWidth, b.h / img.naturalHeight) * Math.max(1, p.zoom);
    const maxPanX = Math.max(0, (img.naturalWidth * base - b.w) / 2);
    const maxPanY = Math.max(0, (img.naturalHeight * base - b.h) / 2);
    if (maxPanX > 0) p.panX = clamp(drag.panX + (x - drag.x) / maxPanX, -1, 1);
    if (maxPanY > 0) p.panY = clamp(drag.panY + (y - drag.y) / maxPanY, -1, 1);
    $('panX').value = String(p.panX);
    $('panY').value = String(p.panY);
    render();
  });
  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = state.panels[selected];
    if (!p) return;
    p.zoom = clamp(p.zoom * (e.deltaY < 0 ? 1.08 : 0.93), 1, 4);
    $('zoom').value = String(p.zoom);
    render();
  }, { passive: false });
}

/** Loads the sample photos named by ids (default: both) into the studio, in order. */
async function loadSamples(ids) {
  for (const id of ids) {
    const sample = SAMPLES.find((s) => s.id === id) ?? SAMPLES[0];
    addPhoto(await loadImage(sample.url), sample.name);
  }
}

/** Sets up the fixed screenshot scene, then flags it ready once two frames have been painted. */
async function initShot(shot) {
  shotMode = shot.mode;
  state.title = shot.title;
  state.subtitle = shot.subtitle;
  state.layout = shot.layout;
  state.grade = shot.grade;
  if (shot.mode === 'cover') {
    document.body.classList.add('shot-cover');
    state.size = coverSizeForViewport(window.innerWidth, window.innerHeight);
  }
  wireControls();
  wireCanvas();
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('grade').value = state.grade;
  buildLayoutButtons();
  await loadSamples(shot.photos);
  state.panels = defaultPanels(state.layout, state.photos.length);
  selected = 0;
  syncPanelControls();
  render();
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}

/** The normal boot: both samples loaded, the editor live. */
async function initEditor() {
  wireControls();
  wireCanvas();
  await loadSamples(SAMPLES.map((s) => s.id));
  status.textContent = 'Samples loaded. Add your own photos, frame the panels, then export.';
}

const shot = parseShot();
if (shot) {
  initShot(shot);
} else {
  initEditor();
}
