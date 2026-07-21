// Edytor zrzutów ekranu / adnotacji na mapie. Wyspa (island) doczepiona do map.js:
// rysuje na dodatkowej, przezroczystej warstwie canvas (#screenshot-layer) wewnątrz
// #map-canvas, wg dokładnie tego samego wzorca co #lines-layer w map.js (drawLines()) —
// współrzędne przeliczane na świeżo z aktualnych scale/originX/originY przy każdym
// rysowaniu, więc adnotacje zostają na miejscu przy panowaniu/zoomie. Wymaga rozszerzonego
// window.MapApp (getViewState/screenToMapPx/logicalToMapPx/onTransform/renderBaseMapToCanvas),
// wystawionego przez map.js – ten skrypt musi się ładować PO map.js.
//
// Edytor jest trzecim trybem w istniejącym przełączniku Ogólne/Transport (#mode-toggle,
// przycisk #mode-editor) – map.js sam nie wie nic o "editor" jako trybie (jego
// applyMode() traktuje każdą wartość inną niż 'transport' jak 'general', co jest
// nieszkodliwym fallbackiem), więc chowanie punktów/legendy i otwieranie panelu
// robimy tutaj, osobno od istniejącej logiki kategorii/tras w map.js.
console.log('[map-screenshot] script start');

const MapApp = window.MapApp;
const viewport = document.getElementById('map-viewport');
const canvasEl = document.getElementById('screenshot-layer');
const linesCanvasEl = document.getElementById('lines-layer');
const ctx = canvasEl ? canvasEl.getContext('2d') : null;

const modeGeneralBtn = document.getElementById('mode-general');
const modeTransportBtn = document.getElementById('mode-transport');
const modeEditorBtn = document.getElementById('mode-editor');
const markersLayer = document.getElementById('markers-layer');
const filtersPanel = document.getElementById('filters-panel');

const toolbar = document.getElementById('screenshot-toolbar');
const closeBtn = document.getElementById('screenshot-close');
const toolButtons = Array.from(document.querySelectorAll('.screenshot-tool-btn'));

const strokeColorInput = document.getElementById('screenshot-stroke-color');
const strokeWidthInput = document.getElementById('screenshot-stroke-width');
const strokeWidthValueEl = document.getElementById('screenshot-stroke-width-value');
const fillColorInput = document.getElementById('screenshot-fill-color');
const fillOpacityInput = document.getElementById('screenshot-fill-opacity');
const fillOpacityValueEl = document.getElementById('screenshot-fill-opacity-value');
const fontSizeRow = document.getElementById('screenshot-text-size-row');
const fontSizeInput = document.getElementById('screenshot-font-size');
const fontSizeValueEl = document.getElementById('screenshot-font-size-value');

const coordForm = document.getElementById('screenshot-coord-form');
const coordX1 = document.getElementById('screenshot-coord-x1');
const coordZ1 = document.getElementById('screenshot-coord-z1');
const coordX2 = document.getElementById('screenshot-coord-x2');
const coordZ2 = document.getElementById('screenshot-coord-z2');
const coordSep = document.getElementById('screenshot-coord-sep2');
const coordAddBtn = document.getElementById('screenshot-coord-add');

const undoBtn = document.getElementById('screenshot-undo');
const redoBtn = document.getElementById('screenshot-redo');
const clearBtn = document.getElementById('screenshot-clear');
const deleteSelectedBtn = document.getElementById('screenshot-delete-selected');

const formatRadios = Array.from(document.querySelectorAll('input[name="screenshot-format"]'));
const pdfOptions = document.getElementById('screenshot-pdf-options');
const pageFormatSelect = document.getElementById('screenshot-page-format');
const pageOrientationSelect = document.getElementById('screenshot-page-orientation');
const exportBtn = document.getElementById('screenshot-export-btn');

const SELECTION_COLOR = '#2563eb';

