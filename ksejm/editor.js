const updatedAtEl = document.getElementById('editor-updatedAt');
const registerUrlEl = document.getElementById('editor-registerUrl');
const entriesEl = document.getElementById('editor-entries');
const outputEl = document.getElementById('editor-output');
const statusEl = document.getElementById('editor-status');

const loadCurrentBtn = document.getElementById('editor-load-current');
const addEntryBtn = document.getElementById('editor-add-entry');
const generateBtn = document.getElementById('editor-generate');
const downloadBtn = document.getElementById('editor-download');

const state = {
  updatedAt: '',
  registerUrl: '',
  entries: []
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyAttachment() {
  return {
    id: uid(),
    title: '',
    type: 'markdown',
    url: ''
  };
}

function createEmptyEntry() {
  return {
    _id: uid(),
    id: '',
    kind: 'ustawa',
    title: '',
    category: '',
    dotyczy: '',
    date: todayIso(),
    contentMd: '',
    attachments: []
  };
}

function setStatus(message) {
  statusEl.textContent = message;
}

function normalizeKind(kind) {
  if (kind === 'ustawa' || kind === 'uchwala' || kind === 'rozporzadzenie') {
    return kind;
  }
  return 'ustawa';
}

function sanitizeEntry(entry) {
  const attachments = (entry.attachments || [])
    .map((attachment) => ({
      title: String(attachment.title || '').trim(),
      type: attachment.type === 'pdf' ? 'pdf' : 'markdown',
      url: String(attachment.url || '').trim()
    }))
    .filter((attachment) => attachment.title && attachment.url);

  return {
    id: String(entry.id || '').trim(),
    kind: normalizeKind(entry.kind),
    title: String(entry.title || '').trim(),
    category: String(entry.category || '').trim(),
    dotyczy: String(entry.dotyczy || '').trim(),
    date: String(entry.date || '').trim(),
    contentMd: String(entry.contentMd || '').trim(),
    attachments
  };
}

function buildJsonObject() {
  const entries = state.entries
    .map(sanitizeEntry)
    .filter((entry) => entry.id && entry.title && entry.contentMd);

  return {
    updatedAt: String(state.updatedAt || todayIso()).trim(),
    registerUrl: String(state.registerUrl || '').trim(),
    entries
  };
}

function refreshOutput() {
  const result = buildJsonObject();
  outputEl.value = JSON.stringify(result, null, 2);
}

function removeEntry(entryId) {
  state.entries = state.entries.filter((entry) => entry._id !== entryId);
  renderEntries();
  refreshOutput();
}

function addAttachment(entryId) {
  const entry = state.entries.find((item) => item._id === entryId);
  if (!entry) {
    return;
  }
  entry.attachments.push(createEmptyAttachment());
  renderEntries();
  refreshOutput();
}

function removeAttachment(entryId, attachmentId) {
  const entry = state.entries.find((item) => item._id === entryId);
  if (!entry) {
    return;
  }
  entry.attachments = entry.attachments.filter((attachment) => attachment.id !== attachmentId);
  renderEntries();
  refreshOutput();
}

function renderEntries() {
  if (!state.entries.length) {
    entriesEl.innerHTML = '<div class="rounded-xl border border-dashed border-koborder bg-koelev2/30 px-3 py-6 text-center text-sm text-kodim">Brak wpisów. Kliknij „Dodaj wpis”.</div>';
    return;
  }

  entriesEl.innerHTML = state.entries.map((entry, index) => {
    const attachments = (entry.attachments || []).map((attachment) => `
      <div class="grid grid-cols-1 gap-2 rounded-xl border border-koborder bg-koelev2/40 p-3 md:grid-cols-[1.1fr_.7fr_1.2fr_auto]" data-attachment-id="${attachment.id}">
        <input data-field="attachment-title" data-entry-id="${entry._id}" data-attachment-id="${attachment.id}" value="${escapeHtml(attachment.title)}" placeholder="Tytuł załącznika" class="rounded-lg border border-koborder bg-koelev2 px-2 py-1.5 text-sm outline-none focus:border-koaccent" />
        <select data-field="attachment-type" data-entry-id="${entry._id}" data-attachment-id="${attachment.id}" class="rounded-lg border border-koborder bg-koelev2 px-2 py-1.5 text-sm outline-none focus:border-koaccent">
          <option value="markdown" ${attachment.type === 'markdown' ? 'selected' : ''}>markdown</option>
          <option value="pdf" ${attachment.type === 'pdf' ? 'selected' : ''}>pdf</option>
        </select>
        <input data-field="attachment-url" data-entry-id="${entry._id}" data-attachment-id="${attachment.id}" value="${escapeHtml(attachment.url)}" placeholder="URL lub docs/..." class="rounded-lg border border-koborder bg-koelev2 px-2 py-1.5 text-sm outline-none focus:border-koaccent" />
        <button type="button" data-action="remove-attachment" data-entry-id="${entry._id}" data-attachment-id="${attachment.id}" class="rounded-lg border border-koborder bg-koelev2 px-2 py-1.5 text-xs font-semibold hover:border-koaccent">Usuń</button>
      </div>
    `).join('');

    return `
      <article class="rounded-2xl border border-koborder bg-koelev2/30 p-4" data-entry-id="${entry._id}">
        <div class="mb-3 flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-kodim">Wpis #${index + 1}</h3>
          <button type="button" data-action="remove-entry" data-entry-id="${entry._id}" class="rounded-lg border border-koborder bg-koelev2 px-2 py-1.5 text-xs font-semibold hover:border-koaccent">Usuń wpis</button>
        </div>

        <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
          <input data-field="id" data-entry-id="${entry._id}" value="${escapeHtml(entry.id)}" placeholder="ID (np. UST-2026-04-01)" class="rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm outline-none focus:border-koaccent" />
          <select data-field="kind" data-entry-id="${entry._id}" class="rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm outline-none focus:border-koaccent">
            <option value="ustawa" ${entry.kind === 'ustawa' ? 'selected' : ''}>ustawa</option>
            <option value="uchwala" ${entry.kind === 'uchwala' ? 'selected' : ''}>uchwala</option>
            <option value="rozporzadzenie" ${entry.kind === 'rozporzadzenie' ? 'selected' : ''}>rozporzadzenie</option>
          </select>
          <input data-field="title" data-entry-id="${entry._id}" value="${escapeHtml(entry.title)}" placeholder="Tytuł" class="rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm outline-none focus:border-koaccent md:col-span-2" />
          <input data-field="category" data-entry-id="${entry._id}" value="${escapeHtml(entry.category)}" placeholder="Kategoria" class="rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm outline-none focus:border-koaccent" />
          <input data-field="date" type="date" data-entry-id="${entry._id}" value="${escapeHtml(entry.date)}" class="rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm outline-none focus:border-koaccent" />
          <input data-field="contentMd" data-entry-id="${entry._id}" value="${escapeHtml(entry.contentMd)}" placeholder="Ścieżka markdown (np. docs/xxx.md)" class="rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm outline-none focus:border-koaccent md:col-span-2" />
          <textarea data-field="dotyczy" data-entry-id="${entry._id}" placeholder="Czego dotyczy" class="min-h-[74px] rounded-xl border border-koborder bg-koelev2 px-3 py-2 text-sm outline-none focus:border-koaccent md:col-span-2">${escapeHtml(entry.dotyczy)}</textarea>
        </div>

        <div class="mt-3 rounded-xl border border-koborder bg-koelev2/25 p-3">
          <div class="mb-2 flex items-center justify-between gap-2">
            <p class="text-xs font-semibold uppercase tracking-wide text-kodim">Załączniki</p>
            <button type="button" data-action="add-attachment" data-entry-id="${entry._id}" class="rounded-lg border border-koborder bg-koelev2 px-2 py-1.5 text-xs font-semibold hover:border-koaccent">Dodaj załącznik</button>
          </div>
          <div class="space-y-2">${attachments || '<p class="text-xs text-kodim">Brak załączników.</p>'}</div>
        </div>
      </article>
    `;
  }).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function bindGlobalInputs() {
  updatedAtEl.addEventListener('input', () => {
    state.updatedAt = updatedAtEl.value || '';
    refreshOutput();
  });

  registerUrlEl.addEventListener('input', () => {
    state.registerUrl = registerUrlEl.value || '';
    refreshOutput();
  });
}

function bindEntriesEvents() {
  entriesEl.addEventListener('click', (event) => {
    const removeEntryButton = event.target.closest('[data-action="remove-entry"]');
    if (removeEntryButton) {
      removeEntry(removeEntryButton.dataset.entryId || '');
      return;
    }

    const addAttachmentButton = event.target.closest('[data-action="add-attachment"]');
    if (addAttachmentButton) {
      addAttachment(addAttachmentButton.dataset.entryId || '');
      return;
    }

    const removeAttachmentButton = event.target.closest('[data-action="remove-attachment"]');
    if (removeAttachmentButton) {
      removeAttachment(removeAttachmentButton.dataset.entryId || '', removeAttachmentButton.dataset.attachmentId || '');
    }
  });

  entriesEl.addEventListener('input', (event) => {
    const input = event.target;
    const field = input.dataset.field;
    const entryId = input.dataset.entryId;
    if (!field || !entryId) {
      return;
    }

    const entry = state.entries.find((item) => item._id === entryId);
    if (!entry) {
      return;
    }

    if (field.startsWith('attachment-')) {
      const attachmentId = input.dataset.attachmentId;
      const attachment = (entry.attachments || []).find((item) => item.id === attachmentId);
      if (!attachment) {
        return;
      }
      if (field === 'attachment-title') {
        attachment.title = input.value;
      } else if (field === 'attachment-type') {
        attachment.type = input.value === 'pdf' ? 'pdf' : 'markdown';
      } else if (field === 'attachment-url') {
        attachment.url = input.value;
      }
      refreshOutput();
      return;
    }

    if (field === 'kind') {
      entry.kind = normalizeKind(input.value);
    } else {
      entry[field] = input.value;
    }
    refreshOutput();
  });
}

function addEntry() {
  state.entries.push(createEmptyEntry());
  renderEntries();
  refreshOutput();
}

async function loadCurrentIndexJson() {
  try {
    const response = await fetch('/ksejm/data/index.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }
    const data = await response.json();

    state.updatedAt = String(data?.updatedAt || todayIso());
    state.registerUrl = String(data?.registerUrl || '');
    state.entries = Array.isArray(data?.entries)
      ? data.entries.map((entry) => ({
          _id: uid(),
          id: String(entry?.id || ''),
          kind: normalizeKind(entry?.kind),
          title: String(entry?.title || ''),
          category: String(entry?.category || ''),
          dotyczy: String(entry?.dotyczy || ''),
          date: String(entry?.date || todayIso()),
          contentMd: String(entry?.contentMd || ''),
          attachments: Array.isArray(entry?.attachments)
            ? entry.attachments.map((attachment) => ({
                id: uid(),
                title: String(attachment?.title || ''),
                type: attachment?.type === 'pdf' ? 'pdf' : 'markdown',
                url: String(attachment?.url || '')
              }))
            : []
        }))
      : [];

    updatedAtEl.value = state.updatedAt;
    registerUrlEl.value = state.registerUrl;
    renderEntries();
    refreshOutput();
    setStatus('Wczytano aktualny index.json.');
  } catch (error) {
    setStatus('Błąd wczytywania: ' + (error.message || 'nieznany błąd'));
  }
}

function generateJsonOnly() {
  refreshOutput();
  setStatus('Wygenerowano podgląd JSON.');
}

function downloadJsonFile() {
  const json = outputEl.value || JSON.stringify(buildJsonObject(), null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'index.json';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
  setStatus('Pobrano plik index.json.');
}

function bootstrap() {
  state.updatedAt = todayIso();
  updatedAtEl.value = state.updatedAt;
  registerUrlEl.value = '';

  bindGlobalInputs();
  bindEntriesEvents();

  addEntryBtn.addEventListener('click', addEntry);
  loadCurrentBtn.addEventListener('click', loadCurrentIndexJson);
  generateBtn.addEventListener('click', generateJsonOnly);
  downloadBtn.addEventListener('click', downloadJsonFile);

  renderEntries();
  refreshOutput();
  setStatus('Gotowe. Wypełnij formularz i pobierz index.json.');
}

bootstrap();
