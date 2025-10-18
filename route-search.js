// Wyszukiwanie tras dla trybu "Transport" w nowym bąbelku (wielowynikowe, styl ZTKweb)
// Funkcje: autouzupełnianie, wiele tras (alternatywy przez wykluczanie linii), priorytet (mniej przesiadek / mniej przystanków), filtr typów, podświetlanie.

let transportEnabled = false;
let pointsIndex = new Map(); // id -> point
let stationIds = []; // tylko stacje (kolej, metro)
let linesDataCache = null;
const stationsDatalist = document.getElementById('stations-list');

// Sekcje bąbelka
const routeSection = document.getElementById('route-search-section');
const pointSection = document.getElementById('point-search-section');

// Pola / UI
const inputFrom = document.getElementById('route-from');
const inputTo = document.getElementById('route-to');
const btnSwap = document.getElementById('route-swap');
const btnSearch = document.getElementById('route-search');
const btnClear = document.getElementById('route-clear');
const resultsEl = document.getElementById('route-results');
const filtersBox = document.getElementById('route-type-filters');
const typeFiltersSummary = document.getElementById('type-filters-summary');
const prioritySummary = document.getElementById('priority-summary');

function log(){/* silent */}

function updateTypeFiltersSummary(){
	if(!filtersBox || !typeFiltersSummary) return;
	const checked = [...filtersBox.querySelectorAll('input[type="checkbox"]')].filter(c=>c.checked).map(c=>c.dataset.type);
	typeFiltersSummary.textContent = checked.length === filtersBox.querySelectorAll('input[type="checkbox"]').length ? 'Wszystkie' : checked.join(', ');
}
function updatePrioritySummary(){
	if(!prioritySummary) return;
	const m = priorityMode();
	prioritySummary.textContent = m==='transfers' ? 'Mniej przesiadek' : 'Mniej przystanków';
}

function activeLineTypeFilters(){
	if(!filtersBox) return new Set(['IC','REGIO','METRO','ON','FLIGHT']);
	const set = new Set();
	filtersBox.querySelectorAll('input[type="checkbox"]').forEach(cb=>{ if(cb.checked) set.add(cb.dataset.type); });
	if(set.size===0){ const first=filtersBox.querySelector('input[type="checkbox"]'); if(first){ first.checked=true; set.add(first.dataset.type); } }
	return set;
}
function priorityMode(){
	const sel = document.querySelector('input[name="route-priority"]:checked');
	return sel ? sel.value : 'transfers';
}

async function ensureData(){
	if(linesDataCache && pointsIndex.size) return;
	try {
		// Wczytaj z repo db: meta + poszczególne pliki punktów oraz linie
		const metaObj = await window.__db.fetchJson('data/map-points/meta.json');
		const files = ['localities-large.json','localities-small.json','stations.json','infra.json','airports.json'];
		const parts = await Promise.all(files.map(fn=> window.__db.fetchJson('data/map-points/'+fn).catch(()=>({points:[]}))));
		const extra = parts.flatMap(p => Array.isArray(p?.points) ? p.points : []);
		const basePoints = Array.isArray(metaObj?.points) ? metaObj.points : [];
		const pointsJson = { points: [...basePoints, ...extra] };
		linesDataCache = await window.__db.fetchJson('data/map-lines.json');
		pointsIndex.clear();
		(pointsJson.points||[]).forEach(pt=> pointsIndex.set(pt.id, pt));
		// Traktuj jako stacje: kolej, metro oraz airport (lotniska)
		stationIds = (pointsJson.points||[]).filter(pt=> pt.category==='kolej' || pt.category==='metro' || pt.category==='airport').map(pt=> pt.id);
		buildDatalist();
	} catch(e){ log('Błąd danych tras', e); }
}

function buildDatalist(){
	if(!stationsDatalist) return;
	const items = stationIds.map(id=>({id,name:pointsIndex.get(id)?.name||id})).sort((a,b)=> a.name.localeCompare(b.name,'pl'));
	stationsDatalist.innerHTML = items.map(it=>`<option value="${it.name}"></option>`).join('');
}

function nameToId(str){
	if(!str) return null;
	str=String(str).trim();
	for(const id of stationIds){ const pt=pointsIndex.get(id); if(pt && pt.name.toLowerCase()===str.toLowerCase()) return id; }
	if(pointsIndex.has(str)) return str;
	return null;
}

