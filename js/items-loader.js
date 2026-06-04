// items-loader.js
// Runs after items.js and items-extended.js have both loaded.
// Responsibilities:
//   1. Push custom items from localStorage into ITEMS
//   2. Apply any stored SVG overrides
//   3. Filter ITEMS to only those that are "enabled"
//      • Default enabled  = has a known SVG file
//      • Default disabled = emoji-only (no SVG yet)
//      • User overrides via ggb_items_enabled / ggb_items_disabled in localStorage

// HAS_SVG and window.itemHasSvg are defined in items-manifest.js (loaded before this file).

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSvgOverrideIds() {
  try { return new Set(Object.keys(JSON.parse(localStorage.getItem('ggb_svg_overrides') || '{}'))); }
  catch { return new Set(); }
}

function getUserEnabled()  {
  try { return new Set(JSON.parse(localStorage.getItem('ggb_items_enabled')  || '[]')); }
  catch { return new Set(); }
}

function getUserDisabled() {
  try { return new Set(JSON.parse(localStorage.getItem('ggb_items_disabled') || '[]')); }
  catch { return new Set(); }
}

// Returns true if item should appear in stream + bingo cards
function isItemActive(item, userEnabled, userDisabled, svgOverrides) {
  if (userDisabled.has(item.id)) return false;
  if (userEnabled.has(item.id))  return true;
  // Default: enabled only when a real SVG exists
  return HAS_SVG.has(item.id) || !!item.image || svgOverrides.has(item.id);
}

// ── Main ──────────────────────────────────────────────────────────────────────

(function () {
  // 1. Merge custom items from localStorage
  try {
    const custom = JSON.parse(localStorage.getItem('ggb_custom_items') || '[]');
    if (Array.isArray(custom)) ITEMS.push(...custom);
  } catch {}

  // 2. Apply stored SVG overrides
  try {
    const overrides = JSON.parse(localStorage.getItem('ggb_svg_overrides') || '{}');
    for (const item of ITEMS) {
      if (overrides[item.id]) item.image = overrides[item.id];
    }
  } catch {}

  // 3. Filter to active items only (in-place so all existing references stay valid)
  const userEnabled  = getUserEnabled();
  const userDisabled = getUserDisabled();
  const svgOverrides = getSvgOverrideIds();

  const active = ITEMS.filter(item => isItemActive(item, userEnabled, userDisabled, svgOverrides));
  ITEMS.length = 0;
  ITEMS.push(...active);
})();
