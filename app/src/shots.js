// Fixed scenes for screenshots: a `?shot=` query asks the app to set up one scene deterministically and to
// set window.__shotReady once it is painted, so a screenshot tool can capture it. `?shot=cover` shows a
// finished cover alone, `?shot=editor` shows the editor at work. `photo` names the built-in samples to load
// (comma-separated, e.g. photo=boulevard,pier), `caption` the cover's title, and `layout` and `grade` pick
// the collage template and colour grade.
import { POST_SIZES } from './cover.js';

/** The shot scene named by the page's query, or null when the page was opened without one. */
export function parseShot() {
  const query = new URLSearchParams(location.search);
  const mode = query.get('shot');
  if (!mode) return null;
  return {
    mode,
    photos: (query.get('photo') ?? 'boulevard').split(',').map((s) => s.trim()).filter(Boolean),
    title: query.get('caption') ?? 'Sunset Heist',
    subtitle: query.get('subtitle') ?? 'Neon Coast Nights',
    layout: query.get('layout') ?? 'classic',
    grade: query.get('grade') ?? 'sunset',
  };
}

/** The post size whose aspect best matches a viewport: the cover scene fills the window it is shot in. */
export function coverSizeForViewport(vw, vh) {
  const target = Math.log(vw / vh);
  let best = 'square';
  let bestGap = Infinity;
  for (const [id, size] of Object.entries(POST_SIZES)) {
    const gap = Math.abs(Math.log(size.w / size.h) - target);
    if (gap < bestGap) {
      bestGap = gap;
      best = id;
    }
  }
  return best;
}
