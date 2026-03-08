const searchEl = document.getElementById('ksejm-search');
const listEl = document.getElementById('ksejm-list');
const kindFilters = Array.from(document.querySelectorAll('.ksejm-kind-filter'));
const categoryFilterEl = document.getElementById('ksejm-category-filter');
const sortEl = document.getElementById('ksejm-sort');

const detailEmptyEl = document.getElementById('ksejm-detail-empty');
const detailEl = document.getElementById('ksejm-detail');
const detailKindEl = document.getElementById('ksejm-detail-kind');
const detailCategoryEl = document.getElementById('ksejm-detail-category');
const detailTitleEl = document.getElementById('ksejm-detail-title');
const detailDotyczyEl = document.getElementById('ksejm-detail-dotyczy');
const detailRegisterEl = document.getElementById('ksejm-detail-register');
const markdownEl = document.getElementById('ksejm-markdown');
const attachmentsEl = document.getElementById('ksejm-attachments');

const attachmentPreviewWrapEl = document.getElementById('ksejm-attachment-preview-wrap');
const attachmentPreviewTitleEl = document.getElementById('ksejm-attachment-preview-title');
const attachmentPreviewEl = document.getElementById('ksejm-attachment-preview');
const attachmentPreviewCloseEl = document.getElementById('ksejm-attachment-preview-close');

const state = {
  entries: [],
  registerUrl: '',
  query: '',
  kind: 'all',
  category: 'all',
  sortBy: 'date_desc',
  selectedId: null
};

const md = window.markdownit({ html: false, linkify: true, breaks: true });

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function kindLabel(kind) {
  if (kind === 'ustawa') return 'Ustawa';
  if (kind === 'uchwala') return 'Uchwała';
  if (kind === 'rozporzadzenie') return 'Rozporządzenie';
  return 'Akt';
}

function getRequestedDocId() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('doc') || '').trim();
}

function updateDocParam(docId) {
  const url = new URL(window.location.href);
  if (docId) {
    url.searchParams.set('doc', docId);
  } else {
    url.searchParams.delete('doc');
  }
  window.history.replaceState({}, '', url.toString());
}

function stylizeMarkdown(container) {
  container.querySelectorAll('h1').forEach((el) => el.className = 'text-2xl sm:text-3xl font-bold tracking-tight mt-2 mb-4');
  container.querySelectorAll('h2').forEach((el) => el.className = 'text-xl sm:text-2xl font-semibold tracking-tight mt-6 mb-3');
  container.querySelectorAll('h3').forEach((el) => el.className = 'text-lg font-semibold mt-5 mb-2');
  container.querySelectorAll('p').forEach((el) => el.className = 'text-kotext/95 leading-7');
  container.querySelectorAll('ul').forEach((el) => el.className = 'list-disc pl-6 space-y-1');
  container.querySelectorAll('ol').forEach((el) => el.className = 'list-decimal pl-6 space-y-1');
  container.querySelectorAll('li').forEach((el) => el.className = 'text-kotext/95');
  container.querySelectorAll('blockquote').forEach((el) => el.className = 'border-l-4 border-koaccent pl-4 italic text-kodim');
  container.querySelectorAll('hr').forEach((el) => el.className = 'my-6 border-koborder');
  container.querySelectorAll('code').forEach((el) => el.className = 'rounded bg-koelev2 px-1.5 py-0.5 text-sm text-rose-200');
  container.querySelectorAll('pre').forEach((el) => {
    el.className = 'overflow-x-auto rounded-xl border border-koborder bg-koelev2 p-3';
    const code = el.querySelector('code');
    if (code) {
      code.className = 'bg-transparent p-0 text-sm text-kotext';
    }
  });
  container.querySelectorAll('a').forEach((el) => {
    el.className = 'font-medium text-rose-300 underline underline-offset-2 hover:text-rose-200';
    el.target = '_blank';
    el.rel = 'noopener';
  });
}

async function loadEntries() {
  const response = await fetch('/ksejm/data/index.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Nie udało się pobrać danych kSejm.');
  }
  const data = await response.json();
  state.entries = Array.isArray(data?.entries) ? data.entries : [];
  state.registerUrl = typeof data?.registerUrl === 'string' ? data.registerUrl : '';
  hydrateCategoryFilter();
  renderList();
}

