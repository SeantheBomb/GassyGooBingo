// Admin panel logic — item gallery, SVG editing, item creation, stream overrides

// --- Persistence helpers ---

function getSettings() {
  try { return JSON.parse(localStorage.getItem('ggb_admin_settings') || '{}'); } catch { return {}; }
}
function saveSettings(patch) {
  localStorage.setItem('ggb_admin_settings', JSON.stringify({ ...getSettings(), ...patch }));
}
function getCustomItems() {
  try { return JSON.parse(localStorage.getItem('ggb_custom_items') || '[]'); } catch { return []; }
}
function saveCustomItems(items) {
  localStorage.setItem('ggb_custom_items', JSON.stringify(items));
}
function getSvgOverrides() {
  try { return JSON.parse(localStorage.getItem('ggb_svg_overrides') || '{}'); } catch { return {}; }
}
function saveSvgOverride(id, dataUri) {
  const ov = getSvgOverrides();
  if (dataUri) ov[id] = dataUri; else delete ov[id];
  localStorage.setItem('ggb_svg_overrides', JSON.stringify(ov));
}

// --- Image source (respects overrides already applied via items-loader) ---

function imgSrc(item) {
  return item.image || `images/items/${item.id}.svg`;
}

// --- SVG Edit Modal ---

async function fetchSvgContent(item) {
  // If the item already has a data URI image, decode it
  if (item.image && item.image.startsWith('data:')) {
    try {
      return decodeURIComponent(item.image.replace('data:image/svg+xml;charset=utf-8,', ''));
    } catch { return ''; }
  }
  // Otherwise fetch from the file
  try {
    const res = await fetch(`images/items/${item.id}.svg`);
    return res.ok ? await res.text() : '';
  } catch { return ''; }
}

function openEditModal(item) {
  // Remove any existing modal
  document.getElementById('admin-modal-root')?.remove();

  const root = document.createElement('div');
  root.id = 'admin-modal-root';
  root.className = 'admin-modal-backdrop';
  root.innerHTML = `
    <div class="admin-modal">
      <div class="admin-modal-title">
        <span>Edit SVG — <strong>${item.name}</strong></span>
        <button class="admin-modal-close" id="modal-close">✕</button>
      </div>
      <div class="admin-modal-body">
        <textarea id="modal-svg-input" placeholder="Paste SVG code here…" spellcheck="false"></textarea>
        <div class="admin-modal-preview" id="modal-preview">
          <span style="color:#555;font-size:12px">preview</span>
        </div>
      </div>
      <div class="admin-modal-actions">
        <button class="btn btn-primary" id="modal-save">Save Override</button>
        <button class="btn btn-danger" id="modal-clear">Clear Override</button>
        <button class="btn" id="modal-cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  const textarea = root.querySelector('#modal-svg-input');
  const preview  = root.querySelector('#modal-preview');

  function updatePreview(val) {
    const trimmed = val.trim();
    preview.innerHTML = trimmed.startsWith('<svg') ? trimmed
      : '<span style="color:#555;font-size:12px">preview</span>';
  }

  // Load current SVG content asynchronously
  fetchSvgContent(item).then(content => {
    textarea.value = content;
    updatePreview(content);
  });

  textarea.addEventListener('input', () => updatePreview(textarea.value));

  root.querySelector('#modal-save').addEventListener('click', () => {
    const svgRaw = textarea.value.trim();
    if (!svgRaw) return;
    const dataUri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgRaw);
    saveSvgOverride(item.id, dataUri);
    // Update the item in the current ITEMS array so the gallery refreshes correctly
    item.image = dataUri;
    closeModal();
    renderGallery();
  });

  root.querySelector('#modal-clear').addEventListener('click', () => {
    if (!confirm('Remove the override and restore the original SVG?')) return;
    saveSvgOverride(item.id, null);
    delete item.image;
    closeModal();
    renderGallery();
  });

  root.querySelector('#modal-cancel').addEventListener('click', closeModal);
  root.querySelector('#modal-close').addEventListener('click', closeModal);
  root.addEventListener('click', e => { if (e.target === root) closeModal(); });
}

function closeModal() {
  document.getElementById('admin-modal-root')?.remove();
}

// --- Gallery ---

function renderGallery() {
  const customIds = new Set(getCustomItems().map(c => c.id));
  const gallery   = document.getElementById('item-gallery');

  gallery.innerHTML = ITEMS.map(item => {
    const isCustom   = customIds.has(item.id);
    const hasOverride = !!getSvgOverrides()[item.id];
    return `
      <div class="admin-item-card" data-id="${item.id}">
        <div class="admin-item-img-wrap" style="border-color:${item.color}">
          <img src="${imgSrc(item)}" alt="${item.name}"
               onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
          <span class="admin-item-emoji-fallback">${item.emoji}</span>
        </div>
        <div class="admin-item-meta">
          <span class="admin-item-name">${item.name}</span>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin:2px 0">
            ${isCustom   ? '<span class="admin-badge">custom</span>'   : ''}
            ${hasOverride ? '<span class="admin-badge" style="background:#9370db">edited</span>' : ''}
          </div>
          <span class="admin-item-hint">${item.hint || ''}</span>
          <span class="admin-item-color-chip" style="background:${item.color}" title="${item.color}"></span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="admin-edit-svg-btn btn" style="font-size:10px;padding:3px 8px" data-id="${item.id}">Edit SVG</button>
          ${isCustom ? `<button class="admin-delete-btn" data-id="${item.id}">Remove</button>` : ''}
        </div>
      </div>`;
  }).join('');

  gallery.querySelectorAll('.admin-edit-svg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = ITEMS.find(i => i.id === btn.dataset.id);
      if (item) openEditModal(item);
    });
  });

  gallery.querySelectorAll('.admin-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteCustomItem(btn.dataset.id));
  });

  document.getElementById('item-count').textContent = `${ITEMS.length} items`;
}

function deleteCustomItem(id) {
  if (!confirm('Remove this custom item?')) return;
  saveCustomItems(getCustomItems().filter(c => c.id !== id));
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

  svgInput.addEventListener('input', () => {
    const val = svgInput.value.trim();
    preview.innerHTML = val || '<span style="color:#555;font-size:12px">SVG preview</span>';
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const name   = nameInput.value.trim();
    const color  = colorInput.value;
    const emoji  = emojiInput.value.trim() || '❓';
    const hint   = document.getElementById('new-item-hint').value.trim();
    const svgRaw = svgInput.value.trim();

    if (!name) return;

    const id   = slugify(name) + '_' + Math.floor(Date.now() / 1000 % 100000);
    const item = { id, name, color, emoji, hint };
    if (svgRaw) {
      item.image = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgRaw);
    }

    saveCustomItems([...getCustomItems(), item]);
    form.reset();
    preview.innerHTML = '<span style="color:#555;font-size:12px">SVG preview</span>';
    location.reload();
  });
}

// --- Stream overrides ---

function initOverrides() {
  const settings = getSettings();
  const minIn    = document.getElementById('override-min');
  const maxIn    = document.getElementById('override-max');
  const minVal   = document.getElementById('min-val');
  const maxVal   = document.getElementById('max-val');

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
    minIn.value = 0; maxIn.value = 10;
    minVal.textContent = '0'; maxVal.textContent = '10';
  });
}

// --- Filter ---

function initFilter() {
  document.getElementById('gallery-filter').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.admin-item-card').forEach(card => {
      const name = card.querySelector('.admin-item-name').textContent.toLowerCase();
      card.style.display = name.includes(q) || card.dataset.id.includes(q) ? '' : 'none';
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