function classifyLine(line){
	const cat = String(line.category||'').toUpperCase();
	if(cat.includes('IC')) return 'IC';
	if(cat.includes('METRO')) return 'METRO';
	if(cat.includes('ON')) return 'ON';
	if(cat.includes('BOAT') || cat.includes('SHIP') || cat.includes('STATEK') || cat.includes('PROM')) return 'BOAT';
	if(cat.includes('AIR') || cat.includes('FLIGHT') || cat.includes('LOT')) return 'FLIGHT';
	return 'REGIO';
}

function computeStationGraph(allowedTypes, excludedLines){
	const adj = new Map();
	function ensureNode(n){ if(!adj.has(n)) adj.set(n,[]); }
	function addUndirected(a,b,lineId){
		ensureNode(a); ensureNode(b);
		adj.get(a).push({to:b,lineId});
		adj.get(b).push({to:a,lineId});
	}
	function addDirected(a,b,lineId){
		ensureNode(a); ensureNode(b);
		adj.get(a).push({to:b,lineId});
	}
	function isBidirectional(line, type){
		const dir = (line && line.direction ? String(line.direction).toLowerCase() : '');
		const hasTwoWay = (line && (line.twoWay===true || line.bidirectional===true)) || dir==='both' || dir==='twoway' || dir==='bidirectional' || dir==='2way';
		const hasOneWay = (line && (line.oneWay===true || line.bidirectional===false)) || dir==='oneway' || dir==='one-way';
		if(type==='FLIGHT'){
			if(hasTwoWay) return true;
			if(hasOneWay) return false;
			return false; // domyślnie jednostronne dla lotów
		}
		if(hasOneWay) return false;
		return true; // domyślnie dwustronne dla pozostałych
	}
	for(const line of (linesDataCache?.lines||[])){
		if(!line?.stations || line.stations.length<2) continue;
		if(excludedLines && excludedLines.has(line.id)) continue;
		const type = classifyLine(line);
		if(!allowedTypes.has(type)) continue;
		const seq=line.stations;
		const bidir = isBidirectional(line, type);
		for(let i=0;i<seq.length-1;i++){
			const a=seq[i], b=seq[i+1];
			if(!pointsIndex.has(a) || !pointsIndex.has(b)) continue;
			if(bidir){ addUndirected(a,b,line.id); } else { addDirected(a,b,line.id); }
		}
	}
		// --- Intermodalne połączenia: AIRPORT ↔ KOL/Metro w pobliżu ---
		try {
			// Zbuduj listy punktów wg kategorii
			const airports = stationIds.filter(id=> pointsIndex.get(id)?.category==='airport');
			const rail = stationIds.filter(id=> {
				const c = pointsIndex.get(id)?.category; return c==='kolej' || c==='metro';
			});
			// Jeśli flight wyłączony, ale nadal chcemy umożliwić dotarcie do lotniska tylko gdy FLIGHT jest w allowedTypes, więc dodajemy XFER zawsze;
			// To tylko transfer naziemny (pieszo), nie wymaga kategorii linii.
			// Próg odległości: 220 (w jednostkach mapy – tu użyjemy dystansu euklidesowego na współrzędnych x,z/y)
			const MAX_DIST = 220;
			for(const aid of airports){
				const ap = pointsIndex.get(aid); if(!ap) continue;
				const ax = ap.x; const az = (ap.z!==undefined? ap.z: ap.y);
				for(const sid of rail){
					const st = pointsIndex.get(sid); if(!st) continue;
					const sx = st.x; const sz = (st.z!==undefined? st.z: st.y);
					const dx = (sx-ax); const dz = (sz-az); const d2 = dx*dx + dz*dz;
					if(d2 <= MAX_DIST*MAX_DIST){
						addUndirected(aid, sid, 'XFER');
					}
				}
			}
		} catch(_e){ /* ignore intermodal errors */ }
	return adj;
}

