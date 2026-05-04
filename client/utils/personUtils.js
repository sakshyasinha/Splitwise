/**
 * Person and user utilities
 */

/**
 * Get person label with "You" for current user
 * @param {object} person - Person object
 * @param {number} index - Index in list
 * @param {object} currentUser - Current user object
 * @returns {string} Person label
 */
export const getPersonLabel = (person, index, currentUser) => {
  if (person && typeof person === 'object') {
    const personId = String(person._id || person.id || '');
    const currentUserId = String(currentUser?._id || currentUser?.id || '');
    const currentUserEmail = String(currentUser?.email || '').toLowerCase();
    const currentUserName = String(currentUser?.name || '').toLowerCase();
    const personName = String(person.name || person.email || '').toLowerCase();

    if (
      (personId && personId === currentUserId) ||
      (currentUserEmail && personName === currentUserEmail) ||
      (currentUserName && personName === currentUserName)
    ) {
      return 'You';
    }

    return person.name || person.email || `Member ${index + 1}`;
  }

  return `Member ${index + 1}`;
};

/**
 * Get person name with fallback
 * @param {object|string} person - Person object or string
 * @param {string} fallback - Fallback name
 * @returns {string} Person name
 */
export const getPersonName = (person, fallback = 'Unknown') => {
  if (!person) return String(fallback);
  if (typeof person === 'string') return person;
  if (typeof person === 'object') {
    return String(person.name || person.email || fallback);
  }
  return String(fallback);
};