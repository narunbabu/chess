export const EBOOK_COLOR_ROLES = {
  best: '#81b64c',
  candidate: '#7b61a6',
  check: '#ef4444',
  capture: '#5b8dd9',
  threat: '#c9882a',
  target: '#f59e0b',
  lastMove: 'rgba(255,221,0,0.35)',
  wrong: 'rgba(220,60,60,0.35)',
  safe: 'rgba(129,182,76,0.25)',
};

export const EBOOK_BOARD_THEME = {
  light: '#eeeed2',
  dark: '#769656',
};

export function getColorRole(colorRole, fallback = EBOOK_COLOR_ROLES.best) {
  return EBOOK_COLOR_ROLES[colorRole] || fallback;
}

export function normalizeArrow(arrow) {
  if (!arrow) return null;

  if (Array.isArray(arrow)) {
    return arrow;
  }

  if (arrow.from && arrow.to) {
    return [arrow.from, arrow.to, getColorRole(arrow.colorRole, arrow.color || EBOOK_COLOR_ROLES.best)];
  }

  return null;
}

export function normalizeArrows(arrows = []) {
  return arrows.map(normalizeArrow).filter(Boolean);
}

export function normalizeHighlight(highlight) {
  if (!highlight) return null;

  if (typeof highlight === 'string') {
    return {
      square: highlight,
      style: {
        backgroundColor: EBOOK_COLOR_ROLES.safe,
        borderRadius: '2px',
      },
    };
  }

  if (highlight.square) {
    return {
      square: highlight.square,
      style: {
        backgroundColor: getColorRole(highlight.colorRole, highlight.color || EBOOK_COLOR_ROLES.safe),
        borderRadius: highlight.borderRadius || '2px',
        boxShadow: highlight.outline ? `inset 0 0 0 3px ${highlight.outline}` : undefined,
      },
    };
  }

  return null;
}

export function normalizeHighlights(highlights = []) {
  return highlights.map(normalizeHighlight).filter(Boolean);
}

