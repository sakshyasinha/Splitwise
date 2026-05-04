/**
 * Form validation utilities
 */

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} Is valid email
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate amount is positive number
 * @param {number|string} amount - Amount to validate
 * @returns {boolean} Is valid amount
 */
export const isValidAmount = (amount) => {
  const num = Number(amount);
  return !isNaN(num) && num > 0;
};

/**
 * Validate required field
 * @param {string} value - Value to validate
 * @returns {boolean} Is valid (not empty)
 */
export const isRequired = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

/**
 * Normalize email for comparison
 * @param {string} email - Email to normalize
 * @returns {string} Normalized email
 */
export const normalizeEmail = (email) => {
  return String(email || '').trim().toLowerCase();
};