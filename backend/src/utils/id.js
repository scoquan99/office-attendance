/**
 * Parse a string to a positive integer ID.
 * Returns null if the input is not a positive integer.
 * @param {string|number} value
 * @returns {number|null}
 */
export function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}