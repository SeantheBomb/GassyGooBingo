// items-loader.js
// Runs after items.js and items-extended.js have both loaded.
// Responsibilities:
//   1. Push custom items from localStorage into ITEMS
//   2. Apply any stored SVG overrides
//   3. Filter ITEMS to only those that are "enabled"
//      • Default enabled  = has a known SVG file
//      • Default disabled = emoji-only (no SVG yet)
//      • User overrides via ggb_items_enabled / ggb_items_disabled in localStorage

// ── IDs that have custom SVG files ────────────────────────────────────────────
// Update this set whenever a new SVG is added to images/items/.

const HAS_SVG = new Set([
  // ── Original 51 (items.js) ──────────────────────────────────────────────────
  'slop_clock','alabama_poutine','banana_shaft','borzoi','bovril','bread_tag',
  'choco_taco','colin_caterpillar','cookie_puss','cucumbers','desk_waffles',
  'dino_nuggets','doom_loom','frazzles','frubes','fudgie_whale','fruit_gloves',
  'golden_gurp','gurpler_max','ham_fan','honey_monster','humpty_cannon',
  'icing_icepack','nugget_buddies','lil_gurp','mexican_pizza','mini_fridge',
  'monster_munch','nanaimo_bar','nose_flaps','owl_owl','p_ake','pillow_mountain',
  'poffle','porta_potty','potato_smiles','puss_puss','ratyboy','reliant_robin',
  'shit_shades','sleep_spaghetti','smee','street_sharks','surstromming',
  'swan_attack','transform_snack','whoop_scoops','wrist_pocket','zine',
  'thumb_sticks','purple_nightmare',

  // ── Extended items with SVGs (batches 1-3) ──────────────────────────────────
  'bacon_butty','bat_knob','banana_wipes','bean_hole','bov_pop','branston_pickle',
  'chevy_nova_1972','chocolate_off','closet_dog','condiments','coolio',
  'cursed_socks','does_it_do','dodge_the_bov','double_salt_licorice','episode_16',
  'exploding_ear','flavour_plinko','fkface_fondue','fkface_vinyl','gavin_freon',
  'golf_cart','grape_suicide','great_big_mable','gurple','ham_coin','ham_zone',
  'jeep_grand_wagoneer','koozie','mandelbrot_set','mercury_cougar_1967',
  'milk_in_a_bag','mvp2','nic_nacs','purplesaurus_rex','rugged_robin','rutabaga',
  'savannah_bananas','shocks','signal_awards','sprunkler','the_chip_off','the_flux',
  'the_ghostie','the_melting_pot','the_number_67','the_panton_line','the_soda_chug',
  'the_tuxedo','the_wheel_of_years','the_zimmys','toad_in_the_hole','toilet_jenga',
  'treasure_cove','tuneyville_choo_choo','twiglets','willard_scott','zimmer_frame',
  'zimmer_zone',
]);

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

// Public helper used by admin panel to check default enabled state
window.itemHasSvg = (id) => HAS_SVG.has(id);

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
