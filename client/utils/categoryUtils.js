/**
 * Category utilities for expenses
 */

export const CAT_COLORS = {
  Food:      { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  Travel:    { bg: 'rgba(124,110,255,0.12)', color: '#a594ff' },
  Events:    { bg: 'rgba(244,63,94,0.12)',   color: '#f43f5e' },
  Utilities: { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e' },
  Shopping:  { bg: 'rgba(56,189,248,0.12)',  color: '#38bdf8' },
  General:   { bg: 'rgba(122,121,138,0.12)', color: '#7a798a' },
};

export const CAT_EMOJI = {
  Food: '🍕', Travel: '✈', Events: '🎉',
  Utilities: '🏠', Shopping: '🛒', General: '🧾',
};

/**
 * Get category colors
 * @param {string} category - Category name
 * @returns {object} Category colors
 */
export const getCategoryColors = (category) => {
  const key = category || 'General';
  return CAT_COLORS[key] || CAT_COLORS.General;
};

/**
 * Get category emoji
 * @param {string} category - Category name
 * @returns {string} Category emoji
 */
export const getCategoryEmoji = (category) => {
  const key = category || 'General';
  return CAT_EMOJI[key] || '🧾';
};