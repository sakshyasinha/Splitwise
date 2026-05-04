/**
 * String manipulation utilities
 */

/**
 * Normalize group name for comparison
 * @param {string} value - Group name to normalize
 * @returns {string} Normalized group name
 */
export const normalizeGroupName = (value) =>
  String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s​-‍﻿]+/g, '');

/**
 * Normalize person label
 * @param {string} value - Person label to normalize
 * @returns {string} Normalized person label
 */
export const normalizePersonLabel = (value) => String(value || '').trim();

/**
 * Deduplicate array of values
 * @param {Array} values - Array of values to deduplicate
 * @returns {Array} Deduplicated array
 */
export const dedupeValues = (values = []) => {
  const seen = new Set();

  return values.filter((value) => {
    const normalized = normalizePersonLabel(value).toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
};

/**
 * Prettify group type name
 * @param {string} value - Group type
 * @returns {string} Prettified group type
 */
export const prettifyGroupType = (value) => {
  const normalized = String(value || 'other').trim().toLowerCase();
  if (!normalized) return 'Other';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};