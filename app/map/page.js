import IslandLoader from '@/components/IslandLoader';
import Icon from '@/components/Icon';
import SiteHeader from '@/components/SiteHeader';

export const metadata = {
  title: 'Mapa',
  description: 'Interaktywna mapa świata KibelSMP: punkty, linie, wyszukiwanie tras.',
  openGraph: {
    title: 'Mapa · kObywatel',
    description: 'Interaktywna mapa świata KibelSMP: punkty, linie, wyszukiwanie tras.',
    url: '/map',
    images: ['/assets/og/OG-Standard-Mapa.png'],
  },
  twitter: { images: ['/assets/og/OG-Twitter-Mapa.png'] },
};

// The map is a self-contained imperative island. This renders the exact DOM shell
// map.js queries (same ids/classes), styled by map.css; map.js + route-search.js
// are mounted after the shell exists.
//
// The map now uses the SAME shared header/nav as every other page (SiteHeader),
// with the theme and general/transport mode toggles added into it via the `extra`
// slot. Zoom/copy-link controls and the point/route search stay as floating cards
// over the map itself (like the pre-redesign layout) — map.js reparents the search
// row and the lines list into the mobile "Legenda" sheet on narrow screens (see
// ensureMobileSheet()/reparentForLayout() there); #filters-panel/#lines-legend/
// #map-search-float keep their desktop-only presentation above that breakpoint.
export default function MapPage() {
  return (
    <>
      <link rel="stylesheet" href="/map.css" />
      <div className="map-page-shell">
        <SiteHeader
          compact
          extra={
            <div className="group" id="mode-toggle" role="group" aria-label="Tryb mapy">
              <button id="mode-general" className="mode-btn" data-mode="general" aria-pressed="true">Ogólne</button>
              <button id="mode-transport" className="mode-btn" data-mode="transport" aria-pressed="false">Transport</button>
            </div>
          }
        />

        <div id="map-app" className="map-app" data-theme="auto">
          <div id="map-controls" className="map-controls-float" role="toolbar" aria-label="Sterowanie mapą">
            <button id="btn-zoom-in" aria-label="Powiększ (+)">＋</button>
            <button id="btn-zoom-out" aria-label="Pomniejsz (−)">−</button>
            <button id="btn-zoom-reset" aria-label="Reset (0)"><Icon name="reset" size={18} /></button>
            <button id="btn-copy-focus" aria-label="Kopiuj link do celu" title="Kopiuj link do celu"><Icon name="link" size={18} /></button>
            <button id="btn-theme" aria-label="Przełącz motyw mapy" title="Przełącz motyw mapy"><Icon name="light_dark_mode" size={18} /></button>
          </div>

          <div id="map-search-float" className="map-search-float">
            <div id="map-search-row" className="map-search-row">
              <div className="point-search-row" id="point-search-section">
                <input id="point-search" type="text" placeholder="Szukaj punktu" aria-label="Szukaj punktu" />
                <button id="point-search-clear" className="point-search-clear" aria-label="Wyczyść wyszukiwanie" title="Wyczyść">✕</button>
              </div>
              <div className="route-row route-stations" id="route-search-section" hidden aria-label="Wybór stacji">
                <datalist id="stations-list" />
                <input id="route-from" list="stations-list" placeholder="Skąd" aria-label="Stacja początkowa" />
                <button id="route-swap" className="swap-btn" title="Zamień" aria-label="Zamień">⇄</button>
                <input id="route-to" list="stations-list" placeholder="Dokąd" aria-label="Stacja docelowa" />
                <button id="route-clear" className="clear-btn" title="Wyczyść" aria-label="Wyczyść">✕</button>
                <button id="route-search" className="search-btn" aria-label="Szukaj trasy">Szukaj</button>
              </div>
            </div>

            <div id="search-bubble" className="search-dropdown" aria-label="Wyniki wyszukiwania">
              <div id="point-search-dropdown" className="point-search-dropdown">
                <div id="point-search-results" className="point-results" aria-live="polite" aria-label="Wyniki wyszukiwania punktów" hidden />
                <div id="point-search-detail" className="point-detail" aria-live="polite" aria-label="Szczegóły punktu" hidden />
              </div>
              <div id="route-search-dropdown" className="route-search-dropdown" hidden>
                <details className="filters-box" id="route-type-filters" aria-label="Filtr typów linii">
                  <summary><span>Typy</span><span className="value" id="type-filters-summary">Wszystkie</span></summary>
                  <div className="filters-grid">
                    <label><input type="checkbox" data-type="IC" defaultChecked /> IC</label>
                    <label><input type="checkbox" data-type="REGIO" defaultChecked /> REGIO</label>
                    <label><input type="checkbox" data-type="METRO" defaultChecked /> METRO</label>
                    <label><input type="checkbox" data-type="ON" defaultChecked /> NŻ</label>
                    <label><input type="checkbox" data-type="FLIGHT" defaultChecked /> LOT</label>
                  </div>
                </details>
                <details className="filters-box" id="route-priority-box" aria-label="Priorytet wyszukiwania">
                  <summary><span>Priorytet</span><span className="value" id="priority-summary">Mniej przesiadek</span></summary>
                  <div className="filters-grid priority-grid">
                    <label><input type="radio" name="route-priority" value="transfers" defaultChecked /> Mniej przesiadek</label>
                    <label><input type="radio" name="route-priority" value="stops" /> Mniej przystanków</label>
                  </div>
                </details>
                <div id="route-results" className="route-results" aria-live="polite" />
              </div>
            </div>
          </div>

          {/*
            Desktop: a plain top-right card showing only #legend (category toggles),
            aria-label "Legenda". Mobile: becomes the bottom "Legenda" sheet — map.js
            moves #map-search-row and the contents of #lines-legend/#search-bubble in
            here (into #lines-panel/#results-panel) so peeked state shows just the
            search row under a drag handle, and expanding reveals tab-switched
            Legenda/Linie/Wyniki panels below it.
          */}
          <div className="map-sidepanel" aria-label="Legenda" id="filters-panel">
            <button type="button" id="btn-filters" className="filters-handle" aria-expanded="false" aria-controls="sheet-panels" hidden>
              <span className="filters-handle-bar" aria-hidden="true" />
            </button>
            <div id="sheet-search-slot" className="sheet-search-slot" />
            <div className="sheet-tabs" role="tablist" aria-label="Zawartość legendy" id="sheet-tabs">
              <button type="button" className="sheet-tab" data-tab="legend" aria-selected="true" id="sheet-tab-legend">Legenda</button>
              <button type="button" className="sheet-tab" data-tab="lines" aria-selected="false" id="sheet-tab-lines">Linie</button>
              <button type="button" className="sheet-tab" data-tab="results" aria-selected="false" id="sheet-tab-results">Wyniki</button>
            </div>
            <div className="sheet-panels" id="sheet-panels">
              <div className="sheet-panel" data-panel="legend" id="legend-panel">
                <div className="legend-group" id="legend" />
              </div>
              <div className="sheet-panel" data-panel="lines" id="lines-panel" hidden />
              <div className="sheet-panel" data-panel="results" id="results-panel" hidden />
            </div>
          </div>

          <div id="map-viewport" className="map-viewport" tabIndex={0} aria-label="Mapa świata">
            <div id="map-canvas" className="map-canvas">
              <img id="map-image" alt="Mapa świata" draggable={false} />
              <canvas id="lines-layer" className="lines-layer" aria-hidden="true" />
              <div id="markers-layer" className="markers-layer" aria-hidden="false" />
              <div id="political-layer" className="political-layer" aria-hidden="true" />
            </div>
            <div id="map-crosshair" className="map-crosshair" aria-hidden="true" />
            <div className="loading" id="loading">Ładowanie mapy…</div>
          </div>

          <div id="point-panel" className="point-panel" hidden>
            <button className="close-panel" id="close-panel" aria-label="Zamknij panel">×</button>
            <button className="pin-panel" id="pin-panel" aria-label="Przypnij panel" title="Przypnij panel">
              <span id="pin-panel-icon" className="ui-icon" style={{ '--icon': "url(/icns_ui/pin.svg)", width: 18, height: 18 }} aria-hidden="true" />
            </button>
            <div className="point-content" id="point-content" />
          </div>

          <div id="info-bubble" className="info-bubble" aria-live="polite">
            <div className="info-head">
              <span className="info-title">Info</span>
              <button id="info-close" className="info-close" type="button" aria-label="Ukryj informacje" title="Ukryj informacje">✕</button>
            </div>
            <div id="info-body" className="info-body">
              <div className="info-row" data-info-row="cursor">
                <span className="info-label">Kursor</span>
                <span className="info-value" id="info-cursor">—</span>
              </div>
              <div className="info-row">
                <span className="info-label">Celownik</span>
                <span className="info-value" id="info-crosshair">—</span>
              </div>
              <div className="info-row" id="info-updated-row">
                <span className="info-label">Aktualizacja</span>
                <span className="info-value" id="info-updated">—</span>
              </div>
              <a className="info-action" id="info-propose" href="/map/add/" target="_blank" rel="noreferrer noopener">Zaproponuj punkt</a>
            </div>
          </div>
          <button id="info-fab" className="info-fab" aria-label="Pokaż informacje" title="Pokaż informacje">
            <Icon name="my_location" size={22} />
          </button>

          {/* Desktop-only widget; on mobile its body is moved into #lines-panel (see map.js). */}
          <div id="lines-legend" className="lines-legend collapsed" hidden aria-label="Legenda linii kolejowych i metra">
            <div className="lines-legend-header">
              <button id="lines-legend-toggle" type="button" aria-expanded="false" aria-controls="lines-legend-body" title="Pokaż / ukryj legendę linii">Linie ▼</button>
              <div className="lines-legend-status" id="lines-legend-status" aria-live="polite" />
            </div>
            <div className="lines-legend-body" id="lines-legend-body" hidden />
          </div>
        </div>
      </div>

      <IslandLoader
        db
        utils
        scripts={[
          { src: '/map.js', type: 'module' },
          { src: '/route-search.js', type: 'module' },
        ]}
      />
    </>
  );
}