function runDijkstra(src,dst,allowedTypes,excludedLines){
	if(src===dst) return null;
	const adj = computeStationGraph(allowedTypes, excludedLines);
	if(!adj.has(src) || !adj.has(dst)) return null;
	const BIG=1000000; const mode=priorityMode();
	const weight = (tr,st)=> mode==='stops'? st*BIG+tr : tr*BIG+st;
	// Kolejka: [w, tr, st, node, prevKey, line, prevReal]
	const pq = [[weight(0,0),0,0,src,null,null,null]];
	const best=new Map(); const parent=new Map();
	const skey=(n,l,pr)=> n+'|'+(l||'')+'|'+(pr||''); let dstKey=null;
	while(pq.length){
		pq.sort((a,b)=>a[0]-b[0]);
		const [w,tr,st,node,prev,line,prevReal]=pq.shift();
		const k=skey(node,line,prevReal); if(best.has(k)&&best.get(k)<=w) continue;
		best.set(k,w); parent.set(k,{prev,node,line,tr,st,prevReal});
		if(node===dst){ dstKey=k; break; }
		for(const {to,lineId} of (adj.get(node)||[])){
			const isXfer = lineId==='XFER';
			const lastReal = (line && line!=='XFER') ? line : (prevReal||null);
			const nextReal = isXfer ? lastReal : lineId;
			const addTr = (!isXfer && lastReal && lastReal!==lineId) ? 1 : 0;
			const nw = weight(tr+addTr, st+1); const nk=skey(to,lineId,nextReal);
			if(!best.has(nk) || nw<best.get(nk)) pq.push([nw,tr+addTr,st+1,to,k,lineId,nextReal]);
		}
	}
	if(!dstKey) return null;
	// rekonstrukcja
	const path=[]; let cur=dstKey;
	while(cur){
		const info=parent.get(cur); if(!info) break;
		const pinfo = info.prev? parent.get(info.prev) : null;
		if(pinfo && info.line) path.push({from:pinfo.node,to:info.node,lineId:info.line});
		cur=info.prev;
	}
		path.reverse();
		if(!path.length) return null;
			// Zbuduj segmenty interleaved: RIDE (linia) i WALK (XFER)
		const segments=[]; let i=0;
		while(i<path.length){
			const step = path[i];
			if(step.lineId==='XFER'){
					let start = step.from; let end = step.to; let stepsWalk=1; let j=i+1;
					while(j<path.length && path[j].lineId==='XFER' && path[j-1].to===path[j].from){ end=path[j].to; stepsWalk++; j++; }
					// policz dystans euklidesowy po współrzędnych x,z (lub x,y) między start i end; 1 blok = 1 metr
					const pStart = pointsIndex.get(start); const pEnd = pointsIndex.get(end);
					let distM = 0;
					if(pStart && pEnd){
						const sx = pStart.x, sz = (pStart.z!==undefined? pStart.z : pStart.y);
						const ex = pEnd.x, ez = (pEnd.z!==undefined? pEnd.z : pEnd.y);
						const dx = ex - sx; const dz = ez - sz;
						distM = Math.round(Math.sqrt(dx*dx + dz*dz));
					}
					// czas w sekundach przy 4.3 m/s
					const timeSec = distM>0 ? Math.round(distM / 4.3) : 0;
					segments.push({ kind:'WALK', stations:[start,end], steps: stepsWalk, distanceM: distM, timeSec });
				i=j; continue;
			} else {
				const lineId = step.lineId; let stations=[step.from, step.to]; let j=i+1;
				while(j<path.length && path[j].lineId===lineId && path[j-1].to===path[j].from){ stations.push(path[j].to); j++; }
				segments.push({ kind:'RIDE', lineId, stations });
				i=j; continue;
			}
		}
		// Wyprowadź legs (RIDE) i walks (WALK)
		const rideSegments = segments.filter(s=> s.kind==='RIDE');
		if(!rideSegments.length) return null;
		const legs = rideSegments.map(s=> ({ lineId: s.lineId, stations: s.stations.slice() }));
			const walks = segments.filter(s=> s.kind==='WALK');
			const totalWalkSteps = walks.reduce((a,w)=> a + (w.steps||0), 0);
			const totalWalkMeters = walks.reduce((a,w)=> a + (w.distanceM||0), 0);
			const totalWalkTimeSec = walks.reduce((a,w)=> a + (w.timeSec||0), 0);
		// Przesiadki: zmiana realnej linii między sąsiednimi segmentami RIDE (ignorując WALK)
		let transfers = 0; let lastRide=null;
		for(const seg of segments){
			if(seg.kind==='RIDE'){
				if(lastRide && lastRide.lineId!==seg.lineId) transfers++;
				lastRide = seg;
			}
		}
		// Kroki tylko przejazdowe (bez XFER)
		const rideSteps = path.filter(s=> s.lineId!=='XFER');
			return { transfers, steps: rideSteps.length, legs, walks, totalWalkSteps, totalWalkMeters, totalWalkTimeSec, segments };
}