function hydrateCategoryFilter() {
  const categories = Array.from(new Set(state.entries.map((entry) => String(entry.category || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pl'));
  const options = ['<option value="all">Wszystkie kategorie</option>']
    .concat(categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`));
  categoryFilterEl.innerHTML = options.join('');
}

function getFilteredEntries() {
  const query = state.query.trim().toLowerCase();
  const filtered = state.entries
    .filter((entry) => state.kind === 'all' || entry.kind === state.kind)
    .filter((entry) => state.category === 'all' || entry.category === state.category)
    .filter((entry) => {
      if (!query) {
        return true;
      }
      const haystack = [entry.title, entry.category, entry.dotyczy, entry.kind]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });

  filtered.sort((a, b) => {
    if (state.sortBy === 'date_asc') {
      return String(a.date || '').localeCompare(String(b.date || ''));
    }
    if (state.sortBy === 'title_asc') {
      return String(a.title || '').localeCompare(String(b.title || ''), 'pl');
    }
    if (state.sortBy === 'title_desc') {
      return String(b.title || '').localeCompare(String(a.title || ''), 'pl');
    }
    return String(b.date || '').localeCompare(String(a.date || ''));
  });

  return filtered;
}

function renderList() {
  const entries = getFilteredEntries();

  if (!entries.length) {
    listEl.innerHTML = '<div class="rounded-xl border border-dashed border-koborder bg-koelev2/30 px-3 py-6 text-center text-sm text-kodim">Brak aktów dla wybranych filtrów.</div>';
    return;
  }

  listEl.innerHTML = entries.map((entry) => {
    const selected = entry.id === state.selectedId;
    return `
      <button type="button" data-entry-id="${escapeHtml(entry.id)}" class="w-full rounded-xl border px-3 py-3 text-left transition ${selected ? 'border-koaccent bg-koaccent/10' : 'border-koborder bg-koelev2/35 hover:border-koaccent/70'}">
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <span class="rounded-full border border-koaccent/60 bg-koaccent/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-rose-200">${kindLabel(entry.kind)}</span>
          <span class="rounded-full border border-koborder bg-koelev2 px-2 py-0.5 text-[11px] font-semibold text-kodim">${escapeHtml(entry.category || 'Inne')}</span>
        </div>
        <h3 class="line-clamp-2 text-sm font-semibold leading-5 text-kotext">${escapeHtml(entry.title || entry.id)}</h3>
        <p class="mt-1 line-clamp-2 text-xs text-kodim">${escapeHtml(entry.dotyczy || 'Brak opisu zakresu')}</p>
      </button>
    `;
  }).join('');
}

async function loadMarkdown(url) {
  const response = await fetch(`/ksejm/${url}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Nie udało się pobrać treści: ${url}`);
  }
  return response.text();
}

function closeAttachmentPreview() {
  attachmentPreviewWrapEl.classList.add('hidden');
  attachmentPreviewTitleEl.textContent = '';
  attachmentPreviewEl.innerHTML = '';
}

async function renderEntry(entry) {
  state.selectedId = entry.id;
  updateDocParam(entry.id);
  renderList();

  detailEmptyEl.classList.add('hidden');
  detailEl.classList.remove('hidden');

  detailKindEl.textContent = kindLabel(entry.kind);
  detailCategoryEl.textContent = entry.category || 'Inne';
  detailTitleEl.textContent = entry.title || entry.id;
  detailDotyczyEl.textContent = entry.dotyczy || 'Brak opisu.';
  detailRegisterEl.href = state.registerUrl || '#';
  detailRegisterEl.classList.toggle('pointer-events-none', !state.registerUrl);
  detailRegisterEl.classList.toggle('opacity-50', !state.registerUrl);

  markdownEl.innerHTML = '<p class="text-sm text-kodim">Ładowanie treści...</p>';
  closeAttachmentPreview();

  try {
    const markdownContent = await loadMarkdown(entry.contentMd);
    markdownEl.innerHTML = md.render(markdownContent);
    stylizeMarkdown(markdownEl);
  } catch (error) {
    markdownEl.innerHTML = `<p class="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">${escapeHtml(error.message)}</p>`;
  }

  const attachments = Array.isArray(entry.attachments) ? entry.attachments : [];
  if (!attachments.length) {
    attachmentsEl.innerHTML = '<p class="text-sm text-kodim">Brak załączników.</p>';
    return;
  }

  attachmentsEl.innerHTML = attachments.map((attachment) => {
    const type = attachment.type === 'markdown' ? 'Markdown' : 'PDF';
    if (attachment.type === 'markdown') {
      return `
        <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-koborder bg-koelev px-3 py-2">
          <div>
            <p class="text-sm font-semibold text-kotext">${escapeHtml(attachment.title || 'Załącznik')}</p>
            <p class="text-xs text-kodim">Format: ${type}</p>
          </div>
          <button type="button" data-attachment-type="markdown" data-attachment-url="${escapeHtml(attachment.url || '')}" data-attachment-title="${escapeHtml(attachment.title || 'Załącznik')}" class="rounded-lg border border-koborder bg-koelev2 px-3 py-1.5 text-xs font-semibold text-kotext transition hover:border-koaccent hover:text-white">Podgląd</button>
        </div>
      `;
    }

    return `
      <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-koborder bg-koelev px-3 py-2">
        <div>
          <p class="text-sm font-semibold text-kotext">${escapeHtml(attachment.title || 'Załącznik')}</p>
          <p class="text-xs text-kodim">Format: ${type}</p>
        </div>
        <a href="${escapeHtml(attachment.url || '#')}" target="_blank" rel="noopener" class="rounded-lg border border-koborder bg-koelev2 px-3 py-1.5 text-xs font-semibold text-kotext transition hover:border-koaccent hover:text-white">Otwórz PDF</a>
      </div>
    `;
  }).join('');
}

listEl.addEventListener('click', (event) => {
  const button = event.target.closest('[data-entry-id]');
  if (!button) {
    return;
  }
  const entry = state.entries.find((candidate) => candidate.id === button.dataset.entryId);
  if (entry) {
    renderEntry(entry);
  }
});

attachmentsEl.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-attachment-type="markdown"]');
  if (!button) {
    return;
  }

  const attachmentUrl = button.dataset.attachmentUrl || '';
  const attachmentTitle = button.dataset.attachmentTitle || 'Załącznik';

  attachmentPreviewWrapEl.classList.remove('hidden');
  attachmentPreviewTitleEl.textContent = attachmentTitle;
  attachmentPreviewEl.innerHTML = '<p class="text-sm text-kodim">Ładowanie załącznika...</p>';

  try {
    const markdownContent = await loadMarkdown(attachmentUrl);
    attachmentPreviewEl.innerHTML = md.render(markdownContent);
    stylizeMarkdown(attachmentPreviewEl);
  } catch (error) {
    attachmentPreviewEl.innerHTML = `<p class="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">${escapeHtml(error.message)}</p>`;
  }
});

attachmentPreviewCloseEl.addEventListener('click', closeAttachmentPreview);

searchEl.addEventListener('input', () => {
  state.query = searchEl.value || '';
  renderList();
});

categoryFilterEl.addEventListener('change', () => {
  state.category = categoryFilterEl.value;
  renderList();
});

sortEl.addEventListener('change', () => {
  state.sortBy = sortEl.value || 'date_desc';
  renderList();
});

kindFilters.forEach((button) => {
  button.addEventListener('click', () => {
    state.kind = button.dataset.kind || 'all';
    kindFilters.forEach((item) => {
      const isActive = item.dataset.kind === state.kind;
      item.classList.toggle('border-koaccent', isActive);
      item.classList.toggle('bg-koaccent', isActive);
      item.classList.toggle('text-white', isActive);
      item.classList.toggle('border-koborder', !isActive);
      item.classList.toggle('bg-koelev2', !isActive);
      item.classList.toggle('text-kotext', !isActive);
    });
    renderList();
  });
});

(async function bootstrap() {
  try {
    await loadEntries();
    const requestedDocId = getRequestedDocId();
    if (requestedDocId) {
      const requestedEntry = state.entries.find((entry) => entry.id === requestedDocId);
      if (requestedEntry) {
        await renderEntry(requestedEntry);
      }
    }
  } catch (error) {
    listEl.innerHTML = `<div class="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-4 text-sm text-red-200">${escapeHtml(error.message)}</div>`;
  }
})();
