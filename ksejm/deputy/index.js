const updatedEl = document.getElementById('deputy-regulations-updated');
const alertEl = document.getElementById('deputy-regulation-alert');
const titleEl = document.getElementById('deputy-regulation-title');
const dateEl = document.getElementById('deputy-regulation-date');
const contentEl = document.getElementById('deputy-regulation-content');
const listEl = document.getElementById('deputy-regulation-list');
const toggleBtn = document.getElementById('deputy-regulation-toggle');
const toggleLabelEl = document.getElementById('deputy-regulation-toggle-label');
const toggleIconEl = document.getElementById('deputy-regulation-toggle-icon');
const sectionBodyEl = document.getElementById('deputy-regulation-body');
const collapsedHintEl = document.getElementById('deputy-regulation-collapsed-hint');

const md = window.markdownit({ html: false, linkify: true, breaks: true });

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function showAlert(message) {
  if (!alertEl) return;
  alertEl.textContent = message;
  alertEl.classList.remove('hidden');
}

function clearAlert() {
  if (!alertEl) return;
  alertEl.textContent = '';
  alertEl.classList.add('hidden');
}

function stylizeMarkdown(container) {
  if (!container) return;
  container.querySelectorAll('h1').forEach((el) => el.className = 'text-2xl sm:text-3xl font-bold tracking-tight mt-2 mb-4');
  container.querySelectorAll('h2').forEach((el) => el.className = 'text-xl sm:text-2xl font-semibold tracking-tight mt-6 mb-3');
  container.querySelectorAll('h3').forEach((el) => el.className = 'text-lg font-semibold mt-5 mb-2');
  container.querySelectorAll('p').forEach((el) => el.className = 'text-kotext/95 leading-7');
  container.querySelectorAll('ul').forEach((el) => el.className = 'list-disc pl-6 space-y-1');
  container.querySelectorAll('ol').forEach((el) => el.className = 'list-decimal pl-6 space-y-1');
  container.querySelectorAll('li').forEach((el) => el.className = 'text-kotext/95');
  container.querySelectorAll('blockquote').forEach((el) => el.className = 'border-l-4 border-koaccent pl-4 italic text-kodim');
  container.querySelectorAll('hr').forEach((el) => el.className = 'my-6 border-koborder');
  container.querySelectorAll('code').forEach((el) => el.className = 'rounded bg-koelev2 px-1.5 py-0.5 text-sm text-koaccent');
  container.querySelectorAll('pre').forEach((el) => {
    el.className = 'overflow-x-auto rounded-xl border border-koborder bg-koelev2 p-3';
    const code = el.querySelector('code');
    if (code) code.className = 'bg-transparent p-0 text-sm text-kotext';
  });
  container.querySelectorAll('a').forEach((el) => {
    el.className = 'font-medium text-koaccent underline underline-offset-2 hover:text-koaccent2';
    el.target = '_blank';
    el.rel = 'noopener';
  });
}

function setRegulationSectionExpanded(isExpanded) {
  if (!toggleBtn || !sectionBodyEl || !toggleLabelEl) return;
  toggleBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  toggleLabelEl.textContent = isExpanded ? 'Ukryj' : 'Pokaż';
  sectionBodyEl.hidden = !isExpanded;
  if (collapsedHintEl) {
    collapsedHintEl.hidden = isExpanded;
  }
  if (toggleIconEl) {
    toggleIconEl.classList.toggle('rotate-180', isExpanded);
  }
}

function bindRegulationSectionToggle() {
  if (!toggleBtn || !sectionBodyEl || !toggleLabelEl) return;
  setRegulationSectionExpanded(false);
  toggleBtn.addEventListener('click', () => {
    const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    setRegulationSectionExpanded(!expanded);
  });
}

async function loadConfig() {
  const response = await fetch('/ksejm/deputy/regulations.config.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Nie udało się pobrać konfiguracji regulaminu.');
  }
  return response.json();
}