function generateRoutes(src,dst,allowedTypes){
	const routes=[]; const base = runDijkstra(src,dst,allowedTypes,null); if(!base) return routes;
	routes.push(base);
	// Alternatywy: wykluczaj pojedyncze linie z trasy bazowej
	const lineIdsBase = base.legs.map(l=>l.lineId);
	for(const ln of lineIdsBase){
		if(routes.length>=5) break;
		const alt = runDijkstra(src,dst,allowedTypes,new Set([ln]));
		if(alt && !isDuplicate(alt,routes)) routes.push(alt);
	}
	// Dodatkowa próba: jeśli priorytet 'transfers', sprawdź wariant 'stops' jako alternatywę (odwróć tryb chwilowo)
	if(priorityMode()==='transfers' && routes.length<5){
		const originalMode='transfers';
		// Tymczasowo zmień sposób wyliczania wagi: hack – wywołaj runDijkstra z globalnym przełączeniem? Prościej: policz drugi raz z reinterpretacją wag.
		// Implementacja uproszczona: nie zmieniamy globalnego priorytetu, bo wpływa na UI; alternatywę uznamy już wygenerowaną powyżej.
	}
	// Posortuj: wg (transfers, steps)
	routes.sort((a,b)=> a.transfers - b.transfers || a.steps - b.steps);
	return routes;
}

function isDuplicate(candidate, existing){
	return existing.some(r=> compareRoute(r,candidate));
}
function compareRoute(a,b){
	if(a.legs.length!==b.legs.length) return false;
	for(let i=0;i<a.legs.length;i++){
		const la=a.legs[i], lb=b.legs[i];
		if(la.lineId!==lb.lineId) return false;
		if(la.stations.length!==lb.stations.length) return false;
		for(let j=0;j<la.stations.length;j++) if(la.stations[j]!==lb.stations[j]) return false;
	}
	return true;
}

function lineColor(lineId){
	const line=(linesDataCache?.lines||[]).find(l=>l.id===lineId);
	if(!line) return '#888';
	const dark = document.body.classList.contains('light') ? false : (window.matchMedia('(prefers-color-scheme: dark)').matches && !document.body.classList.contains('light'));
	return dark ? (line.colorDark||line.color||'#888') : (line.colorLight||line.color||'#555');
}

function fmtName(id){ return pointsIndex.get(id)?.name || id; }

function renderResults(routes){
	if(!resultsEl) return;
	if(!routes.length){ resultsEl.innerHTML='<div class="empty">Brak połączenia.</div>'; return; }
	const start = routes[0].legs[0].stations[0];
	const end = routes[0].legs[routes[0].legs.length-1].stations.slice(-1)[0];
	const html = routes.map((r,i)=> itineraryCard(r,i,start,end)).join('');
	resultsEl.innerHTML = html;
	// Zaznacz pierwszy
	const first = resultsEl.querySelector('.itinerary');
	if(first){ first.classList.add('selected'); highlightRoute(routes[0]); }
}

function itineraryCard(route,index,start,end){
    const anyFees = (route.legs||[]).some(leg => lineHasFees(leg.lineId));
    const feesHtml = anyFees ? ` • <span class=\"fees-flag\" title=\"Na tej trasie występują opłaty\">Opłaty</span>` : '';
	const walkHtml = (route.totalWalkMeters>0) ? ` • <span class=\"walk-flag\" title=\"Przejścia piesze\"><img src=\"/icns_transit/walk.svg\" alt=\"walk\" style=\"width:14px;height:14px;vertical-align:middle;margin-right:4px\"/>Pieszo: ${route.totalWalkMeters} m</span>` : '';
	return `<div class="itinerary" tabindex="0" role="listitem" data-index="${index}">
		<div class="itinerary-header">
			<div class="title">${fmtName(start)} → ${fmtName(end)}</div>
			<div class="itinerary-meta">Przystanki: ${route.steps} • Przesiadki: ${route.transfers} • Linie: ${route.legs.length}${feesHtml}${walkHtml}</div>
		</div>
		<div class="timeline">${renderTimelineInterleaved(route)}</div>
	</div>`;
}

