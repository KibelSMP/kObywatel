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
      <link rel="stylesheet" href="/map-screenshot.css" />
      <div className="map-page-shell">
        <SiteHeader
          compact
          extra={
            <div className="group" id="mode-toggle" role="group" aria-label="Tryb mapy">
              <button id="mode-general" className="mode-btn" data-mode="general" aria-pressed="true">Ogólne</button>
              <button id="mode-transport" className="mode-btn" data-mode="transport" aria-pressed="false">Transport</button>
              <button id="mode-editor" className="mode-btn" data-mode="editor" aria-pressed="false">Szkic</button>
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
              <button
                type="button"
                id="search-results-close"
                className="search-results-close"
                aria-label="Ukryj wyniki wyszukiwania"
                title="Ukryj wyniki wyszukiwania"
              >
                <Icon name="close" size={11} />
              </button>
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
              <canvas id="screenshot-layer" className="screenshot-layer" aria-hidden="true" />
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

          <div id="screenshot-toolbar" className="sketch-toolbar" hidden aria-label="Szkic">
            <div className="sketch-topline">
              <div className="sketch-dock" id="sketch-dock" role="group" aria-label="Narzędzia rysowania">
                <div className="sketch-dock-scroll">
                  <button type="button" className="screenshot-tool-btn" data-tool="pan" aria-pressed="true" aria-label="Wskaźnik" title="Wskaźnik"><Icon name="pointer" size={18} /></button>
                  <button type="button" className="screenshot-tool-btn" data-tool="select" aria-pressed="false" aria-label="Zaznacz" title="Zaznacz"><Icon name="select" size={18} /></button>
                  <button type="button" className="screenshot-tool-btn" data-tool="pencil" aria-pressed="false" aria-label="Ołówek" title="Ołówek"><Icon name="pencil" size={18} /></button>
                  <button type="button" className="screenshot-tool-btn" data-tool="line" aria-pressed="false" aria-label="Linia" title="Linia"><Icon name="line" size={18} /></button>
                  <button type="button" className="screenshot-tool-btn" data-tool="arrow" aria-pressed="false" aria-label="Strzałka" title="Strzałka"><Icon name="arrow" size={18} /></button>
                  <button type="button" className="screenshot-tool-btn" data-tool="rect" aria-pressed="false" aria-label="Prostokąt" title="Prostokąt"><Icon name="rectangle" size={18} /></button>
                  <button type="button" className="screenshot-tool-btn" data-tool="ellipse" aria-pressed="false" aria-label="Elipsa" title="Elipsa"><Icon name="ellipse" size={18} /></button>
                  <button type="button" className="screenshot-tool-btn" data-tool="text" aria-pressed="false" aria-label="Tekst" title="Tekst"><Icon name="text-tool" size={18} /></button>

                  <div className="sketch-dock-divider" aria-hidden="true" />

                  <button type="button" id="screenshot-undo" className="sketch-dock-btn" aria-label="Cofnij" title="Cofnij"><Icon name="undo" size={18} /></button>
                  <button type="button" id="screenshot-redo" className="sketch-dock-btn" aria-label="Ponów" title="Ponów"><Icon name="redo" size={18} /></button>
                  <button type="button" id="screenshot-delete-selected" className="sketch-dock-btn" aria-label="Usuń zaznaczony kształt" title="Usuń zaznaczony kształt" disabled><Icon name="delete" size={18} /></button>
                  <button type="button" id="screenshot-clear" className="sketch-dock-btn" aria-label="Wyczyść wszystko" title="Wyczyść wszystko"><Icon name="clear-all" size={18} /></button>

                  <div className="sketch-dock-divider" aria-hidden="true" />

                  <button type="button" id="screenshot-export-toggle" className="sketch-dock-btn sketch-dock-export" aria-label="Eksportuj" title="Eksportuj" aria-expanded="false" aria-controls="sketch-export-panel">
                    <Icon name="download" size={18} />
                  </button>
                </div>

                <div className="sketch-export-panel" id="sketch-export-panel" hidden>
                  <div className="screenshot-export-format" role="group" aria-label="Format eksportu">
                    <label><input type="radio" name="screenshot-format" value="png" defaultChecked /> PNG</label>
                    <label><input type="radio" name="screenshot-format" value="pdf" /> PDF</label>
                  </div>
                  <div className="screenshot-pdf-options" id="screenshot-pdf-options" hidden>
                    <label className="screenshot-field">
                      <span>Format strony</span>
                      <select id="screenshot-page-format" defaultValue="a4">
                        <option value="a4">A4</option>
                        <option value="a3">A3</option>
                        <option value="a5">A5</option>
                        <option value="letter">Letter</option>
                      </select>
                    </label>
                    <label className="screenshot-field">
                      <span>Orientacja</span>
                      <select id="screenshot-page-orientation" defaultValue="landscape">
                        <option value="landscape">Poziomo</option>
                        <option value="portrait">Pionowo</option>
                      </select>
                    </label>
                  </div>
                  <button type="button" id="screenshot-export-btn" className="screenshot-export-btn">
                    <Icon name="download" size={16} /> Pobierz
                  </button>
                </div>
              </div>

              <div className="sketch-stylebar" id="sketch-stylebar">
                <label className="sketch-swatch sketch-swatch--fill" id="screenshot-fill-row" hidden title="Kolor wypełnienia">
                  <input type="color" id="screenshot-fill-color" defaultValue="#e11d48" aria-label="Kolor wypełnienia" />
                </label>
                <label className="sketch-swatch sketch-swatch--stroke" title="Kolor obrysu">
                  <input type="color" id="screenshot-stroke-color" defaultValue="#e11d48" aria-label="Kolor obrysu" />
                </label>
                <div className="sketch-slider" id="screenshot-stroke-row">
                  <input type="range" id="screenshot-stroke-width" min="1" max="10" step="1" defaultValue="2" aria-label="Grubość obrysu" />
                  <span className="sketch-slider-value" id="screenshot-stroke-width-value">2</span>
                </div>
                <div className="sketch-slider" id="screenshot-text-size-row" hidden>
                  <input type="range" id="screenshot-font-size" min="8" max="48" step="1" defaultValue="16" aria-label="Rozmiar tekstu" />
                  <span className="sketch-slider-value" id="screenshot-font-size-value">16</span>
                </div>
                <label className="sketch-toggle" id="screenshot-fill-opacity-row" hidden title="Półprzezroczystość wypełnienia">
                  <input type="checkbox" id="screenshot-fill-opacity" defaultChecked aria-label="Półprzezroczystość wypełnienia" />
                  <span>Półprzezroczystość</span>
                </label>

                <button type="button" id="screenshot-coord-toggle" className="sketch-coord-btn" aria-expanded="false" aria-controls="screenshot-coord-form" hidden>
                  Koordynaty
                </button>
              </div>
            </div>

            {/*
              Poza .sketch-dock celowo: .sketch-dock ma backdrop-filter, który (tak
              jak filter/transform/will-change:transform) tworzy nowy containing
              block dla position:fixed potomków — gdyby ten popover siedział w
              środku, jego fixed top/left liczyłyby się względem .sketch-dock, nie
              viewportu, i positionCoordForm() w map-screenshot.js (który zakłada
              współrzędne z getBoundingClientRect() względem viewportu) wystawiałby
              go w złym miejscu (zwłaszcza w mobilnym, dolnym układzie doku).
            */}
            <div className="screenshot-coord-form" id="screenshot-coord-form" hidden>
              <div className="screenshot-coord-title">Dodaj wg współrzędnych (X, Z)</div>
              <div className="screenshot-coord-inputs">
                <input type="number" id="screenshot-coord-x1" placeholder="X1" aria-label="X1" />
                <input type="number" id="screenshot-coord-z1" placeholder="Z1" aria-label="Z1" />
                <span className="screenshot-coord-sep" id="screenshot-coord-sep2" aria-hidden="true">→</span>
                <input type="number" id="screenshot-coord-x2" placeholder="X2" aria-label="X2" />
                <input type="number" id="screenshot-coord-z2" placeholder="Z2" aria-label="Z2" />
              </div>
              <button type="button" id="screenshot-coord-add">Dodaj kształt</button>
            </div>
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
        jspdf
        scripts={[
          { src: '/map.js', type: 'module' },
          { src: '/route-search.js', type: 'module' },
          { src: '/map-screenshot.js', type: 'module' },
        ]}
      />
    </>
  );
}
