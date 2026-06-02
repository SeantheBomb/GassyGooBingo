// Merges admin-created custom items from localStorage into ITEMS,
// then applies any stored SVG overrides (including to base items).
// Must run after items.js and before any script that uses ITEMS.
(function () {
  try {
    const custom = JSON.parse(localStorage.getItem('ggb_custom_items') || '[]');
    if (Array.isArray(custom)) ITEMS.push(...custom);
  } catch {}

  try {
    const overrides = JSON.parse(localStorage.getItem('ggb_svg_overrides') || '{}');
    for (const item of ITEMS) {
      if (overrides[item.id]) item.image = overrides[item.id];
    }
  } catch {}
})();