function stripLineId(id){ return id?.startsWith('ln-') ? id.slice(3) : id; }

function lineTypeBadge(lineId){
	const line = (linesDataCache?.lines||[]).find(l=> l.id===lineId);
	if(!line) return '';
	const t = classifyLine(line); // IC / METRO / ON / REGIO
	const map = { IC:'IC', METRO:'M', ON:'NŻ', REGIO:'R' };
	return map[t] || t;
}

function lineTypeIconPath(type){
	switch(type){
		case 'IC': return '/icns_transit/ic.svg';
		case 'METRO': return '/icns_transit/metro.svg';
		case 'ON': return '/icns_transit/on_demand.svg';
		case 'BOAT': return '/icns_transit/boat.svg';
		case 'FLIGHT': return '/icns_transit/flight.svg';
		case 'REGIO': return '/icns_transit/regio.svg';
		default: return '/icns_transit/regio.svg';
	}
}

function lineHasFees(lineId){
	const line = (linesDataCache?.lines||[]).find(l=> l.id===lineId);
	if(!line) return false;
	const f = line.fees;
	if(f === true) return true;
	if(typeof f === 'number') return f > 0;
	if(typeof f === 'string') return f.trim().length > 0;
	if(Array.isArray(f)) return f.length > 0;
	if(f && typeof f === 'object') return Object.keys(f).length > 0;
	return false;
}

function renderLeg(leg, idx){
	const color = lineColor(leg.lineId);
	const lineObj = (linesDataCache?.lines||[]).find(l=> l.id===leg.lineId);
	const type = classifyLine(lineObj||{});
	const icon = lineTypeIconPath(type);
	const lineLabel = `${stripLineId(leg.lineId)}: ${fmtName(leg.stations[0])} – ${fmtName(leg.stations[leg.stations.length-1])}`;
	const intermediateStations = leg.stations.slice(1,-1);
	const stationsHtml = intermediateStations.map(s=> `<span class="station">${fmtName(s)}</span>`).join('');
	const title = `${leg.stations.map(s=> fmtName(s)).join(' → ')}`;
	const feesIcon = lineHasFees(leg.lineId) ? `<span class=\"leg-fees\" title=\"Opłaty wymagane\" aria-label=\"Opłaty\">💰</span>` : '';
	// kapsułka opłat (mała) pod ikoną dla lotów
	let feesCapsule = '';
	if(type==='FLIGHT' && lineObj && lineHasFees(leg.lineId)){
		const feeText = typeof lineObj.fees==='string' ? lineObj.fees : (typeof lineObj.fees==='number' ? `${lineObj.fees}` : 'Opłata');
		feesCapsule = `<div class=\"flight-fee-chip\" title=\"Opłata za lot\" style=\"position:absolute;left:50%;transform:translate(-50%, 22px);white-space:nowrap;background:rgba(0,0,0,.7);border:1px solid rgba(255,255,255,.18);color:#fff;padding:.1rem .35rem;border-radius:10px;font-size:.5rem;line-height:1;box-shadow:0 2px 6px -2px rgba(0,0,0,.6);\">${feeText}</div>`;
	}
	return `<div class="timeline-leg" style="--leg-color:${color};--route-color:${color}" data-line-id="${leg.lineId}" data-leg-index="${idx}" title="${title}">
		<span class="leg-mode-icon"><img src="${icon}" alt="${type}" loading="lazy" />${feesCapsule}</span>
		<div class="leg-pill" style="--pill-color:${color}">
			<span class="pill-dot" style="background:${color}"></span>
			<span class="leg-line-label">${lineLabel}</span>${feesIcon}
		</div>
		${type==='FLIGHT' ? '' : `<div class="leg-meta" data-leg-index="${idx}" data-collapsed="true">
			<span class="stations-count">Stacje: ${leg.stations.length-1}</span>
			<button class="toggle-leg" aria-expanded="false" aria-label="Pokaż stacje" data-leg-index="${idx}">▾</button>
		</div>`}
		<div class="leg-stations-box" data-leg-index="${idx}" hidden>${stationsHtml}</div>
	</div>`;
}