async function loadMarkdown(path) {
  const response = await fetch(`/ksejm/${path}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Nie udało się pobrać pliku: ${path}`);
  }
  return response.text();
}

function sortRegulations(regulations) {
  return [...regulations].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

function renderRegulationsList(regulations, activeId) {
  if (!listEl) return;
  if (!regulations.length) {
    listEl.innerHTML = '<p class="text-sm text-kodim">Brak pozycji w archiwum.</p>';
    return;
  }

  listEl.innerHTML = regulations.map((entry) => {
    const isActive = entry.id === activeId;
    const activeBadge = isActive
      ? '<span class="rounded-full border border-koaccent/60 bg-koaccent/20 px-2 py-0.5 text-[11px] font-semibold text-koaccenttext">Aktualna</span>'
      : '';

    return `
      <article class="rounded-xl border ${isActive ? 'border-koaccent/70 bg-koaccent/10' : 'border-koborder bg-koelev2/30'} p-3">
        <div class="mb-2 flex items-center justify-between gap-2">
          <h4 class="text-sm font-semibold text-kotext">${escapeHtml(entry.title || entry.id || 'Wersja')}</h4>
          ${activeBadge}
        </div>
        <p class="mb-2 text-xs text-kodim">Data: ${escapeHtml(entry.date || '-')}</p>
        <div class="flex flex-wrap gap-2">
          <button type="button" data-action="preview" data-regulation-id="${escapeHtml(entry.id || '')}" class="rounded-lg border border-koborder bg-koelev2 px-2.5 py-1.5 text-xs font-semibold text-kotext transition hover:border-koaccent">Podgląd</button>
          <a href="/ksejm/${escapeHtml(entry.url || '')}" download class="rounded-lg border border-koborder bg-koelev2 px-2.5 py-1.5 text-xs font-semibold text-kotext transition hover:border-koaccent">Pobierz .md</a>
        </div>
      </article>
    `;
  }).join('');
}

async function renderRegulation(entry, configUpdatedAt) {
  if (!entry) {
    throw new Error('Brak uktualnej wersji regulaminu w konfiguracji.');
  }

  titleEl.textContent = entry.title || 'Regulamin Sejmu';
  dateEl.textContent = entry.date || '-';
  updatedEl.textContent = `Aktualizacja: ${configUpdatedAt || '-'}`;
  contentEl.innerHTML = '<p class="text-sm text-kodim">Ładowanie treści...</p>';

  const markdown = await loadMarkdown(entry.url || '');
  contentEl.innerHTML = md.render(markdown);
  stylizeMarkdown(contentEl);
}

async function bootstrap() {
  try {
    bindRegulationSectionToggle();
    clearAlert();

    const config = await loadConfig();
    const list = Array.isArray(config?.regulations) ? sortRegulations(config.regulations) : [];
    const activeId = String(config?.activeRegulationId || '');
    const active = list.find((entry) => String(entry?.id || '') === activeId) || list[0];

    renderRegulationsList(list, active?.id || '');
    await renderRegulation(active, String(config?.updatedAt || '-'));

    listEl?.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action="preview"]');
      if (!button) return;

      const id = button.dataset.regulationId || '';
      const selected = list.find((entry) => String(entry.id || '') === id);
      if (!selected) return;

      try {
        clearAlert();
        await renderRegulation(selected, String(config?.updatedAt || '-'));
      } catch (error) {
        showAlert(error.message || 'Nie udało się załadować wybranej wersji.');
      }
    });
  } catch (error) {
    showAlert(error.message || 'Nie udało się uruchomić widoku regulaminu.');
    titleEl.textContent = 'Brak regulaminu';
    dateEl.textContent = '-';
    contentEl.innerHTML = '<p class="text-sm text-kodim">Nie udało się wczytać treści regulaminu.</p>';
  }
}

bootstrap();
