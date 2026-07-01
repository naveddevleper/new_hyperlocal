/**
 * Shopify returns order.tags as a single comma-separated string,
 * e.g. "hyperlocal, gift-wrap, VIP". This normalizes it into a clean
 * lowercase array for reliable comparisons.
 *
 * @param {object} order Shopify order payload
 * @returns {string[]}
 */
function getOrderTags(order) {
  if (!order || typeof order.tags !== 'string' || order.tags.trim() === '') {
    return [];
  }
  return order.tags
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Returns the list of configured "hyperlocal" tags that are actually
 * present on this order (case-insensitive, whitespace-tolerant).
 *
 * @param {object} order Shopify order payload
 * @param {string[]} configuredTags tags to watch for, e.g. ["hyperlocal"]
 * @returns {string[]} matched tags (empty array if none matched)
 */
function getMatchedTags(order, configuredTags) {
  const orderTags = getOrderTags(order);
  if (orderTags.length === 0) return [];

  const targets = (configuredTags || []).map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (targets.length === 0) return [];

  return orderTags.filter((tag) => targets.includes(tag));
}

/**
 * Convenience boolean wrapper around getMatchedTags.
 */
function isHyperlocalOrder(order, configuredTags) {
  return getMatchedTags(order, configuredTags).length > 0;
}

module.exports = { getOrderTags, getMatchedTags, isHyperlocalOrder };