function renderTimelineInterleaved(route){
	// Jeśli są segmenty, renderuj RIDE i WALK naprzemiennie; w przeciwnym razie fallback do nóg
	const segs = route.segments && Array.isArray(route.segments) && route.segments.length ? route.segments : null;
	const parts=[];
	if(segs){
		if(!segs.length) return '';
		// start node
		const startStation = segs[0].stations[0];
		parts.push(`<div class="timeline-node start" data-station="${startStation}"><span class="node-icon" data-icon="S"></span><span class="node-label">${fmtName(startStation)}</span></div>`);
		for(let i=0;i<segs.length;i++){
			const seg = segs[i];
			if(seg.kind==='RIDE'){
				parts.push(renderLeg({lineId:seg.lineId, stations:seg.stations}, i));
			} else if(seg.kind==='WALK'){
				parts.push(renderWalkSegment(seg, i));
			}
			if(i<segs.length-1){
				const nextStart = segs[i+1].stations[0];
				parts.push(`<div class="timeline-node transfer" data-station="${nextStart}"><span class="node-icon" data-icon="T"></span><span class="node-label">${fmtName(nextStart)}</span></div>`);
			} else {
				const endStation = seg.stations[seg.stations.length-1];
				parts.push(`<div class="timeline-node end" data-station="${endStation}"><span class="node-icon" data-icon="E"></span><span class="node-label">${fmtName(endStation)}</span></div>`);
			}
		}
		return parts.join('');
	}
	// fallback – stary rendering
	for(let i=0;i<route.legs.length;i++){
		const leg = route.legs[i];
		if(i===0){
			parts.push(`<div class="timeline-node start" data-station="${leg.stations[0]}"><span class="node-icon" data-icon="S"></span><span class="node-label">${fmtName(leg.stations[0])}</span></div>`);
		} else {
			parts.push(`<div class="timeline-node transfer" data-station="${leg.stations[0]}"><span class="node-icon" data-icon="T"></span><span class="node-label">${fmtName(leg.stations[0])}</span></div>`);
		}
		parts.push(renderLeg(leg,i));
		if(i === route.legs.length-1){
			const endStation = leg.stations[leg.stations.length-1];
			parts.push(`<div class="timeline-node end" data-station="${endStation}"><span class="node-icon" data-icon="E"></span><span class="node-label">${fmtName(endStation)}</span></div>`);
		}
	}
	return parts.join('');
}

function renderWalkSegment(seg, idx){
	const icon = '/icns_transit/walk.svg';
	const color = '#888';
	const title = `Przejście: ${fmtName(seg.stations[0])} → ${fmtName(seg.stations[seg.stations.length-1])} • ${seg.distanceM||0} m`;
	return `<div class="timeline-leg walk" style="--leg-color:${color};--route-color:${color}" data-walk-index="${idx}" title="${title}">
		<span class="leg-mode-icon"><img src="${icon}" alt="walk" loading="lazy" /></span>
		<div class="leg-pill" style="--pill-color:${color}">
			<span class="pill-dot" style="background:${color}"></span>
			<span class="leg-line-label">Przejście: ${seg.distanceM||0} m</span>
		</div>
	</div>`;
}

function formatDuration(totalSec){
	const s = Math.max(0, Math.round(totalSec));
	if(s < 60) return `${s}s`;
	const m = Math.floor(s/60); const rs = s%60;
	if(m < 60) return rs ? `${m}m ${rs}s` : `${m}m`;
	const h = Math.floor(m/60); const rm = m%60;
	return rm ? `${h}h ${rm}m` : `${h}h`;
}

function highlightRoute(route){
	const legs = route?.legs || [];
	window.dispatchEvent(new CustomEvent('route:highlight', { detail:{ legs } }));
}

async function performSearch(){
	await ensureData();
	updateTypeFiltersSummary(); updatePrioritySummary();
	const src = nameToId(inputFrom?.value); const dst = nameToId(inputTo?.value);
	if(!src || !dst){ resultsEl.innerHTML='<div class="empty">Wybierz poprawne stacje.</div>'; window.dispatchEvent(new CustomEvent('route:highlight',{detail:{legs:[]}})); return; }
	const allowed = activeLineTypeFilters();
	const routes = generateRoutes(src,dst,allowed);
	renderResults(routes);
}

function clearSearch(){
	if(inputFrom) inputFrom.value=''; if(inputTo) inputTo.value='';
	resultsEl.innerHTML='';
	window.dispatchEvent(new CustomEvent('route:highlight',{detail:{legs:[]}}));
}
function swapInputs(){ if(!inputFrom||!inputTo) return; const a=inputFrom.value; inputFrom.value=inputTo.value; inputTo.value=a; }

