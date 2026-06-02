// Merges admin-created custom items from localStorage into the base ITEMS array.
// Must run after items.js and before any script that uses ITEMS.
(function () {
  try {
    const custom = JSON.parse(localStorage.getItem('ggb_custom_items') || '[]');
    if (Array.isArray(custom)) ITEMS.push(...custom);
  } catch {}
})();
