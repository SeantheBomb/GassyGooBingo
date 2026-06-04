// items-manifest.js — authoritative list of item IDs that have custom SVG files.
// Loaded on every page (before items-loader.js on game pages, before admin.js on admin).
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

// Exposed as a global so admin.js and items-loader.js share the same source of truth
window.itemHasSvg = (id) => HAS_SVG.has(id);