function attachEvents(){
	btnSearch?.addEventListener('click', performSearch);
	btnClear?.addEventListener('click', clearSearch);
	btnSwap?.addEventListener('click', ()=>{ swapInputs(); performSearch(); });
	[inputFrom,inputTo].forEach(inp=> inp?.addEventListener('keydown', e=>{ if(e.key==='Enter') performSearch(); }));
	filtersBox?.querySelectorAll('input[type="checkbox"]').forEach(cb=> cb.addEventListener('change', ()=>{ updateTypeFiltersSummary(); performSearch(); }));
	document.querySelectorAll('input[name="route-priority"]').forEach(r=> r.addEventListener('change', ()=>{ updatePrioritySummary(); performSearch(); }));
	resultsEl?.addEventListener('click', e=>{
		const card = e.target.closest('.itinerary'); if(!card) return;
		resultsEl.querySelectorAll('.itinerary').forEach(c=> c.classList.remove('selected'));
		card.classList.add('selected');
		const idx = parseInt(card.dataset.index,10);
		const src = nameToId(inputFrom?.value); const dst = nameToId(inputTo?.value);
		if(!src||!dst) return;
		const routes = generateRoutes(src,dst,activeLineTypeFilters());
		if(routes[idx]) highlightRoute(routes[idx]);
		// toggle stacji
		if(e.target.classList.contains('toggle-leg')){
			const legIndex = parseInt(e.target.getAttribute('data-leg-index'),10);
			const box = card.querySelector(`.leg-stations-box[data-leg-index="${legIndex}"]`);
			const meta = card.querySelector(`.leg-meta[data-leg-index="${legIndex}"]`);
			if(box && meta){
				const collapsed = meta.getAttribute('data-collapsed') === 'true';
				if(collapsed){
					box.hidden = false; meta.setAttribute('data-collapsed','false'); e.target.setAttribute('aria-expanded','true');
				} else {
					box.hidden = true; meta.setAttribute('data-collapsed','true'); e.target.setAttribute('aria-expanded','false');
				}
			}
		}
	});
}
attachEvents();

// Integracja z map.js
window.TransportMode = {
	enable: async () => {
		transportEnabled = true;
		if(pointSection) pointSection.hidden = true;
		if(routeSection) routeSection.hidden = false;
		await ensureData();
		updateTypeFiltersSummary(); updatePrioritySummary();
	},
	disable: () => {
		transportEnabled = false;
		clearSearch();
		if(routeSection) routeSection.hidden = true;
		if(pointSection) pointSection.hidden = false;
	}
};

// Re-render kolorów po zmianie motywu
window.addEventListener('theme-change', ()=>{ if(transportEnabled && !routeSection?.hidden){ performSearch(); } });

// Odbiór syntetycznego wyboru końcówek trasy (klik w legendzie linii)
window.addEventListener('route:selectEndpoints', async (e)=>{
	try {
		await ensureData();
		const startId = e.detail?.startId || null;
		const endId = e.detail?.endId || null;
		const preferLineId = e.detail?.preferLineId || null;
		if(!startId || !endId){
			// Wyczyść jeśli null-e
			clearSearch();
			return;
		}
		const startName = pointsIndex.get(startId)?.name || startId;
		const endName = pointsIndex.get(endId)?.name || endId;
		if(inputFrom) inputFrom.value = startName;
		if(inputTo) inputTo.value = endName;
		// Uruchom wyszukiwanie
		await performSearch();
		// Jeśli podano preferowaną linię – zaznacz w wynikach trasę, która jej używa
		if(preferLineId && resultsEl){
			const src = nameToId(inputFrom?.value); const dst = nameToId(inputTo?.value);
			if(src && dst){
				const routes = generateRoutes(src,dst,activeLineTypeFilters());
				const idx = routes.findIndex(r=> (r.legs||[]).some(l=> l.lineId===preferLineId));
				if(idx>=0){
					// Podmień zaznaczenie karty i highlight
					resultsEl.querySelectorAll('.itinerary').forEach(c=> c.classList.remove('selected'));
					const card = resultsEl.querySelector(`.itinerary[data-index="${idx}"]`);
					if(card){ card.classList.add('selected'); }
					highlightRoute(routes[idx]);
				}
			}
		}
	} catch(_){ /* ignore */ }
});