if (MapApp && canvasEl && ctx && viewport) {
  let tool = 'pan'; // 'pan' | 'select' | 'pencil' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text'
  let strokeColor = strokeColorInput ? strokeColorInput.value : '#e11d48';
  let strokeWidthMapPx = strokeWidthInput ? Number(strokeWidthInput.value) : 2;
  let fillColor = fillColorInput ? fillColorInput.value : '#e11d48';
  let fillOpacity = fillOpacityInput ? Number(fillOpacityInput.value) : 0.25;
  let fontSizeMapPx = fontSizeInput ? Number(fontSizeInput.value) : 16;

  let shapes = [];
  let activeShape = null;
  let undoStack = [];
  let redoStack = [];
  let dragging = false;
  let pendingTextInput = null; // { el, anchor }

  // --- Zaznaczanie / edycja istniejących kształtów (narzędzie "Zaznacz") ---
  let selectedIndex = -1;
  let selectedShape = null;
  let dragMode = null; // 'move' | 'resize' | null
  let dragHandleRole = null;
  let dragStartPointer = null; // map-px, pozycja kursora w chwili rozpoczęcia przeciągania
  let dragStartShapeSnapshot = null; // głęboka kopia kształtu sprzed przeciągania
  let styleEditSnapshotTaken = false; // zbiera kolejne "input" ze sliderów/przeciągnięcie w jeden wpis cofania

  function toScreen(view, pt) {
    return { x: view.originX + pt.x * view.scale, y: view.originY + pt.y * view.scale };
  }

  function resizeCanvasIfNeeded() {
    const dpr = window.devicePixelRatio || 1;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const w = Math.round(vw * dpr);
    const h = Math.round(vh * dpr);
    if (canvasEl.width !== w || canvasEl.height !== h) {
      canvasEl.width = w;
      canvasEl.height = h;
      canvasEl.style.width = vw + 'px';
      canvasEl.style.height = vh + 'px';
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function drawArrowHead(c, a, b, widthScreen, color) {
    const headLen = Math.max(8, widthScreen * 3);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    c.beginPath();
    c.moveTo(b.x, b.y);
    c.lineTo(b.x - headLen * Math.cos(angle - Math.PI / 6), b.y - headLen * Math.sin(angle - Math.PI / 6));
    c.moveTo(b.x, b.y);
    c.lineTo(b.x - headLen * Math.cos(angle + Math.PI / 6), b.y - headLen * Math.sin(angle + Math.PI / 6));
    c.strokeStyle = color;
    c.lineWidth = Math.max(1, widthScreen);
    c.stroke();
  }

  function drawShape(view, shape) {
    ctx.save();
    const widthScreen = Math.max(1, (shape.strokeWidthMapPx || 1) * view.scale);
    switch (shape.type) {
      case 'pencil': {
        if (shape.points.length < 2) break;
        ctx.strokeStyle = shape.strokeColor;
        ctx.lineWidth = widthScreen;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        const p0 = toScreen(view, shape.points[0]);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 1; i < shape.points.length; i++) {
          const p = toScreen(view, shape.points[i]);
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        break;
      }
      case 'line':
      case 'arrow': {
        const a = toScreen(view, shape.a);
        const b = toScreen(view, shape.b);
        ctx.strokeStyle = shape.strokeColor;
        ctx.lineWidth = widthScreen;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        if (shape.type === 'arrow') drawArrowHead(ctx, a, b, widthScreen, shape.strokeColor);
        break;
      }
      case 'rect': {
        const a = toScreen(view, shape.a);
        const b = toScreen(view, shape.b);
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        const w = Math.abs(b.x - a.x);
        const h = Math.abs(b.y - a.y);
        if (shape.fillOpacity > 0) {
          ctx.globalAlpha = shape.fillOpacity;
          ctx.fillStyle = shape.fillColor;
          ctx.fillRect(x, y, w, h);
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = shape.strokeColor;
        ctx.lineWidth = widthScreen;
        ctx.strokeRect(x, y, w, h);
        break;
      }
      case 'ellipse': {
        const a = toScreen(view, shape.a);
        const b = toScreen(view, shape.b);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        const rx = Math.abs(b.x - a.x) / 2;
        const ry = Math.abs(b.y - a.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        if (shape.fillOpacity > 0) {
          ctx.globalAlpha = shape.fillOpacity;
          ctx.fillStyle = shape.fillColor;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        ctx.strokeStyle = shape.strokeColor;
        ctx.lineWidth = widthScreen;
        ctx.stroke();
        break;
      }
      case 'text': {
        const p = toScreen(view, shape.anchor);
        ctx.fillStyle = shape.color;
        ctx.font = `${Math.max(1, shape.fontSizeMapPx * view.scale)}px sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(shape.text, p.x, p.y);
        break;
      }
      default:
        break;
    }
    ctx.restore();
  }

  // --- Geometria pomocnicza: bounding boxy, uchwyty, hit-testing (dla narzędzia "Zaznacz") ---

  function getPointsBBox(points) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }

  function textBoundsMapPx(shape) {
    ctx.save();
    ctx.font = `${shape.fontSizeMapPx}px sans-serif`;
    const w = ctx.measureText(shape.text).width;
    ctx.restore();
    return { minX: shape.anchor.x, minY: shape.anchor.y, maxX: shape.anchor.x + w, maxY: shape.anchor.y + shape.fontSizeMapPx };
  }

  function getShapeBBox(shape) {
    switch (shape.type) {
      case 'pencil':
        return getPointsBBox(shape.points);
      case 'text':
        return textBoundsMapPx(shape);
      default:
        return {
          minX: Math.min(shape.a.x, shape.b.x),
          minY: Math.min(shape.a.y, shape.b.y),
          maxX: Math.max(shape.a.x, shape.b.x),
          maxY: Math.max(shape.a.y, shape.b.y),
        };
    }
  }

  function getShapeHandles(shape) {
    switch (shape.type) {
      case 'line':
      case 'arrow':
        return [
          { role: 'a', x: shape.a.x, y: shape.a.y },
          { role: 'b', x: shape.b.x, y: shape.b.y },
        ];
      case 'rect':
      case 'ellipse':
        return [
          { role: 'aa', x: shape.a.x, y: shape.a.y },
          { role: 'ba', x: shape.b.x, y: shape.a.y },
          { role: 'ab', x: shape.a.x, y: shape.b.y },
          { role: 'bb', x: shape.b.x, y: shape.b.y },
        ];
      case 'pencil': {
        const b = getPointsBBox(shape.points);
        return [
          { role: 'tl', x: b.minX, y: b.minY },
          { role: 'tr', x: b.maxX, y: b.minY },
          { role: 'bl', x: b.minX, y: b.maxY },
          { role: 'br', x: b.maxX, y: b.maxY },
        ];
      }
      default:
        return [];
    }
  }

  function distToSegment(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + t * dx, cy = a.y + t * dy;
    return Math.hypot(p.x - cx, p.y - cy);
  }

  function hitTestShapeBody(shape, mapPx, view) {
    const tol = 6 / view.scale;
    switch (shape.type) {
      case 'pencil': {
        const half = (shape.strokeWidthMapPx || 1) / 2;
        for (let i = 1; i < shape.points.length; i++) {
          if (distToSegment(mapPx, shape.points[i - 1], shape.points[i]) <= tol + half) return true;
        }
        return false;
      }
      case 'line':
      case 'arrow':
        return distToSegment(mapPx, shape.a, shape.b) <= tol + (shape.strokeWidthMapPx || 1) / 2;
      case 'ellipse': {
        const cx = (shape.a.x + shape.b.x) / 2;
        const cy = (shape.a.y + shape.b.y) / 2;
        const rx = Math.abs(shape.b.x - shape.a.x) / 2 + tol;
        const ry = Math.abs(shape.b.y - shape.a.y) / 2 + tol;
        if (rx <= 0 || ry <= 0) return false;
        const nx = (mapPx.x - cx) / rx, ny = (mapPx.y - cy) / ry;
        return nx * nx + ny * ny <= 1;
      }
      case 'rect':
      case 'text': {
        const b = getShapeBBox(shape);
        return mapPx.x >= b.minX - tol && mapPx.x <= b.maxX + tol && mapPx.y >= b.minY - tol && mapPx.y <= b.maxY + tol;
      }
      default:
        return false;
    }
  }

  function hitTestShapes(mapPx, view) {
    for (let i = shapes.length - 1; i >= 0; i--) {
      if (hitTestShapeBody(shapes[i], mapPx, view)) return i;
    }
    return -1;
  }

  function hitTestHandle(shape, mapPx, view) {
    const handles = getShapeHandles(shape);
    const p = toScreen(view, mapPx);
    const tolScreen = 10;
    for (const h of handles) {
      const s = toScreen(view, h);
      if (Math.hypot(s.x - p.x, s.y - p.y) <= tolScreen) return h;
    }
    return null;
  }

  function drawSelectionUI(view, shape) {
    const b = getShapeBBox(shape);
    const tl = toScreen(view, { x: b.minX, y: b.minY });
    const br = toScreen(view, { x: b.maxX, y: b.maxY });
    ctx.save();
    ctx.strokeStyle = SELECTION_COLOR;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(tl.x - 4, tl.y - 4, (br.x - tl.x) + 8, (br.y - tl.y) + 8);
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    for (const h of getShapeHandles(shape)) {
      const s = toScreen(view, h);
      ctx.fillRect(s.x - 5, s.y - 5, 10, 10);
      ctx.strokeRect(s.x - 5, s.y - 5, 10, 10);
    }
    ctx.restore();
  }

  function applyTranslateToShape(shape, snapshot, dx, dy) {
    switch (shape.type) {
      case 'pencil':
        shape.points = snapshot.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        break;
      case 'text':
        shape.anchor = { x: snapshot.anchor.x + dx, y: snapshot.anchor.y + dy };
        break;
      default:
        shape.a = { x: snapshot.a.x + dx, y: snapshot.a.y + dy };
        shape.b = { x: snapshot.b.x + dx, y: snapshot.b.y + dy };
        break;
    }
  }

  function applyResizeToShape(shape, role, mapPx) {
    switch (shape.type) {
      case 'line':
      case 'arrow':
        if (role === 'a') shape.a = { x: mapPx.x, y: mapPx.y };
        else if (role === 'b') shape.b = { x: mapPx.x, y: mapPx.y };
        break;
      case 'rect':
      case 'ellipse':
        if (role === 'aa') { shape.a = { x: mapPx.x, y: mapPx.y }; }
        else if (role === 'ba') { shape.b = { x: mapPx.x, y: shape.b.y }; shape.a = { x: shape.a.x, y: mapPx.y }; }
        else if (role === 'ab') { shape.a = { x: mapPx.x, y: shape.a.y }; shape.b = { x: shape.b.x, y: mapPx.y }; }
        else if (role === 'bb') { shape.b = { x: mapPx.x, y: mapPx.y }; }
        break;
      case 'pencil': {
        const snap = dragStartShapeSnapshot;
        const bbox = getPointsBBox(snap.points);
        let anchorX, anchorY, oldCornerX, oldCornerY;
        if (role === 'tl') { anchorX = bbox.maxX; anchorY = bbox.maxY; oldCornerX = bbox.minX; oldCornerY = bbox.minY; }
        else if (role === 'tr') { anchorX = bbox.minX; anchorY = bbox.maxY; oldCornerX = bbox.maxX; oldCornerY = bbox.minY; }
        else if (role === 'bl') { anchorX = bbox.maxX; anchorY = bbox.minY; oldCornerX = bbox.minX; oldCornerY = bbox.maxY; }
        else { anchorX = bbox.minX; anchorY = bbox.minY; oldCornerX = bbox.maxX; oldCornerY = bbox.maxY; }
        const scaleX = (oldCornerX - anchorX) !== 0 ? (mapPx.x - anchorX) / (oldCornerX - anchorX) : 1;
        const scaleY = (oldCornerY - anchorY) !== 0 ? (mapPx.y - anchorY) / (oldCornerY - anchorY) : 1;
        shape.points = snap.points.map((p) => ({
          x: anchorX + (p.x - anchorX) * scaleX,
          y: anchorY + (p.y - anchorY) * scaleY,
        }));
        break;
      }
      default:
        break;
    }
  }

  function render() {
    resizeCanvasIfNeeded();
    const view = MapApp.getViewState();
    canvasEl.style.transformOrigin = '0 0';
    canvasEl.style.transform = `scale(${1 / view.scale}) translate(${-view.originX}px, ${-view.originY}px)`;
    ctx.clearRect(0, 0, viewport.clientWidth, viewport.clientHeight);
    for (const shape of shapes) drawShape(view, shape);
    if (activeShape) drawShape(view, activeShape);
    if (tool === 'select' && selectedShape) drawSelectionUI(view, selectedShape);
    repositionPendingTextInput();
  }

  function snap(v) {
    return Math.round(v);
  }
  function snapPoint(p) {
    return { x: snap(p.x), y: snap(p.y) };
  }
  function snapShape(shape) {
    switch (shape.type) {
      case 'pencil':
        return { ...shape, points: shape.points.map(snapPoint) };
      case 'line':
      case 'arrow':
      case 'rect':
      case 'ellipse':
        return { ...shape, a: snapPoint(shape.a), b: snapPoint(shape.b) };
      case 'text':
        return { ...shape, anchor: snapPoint(shape.anchor) };
      default:
        return shape;
    }
  }

  function updateUndoRedoButtons() {
    if (undoBtn) undoBtn.disabled = undoStack.length === 0;
    if (redoBtn) redoBtn.disabled = redoStack.length === 0;
  }

  function pushUndoSnapshot() {
    undoStack.push(JSON.stringify(shapes));
    redoStack.length = 0;
    updateUndoRedoButtons();
  }

  function ensureStyleEditSnapshot() {
    if (!styleEditSnapshotTaken) {
      pushUndoSnapshot();
      styleEditSnapshotTaken = true;
    }
  }

  function commitShape(shape) {
    pushUndoSnapshot();
    shapes.push(shape);
    render();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(JSON.stringify(shapes));
    shapes = JSON.parse(undoStack.pop());
    selectShape(null);
    updateUndoRedoButtons();
    render();
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(JSON.stringify(shapes));
    shapes = JSON.parse(redoStack.pop());
    selectShape(null);
    updateUndoRedoButtons();
    render();
  }

  function clearAll() {
    if (!shapes.length) return;
    pushUndoSnapshot();
    shapes = [];
    selectShape(null);
    render();
  }

  function deleteSelected() {
    if (selectedIndex < 0) return;
    pushUndoSnapshot();
    shapes.splice(selectedIndex, 1);
    selectShape(null);
  }

  // --- Panel stylu odzwierciedla właściwości zaznaczonego kształtu (a nie tylko "domyślne dla nowych") ---

  function loadStyleControlsFromShape(shape) {
    if (shape.type === 'text') {
      strokeColor = shape.color;
      fontSizeMapPx = shape.fontSizeMapPx;
      if (strokeColorInput) strokeColorInput.value = shape.color;
      if (fontSizeInput) fontSizeInput.value = String(shape.fontSizeMapPx);
      if (fontSizeValueEl) fontSizeValueEl.textContent = String(shape.fontSizeMapPx);
      return;
    }
    strokeColor = shape.strokeColor;
    strokeWidthMapPx = shape.strokeWidthMapPx;
    if (strokeColorInput) strokeColorInput.value = shape.strokeColor;
    if (strokeWidthInput) strokeWidthInput.value = String(shape.strokeWidthMapPx);
    if (strokeWidthValueEl) strokeWidthValueEl.textContent = String(shape.strokeWidthMapPx);
    if (shape.type === 'rect' || shape.type === 'ellipse') {
      fillColor = shape.fillColor;
      fillOpacity = shape.fillOpacity;
      if (fillColorInput) fillColorInput.value = shape.fillColor;
      if (fillOpacityInput) fillOpacityInput.value = String(shape.fillOpacity);
      if (fillOpacityValueEl) fillOpacityValueEl.textContent = Math.round(shape.fillOpacity * 100) + '%';
    }
  }

  function updateStyleRowsVisibility() {
    const showFont = tool === 'text' || (tool === 'select' && selectedShape?.type === 'text');
    if (fontSizeRow) fontSizeRow.hidden = !showFont;
  }

  function selectShape(idx) {
    selectedIndex = idx == null || idx < 0 ? -1 : idx;
    selectedShape = selectedIndex >= 0 ? shapes[selectedIndex] : null;
    styleEditSnapshotTaken = false;
    if (deleteSelectedBtn) deleteSelectedBtn.disabled = !selectedShape;
    if (selectedShape) loadStyleControlsFromShape(selectedShape);
    updateStyleRowsVisibility();
    render();
  }

  function repositionPendingTextInput() {
    if (!pendingTextInput) return;
    const view = MapApp.getViewState();
    const rect = viewport.getBoundingClientRect();
    const sx = rect.left + view.originX + pendingTextInput.anchor.x * view.scale;
    const sy = rect.top + view.originY + pendingTextInput.anchor.y * view.scale;
    Object.assign(pendingTextInput.el.style, { left: sx + 'px', top: sy + 'px' });
  }

  function openInlineTextInput(anchor, initialValue, onCommit) {
    if (pendingTextInput) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'screenshot-text-input';
    input.placeholder = 'Wpisz tekst…';
    input.value = initialValue || '';
    document.body.appendChild(input);
    pendingTextInput = { el: input, anchor };
    repositionPendingTextInput();
    input.focus();
    if (initialValue) input.select();

    const onKeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cleanup();
      }
    };
    function commit() {
      const text = input.value.trim();
      if (text) onCommit(text);
      cleanup();
    }
    function cleanup() {
      input.removeEventListener('keydown', onKeydown);
      input.removeEventListener('blur', commit);
      input.remove();
      pendingTextInput = null;
      render();
    }
    input.addEventListener('keydown', onKeydown);
    input.addEventListener('blur', commit);
  }

  function startTextInput(mapPxAnchor) {
    openInlineTextInput(mapPxAnchor, '', (text) => {
      commitShape(snapShape({ type: 'text', anchor: mapPxAnchor, text, fontSizeMapPx, color: strokeColor }));
    });
  }

  function editTextShape(shape) {
    openInlineTextInput(shape.anchor, shape.text, (text) => {
      if (text !== shape.text) {
        pushUndoSnapshot();
        shape.text = text;
        render();
      }
    });
  }

  function cancelActiveDrawing() {
    dragging = false;
    activeShape = null;
    dragMode = null;
    dragHandleRole = null;
    dragStartShapeSnapshot = null;
    dragStartPointer = null;
    if (pendingTextInput) pendingTextInput.el.blur();
  }

  function setTool(next) {
    const leavingSelect = tool === 'select' && next !== 'select';
    tool = next;
    toolButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === next)));
    canvasEl.style.pointerEvents = next === 'pan' ? 'none' : 'auto';
    canvasEl.style.cursor = next === 'pan' ? '' : next === 'select' ? 'default' : 'crosshair';
    const supportsCoordForm = ['line', 'arrow', 'rect', 'ellipse', 'text'].includes(next);
    if (coordForm) coordForm.hidden = !supportsCoordForm;
    const singlePoint = next === 'text';
    if (coordX2) coordX2.hidden = singlePoint;
    if (coordZ2) coordZ2.hidden = singlePoint;
    if (coordSep) coordSep.hidden = singlePoint;
    cancelActiveDrawing();
    if (leavingSelect) selectShape(null);
    updateStyleRowsVisibility();
    render();
  }

  function onPointerDown(e) {
    if (tool === 'pan') return;
    e.stopPropagation();
    e.preventDefault();
    const view = MapApp.getViewState();
    const mapPx = MapApp.screenToMapPx(e.clientX, e.clientY);

    if (tool === 'select') {
      if (selectedShape) {
        const handle = hitTestHandle(selectedShape, mapPx, view);
        if (handle) {
          dragging = true;
          dragMode = 'resize';
          dragHandleRole = handle.role;
          dragStartShapeSnapshot = JSON.parse(JSON.stringify(selectedShape));
          styleEditSnapshotTaken = false;
          try { canvasEl.setPointerCapture(e.pointerId); } catch (_) {}
          return;
        }
      }
      const idx = hitTestShapes(mapPx, view);
      if (idx >= 0) {
        selectShape(idx);
        dragging = true;
        dragMode = 'move';
        dragStartPointer = mapPx;
        dragStartShapeSnapshot = JSON.parse(JSON.stringify(shapes[idx]));
        try { canvasEl.setPointerCapture(e.pointerId); } catch (_) {}
      } else {
        selectShape(null);
      }
      return;
    }

    if (tool === 'text') {
      startTextInput(mapPx);
      return;
    }
    dragging = true;
    try { canvasEl.setPointerCapture(e.pointerId); } catch (_) {}
    if (tool === 'pencil') {
      activeShape = { type: 'pencil', points: [mapPx], strokeColor, strokeWidthMapPx };
    } else if (tool === 'line' || tool === 'arrow') {
      activeShape = { type: tool, a: mapPx, b: mapPx, strokeColor, strokeWidthMapPx };
    } else if (tool === 'rect' || tool === 'ellipse') {
      activeShape = { type: tool, a: mapPx, b: mapPx, strokeColor, strokeWidthMapPx, fillColor, fillOpacity };
    }
    render();
  }

  function onPointerMove(e) {
    if (!dragging) return;
    e.stopPropagation();
    const mapPx = MapApp.screenToMapPx(e.clientX, e.clientY);

    if (tool === 'select' && selectedShape && dragMode) {
      ensureStyleEditSnapshot();
      if (dragMode === 'move') {
        const dx = mapPx.x - dragStartPointer.x;
        const dy = mapPx.y - dragStartPointer.y;
        applyTranslateToShape(selectedShape, dragStartShapeSnapshot, dx, dy);
      } else if (dragMode === 'resize') {
        applyResizeToShape(selectedShape, dragHandleRole, mapPx);
      }
      render();
      return;
    }

    if (!activeShape) return;
    if (activeShape.type === 'pencil') {
      const last = activeShape.points[activeShape.points.length - 1];
      const dx = mapPx.x - last.x;
      const dy = mapPx.y - last.y;
      if (dx * dx + dy * dy > 0.25) activeShape.points.push(mapPx);
    } else {
      activeShape.b = mapPx;
    }
    render();
  }

  function onPointerUp(e) {
    if (!dragging) return;
    e.stopPropagation();
    dragging = false;
    try { canvasEl.releasePointerCapture(e.pointerId); } catch (_) {}

    if (tool === 'select') {
      dragMode = null;
      dragHandleRole = null;
      dragStartShapeSnapshot = null;
      render();
      return;
    }

    if (activeShape) {
      const shape = activeShape;
      activeShape = null;
      if (!(shape.type === 'pencil' && shape.points.length < 2)) {
        commitShape(snapShape(shape));
      }
    }
    render();
  }

  function onPointerCancel(e) {
    e.stopPropagation();
    cancelActiveDrawing();
    render();
  }

  function onDoubleClick(e) {
    if (tool !== 'select') return;
    e.stopPropagation();
    const view = MapApp.getViewState();
    const mapPx = MapApp.screenToMapPx(e.clientX, e.clientY);
    const idx = hitTestShapes(mapPx, view);
    if (idx >= 0 && shapes[idx].type === 'text') {
      selectShape(idx);
      editTextShape(shapes[idx]);
    }
  }

  function onKeyDown(e) {
    if (tool !== 'select' || selectedIndex < 0) return;
    const ae = document.activeElement;
    const tag = ae && ae.tagName ? ae.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || (ae && ae.isContentEditable)) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelected();
    }
  }

  function getSelectedFormat() {
    const checked = formatRadios.find((r) => r.checked);
    return checked ? checked.value : 'png';
  }

  function onCoordFormSubmit() {
    const x1 = parseFloat(coordX1.value);
    const z1 = parseFloat(coordZ1.value);
    if (!isFinite(x1) || !isFinite(z1)) return;
    const p1 = MapApp.logicalToMapPx(x1, z1);
    if (tool === 'text') {
      startTextInput(p1);
      return;
    }
    const x2 = parseFloat(coordX2.value);
    const z2 = parseFloat(coordZ2.value);
    if (!isFinite(x2) || !isFinite(z2)) return;
    const p2 = MapApp.logicalToMapPx(x2, z2);
    let shape = null;
    if (tool === 'line' || tool === 'arrow') {
      shape = { type: tool, a: p1, b: p2, strokeColor, strokeWidthMapPx };
    } else if (tool === 'rect' || tool === 'ellipse') {
      shape = { type: tool, a: p1, b: p2, strokeColor, strokeWidthMapPx, fillColor, fillOpacity };
    }
    if (shape) commitShape(snapShape(shape));
  }

  async function exportImage() {
    const format = getSelectedFormat();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const w = Math.round(vw * dpr);
    const h = Math.round(vh * dpr);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = false;
    if (typeof MapApp.renderBaseMapToCanvas === 'function') MapApp.renderBaseMapToCanvas(octx, w, h);
    if (linesCanvasEl) octx.drawImage(linesCanvasEl, 0, 0, w, h);
    octx.drawImage(canvasEl, 0, 0, w, h);

    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'png') {
      out.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mapa-kobywatel-${stamp}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }, 'image/png');
      return;
    }
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF) return;
    const pageFormat = pageFormatSelect ? pageFormatSelect.value : 'a4';
    const orientation = pageOrientationSelect ? pageOrientationSelect.value : 'landscape';
    const doc = new jsPDF({ orientation, unit: 'mm', format: pageFormat });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 10;
    const availW = pageW - margin * 2;
    const availH = pageH - margin * 2;
    const imgRatio = w / h;
    let drawW = availW;
    let drawH = drawW / imgRatio;
    if (drawH > availH) {
      drawH = availH;
      drawW = drawH * imgRatio;
    }
    const x = (pageW - drawW) / 2;
    const y = (pageH - drawH) / 2;
    doc.addImage(out.toDataURL('image/png'), 'PNG', x, y, drawW, drawH);
    doc.save(`mapa-kobywatel-${stamp}.pdf`);
  }

  // --- Wejście/wyjście trybu edytora, sterowane trzecim przyciskiem w #mode-toggle
  //     (Ogólne/Transport/Edytor), a nie osobnym przełącznikiem. map.js sam obsłuży
  //     kliknięcie (jego applyMode('editor') zachowa się jak nieszkodliwy fallback
  //     do 'general'); tu tylko chowamy punkty/legendę i otwieramy panel.

  function enterEditorMode() {
    if (toolbar) toolbar.hidden = false;
    if (markersLayer) markersLayer.style.display = 'none';
    if (filtersPanel) filtersPanel.style.display = 'none';
    setTool('pan');
  }

  function exitEditorMode() {
    if (toolbar) toolbar.hidden = true;
    if (markersLayer) markersLayer.style.display = '';
    if (filtersPanel) filtersPanel.style.display = '';
    setTool('pan');
  }

  function wireToolbar() {
    if (modeEditorBtn) modeEditorBtn.addEventListener('click', enterEditorMode);
    if (modeGeneralBtn) modeGeneralBtn.addEventListener('click', exitEditorMode);
    if (modeTransportBtn) modeTransportBtn.addEventListener('click', exitEditorMode);
    if (closeBtn) closeBtn.addEventListener('click', () => modeGeneralBtn?.click());

    toolButtons.forEach((btn) => btn.addEventListener('click', () => setTool(btn.dataset.tool)));

    if (strokeColorInput) {
      strokeColorInput.addEventListener('input', (e) => {
        strokeColor = e.target.value;
        if (tool === 'select' && selectedShape) {
          ensureStyleEditSnapshot();
          if (selectedShape.type === 'text') selectedShape.color = strokeColor;
          else selectedShape.strokeColor = strokeColor;
          render();
        }
      });
    }
    if (strokeWidthInput) {
      strokeWidthInput.addEventListener('input', (e) => {
        strokeWidthMapPx = Number(e.target.value);
        if (strokeWidthValueEl) strokeWidthValueEl.textContent = String(strokeWidthMapPx);
        if (tool === 'select' && selectedShape && selectedShape.type !== 'text') {
          ensureStyleEditSnapshot();
          selectedShape.strokeWidthMapPx = strokeWidthMapPx;
          render();
        }
      });
    }
    if (fillColorInput) {
      fillColorInput.addEventListener('input', (e) => {
        fillColor = e.target.value;
        if (tool === 'select' && selectedShape && (selectedShape.type === 'rect' || selectedShape.type === 'ellipse')) {
          ensureStyleEditSnapshot();
          selectedShape.fillColor = fillColor;
          render();
        }
      });
    }
    if (fillOpacityInput) {
      fillOpacityInput.addEventListener('input', (e) => {
        fillOpacity = Number(e.target.value);
        if (fillOpacityValueEl) fillOpacityValueEl.textContent = Math.round(fillOpacity * 100) + '%';
        if (tool === 'select' && selectedShape && (selectedShape.type === 'rect' || selectedShape.type === 'ellipse')) {
          ensureStyleEditSnapshot();
          selectedShape.fillOpacity = fillOpacity;
          render();
        }
      });
    }
    if (fontSizeInput) {
      fontSizeInput.addEventListener('input', (e) => {
        fontSizeMapPx = Number(e.target.value);
        if (fontSizeValueEl) fontSizeValueEl.textContent = String(fontSizeMapPx);
        if (tool === 'select' && selectedShape && selectedShape.type === 'text') {
          ensureStyleEditSnapshot();
          selectedShape.fontSizeMapPx = fontSizeMapPx;
          render();
        }
      });
    }

    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (shapes.length && window.confirm('Wyczyścić wszystkie adnotacje?')) clearAll();
      });
    }
    if (deleteSelectedBtn) deleteSelectedBtn.addEventListener('click', deleteSelected);

    formatRadios.forEach((r) =>
      r.addEventListener('change', () => {
        if (pdfOptions) pdfOptions.hidden = getSelectedFormat() !== 'pdf';
      })
    );

    if (coordAddBtn) coordAddBtn.addEventListener('click', onCoordFormSubmit);
    if (exportBtn) exportBtn.addEventListener('click', exportImage);

    canvasEl.addEventListener('pointerdown', onPointerDown);
    canvasEl.addEventListener('pointermove', onPointerMove);
    canvasEl.addEventListener('pointerup', onPointerUp);
    canvasEl.addEventListener('pointercancel', onPointerCancel);
    canvasEl.addEventListener('dblclick', onDoubleClick);
    window.addEventListener('keydown', onKeyDown);

    updateUndoRedoButtons();
  }

  function init() {
    wireToolbar();
    canvasEl.style.pointerEvents = 'none';
    MapApp.onTransform(render);
    window.addEventListener('resize', render);
    render();
  }

  init();
} else {
  console.warn('[map-screenshot] window.MapApp (rozszerzone o API edytora) niedostępne – edytor zrzutu ekranu wyłączony.');
}
