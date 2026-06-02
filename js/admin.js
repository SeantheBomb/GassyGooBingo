// Admin panel logic — item gallery, item creation, stream overrides

// --- Settings helpers ---

function getSettings() {
  try { return JSON.parse(localStorage.getItem('ggb_admin_settings') || '{}'); } catch { return {}; }
}

function saveSettings(patch) {
  const s = { ...getSettings(), ...patch };
  localStorage.setItem('ggb_admin_settings', JSON.stringify(s));
}

function getCustomItems() {
  try { return JSON.parse(localStorage.getItem('ggb_custom_items') || '[]'); } catch { return []; }
}

function saveCustomItems(items) {
  localStorage.setItem('ggb_custom_items', JSON.stringify(items));
}

// --- Gallery ---

function imgSrc(item) {
  return item.image || `images/items/${item.id}.svg`;
}

function renderGallery() {
  const custom    = getCustomItems();
  const customIds = new Set(custom.map(c => c.id));
  const gallery   = document.getElementById('item-gallery');

  const allItems = [...ITEMS]; // ITEMS already includes custom items via items-loader

  gallery.innerHTML = allItems.map(item => {
    const isCustom = customIds.has(item.id);
    return `
      <div class="admin-item-card" data-id="${item.id}">
        <div class="admin-item-img-wrap" style="border-color:${item.color}">
          <img src="${imgSrc(item)}" alt="${item.name}"
               onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
          <span class="admin-item-emoji-fallback">${item.emoji}</span>
        </div>
        <div class="admin-item-meta">
          <span class="admin-item-name">${item.name}</span>
          ${isCustom ? '<span class="admin-badge">custom</span>' : ''}
          <span class="admin-item-hint">${item.hint || ''}</span>
          <span class="admin-item-color-chip" style="background:${item.color}" title="${item.color}"></span>
        </div>
        ${isCustom ? `<button class="admin-delete-btn" data-id="${item.id}">Remove</button>` : ''}
      </div>`;
  }).join('');

  gallery.querySelectorAll('.admin-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteCustomItem(btn.dataset.id));
  });

  document.getElementById('item-count').textContent = `${allItems.length} items`;
}

function deleteCustomItem(id) {
  if (!confirm('Remove this custom item?')) return;
  const updated = getCustomItems().filter(c => c.id !== id);
  saveCustomItems(updated);
  location.reload();
}

// --- New item form ---

function slugify(name) {
  return 'custom_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function initNewItemForm() {
  const form       = document.getElementById('new-item-form');
  const svgInput   = document.getElementById('new-item-svg');
  const preview    = document.getElementById('svg-preview');
  const nameInput  = document.getElementById('new-item-name');
  const colorInput = document.getElementById('new-item-color');
  const emojiInput = document.getElementById('new-item-emoji');

  // Live SVG preview
  svgInput.addEventListener('input', () => {
    const val = svgInput.value.trim();
    preview.innerHTML = val || '<span style="color:#555;font-size:12px">SVG preview</span>';
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name  = nameInput.value.trim();
    const color = colorInput.value;
    const emoji = emojiInput.value.trim() || '❓';
    const hint  = document.getElementById('new-item-hint').value.trim();
    const svgRaw = svgInput.value.trim();

    if (!name) return;

    const id = slugify(name) + '_' + Math.floor(Date.now() / 1000 % 100000);

    const item = { id, name, color, emoji, hint };
    if (svgRaw) {
      item.image = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgRaw);
    }

    const custom = getCustomItems();
    custom.push(item);
    saveCustomItems(custom);

    form.reset();
    preview.innerHTML = '<span style="color:#555;font-size:12px">SVG preview</span>';
    location.reload();
  });
}

// --- Stream overrides ---

function initOverrides() {
  const settings = getSettings();

  const minIn  = document.getElementById('override-min');
  const maxIn  = document.getElementById('override-max');
  const minVal = document.getElementById('min-val');
  const maxVal = document.getElementById('max-val');

  minIn.value = settings.minObjects ?? 0;
  maxIn.value = settings.maxObjects ?? 10;
  minVal.textContent = minIn.value;
  maxVal.textContent = maxIn.value;

  minIn.addEventListener('input', () => {
    minVal.textContent = minIn.value;
    saveSettings({ minObjects: parseInt(minIn.value, 10) || 0 });
  });

  maxIn.addEventListener('input', () => {
    maxVal.textContent = maxIn.value;
    saveSettings({ maxObjects: parseInt(maxIn.value, 10) || null });
  });

  document.getElementById('clear-overrides').addEventListener('click', () => {
    saveSettings({ minObjects: 0, maxObjects: null });
    minIn.value  = 0;
    maxIn.value  = 10;
    minVal.textContent = '0';
    maxVal.textContent = '10';
  });
}

// --- Filter ---

function initFilter() {
  document.getElementById('gallery-filter').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.admin-item-card').forEach(card => {
      card.style.display = card.dataset.id.includes(q) ||
        card.querySelector('.admin-item-name').textContent.toLowerCase().includes(q)
        ? '' : 'none';
    });
  });
}

// --- Init ---

document.addEventListener('DOMContentLoaded', () => {
  renderGallery();
  initNewItemForm();
  initOverrides();
  initFilter();
});
