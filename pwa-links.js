(function(){
	function isStandalone(){
		return (window.navigator.standalone === true) || window.matchMedia('(display-mode: standalone)').matches;
	}

	function createBadge(labelVisible, labelSr){
		const badge = document.createElement('span');
		badge.className = 'ext-badge';
		const short = document.createElement('span');
		short.textContent = labelVisible;
		short.setAttribute('aria-hidden','true');
		const sr = document.createElement('span');
		sr.className = 'sr-only';
		sr.textContent = ` — ${labelSr}`;
		badge.appendChild(short);
		badge.appendChild(sr);
		return badge;
	}

	function applyBadges(){
		const inStandalone = isStandalone();
		const modeVis = inStandalone ? 'Otwierane w przeglądarce' : 'W nowej karcie';
		const modeSr = inStandalone ? 'Ten link otworzy się w przeglądarce.' : 'Ten link otworzy się w nowej karcie.';

			const ids = ['tile-wnioski', 'btn-kdonos', 'tile-kpack'];
		for (const id of ids){
			const a = document.getElementById(id);
			if (!a) continue;
				const existing = a.querySelector(':scope > .ext-badge');
			if (existing) existing.remove();
			const badge = createBadge(modeVis, modeSr);
				a.appendChild(badge);
		}
	}

	if (document.readyState === 'loading'){
		document.addEventListener('DOMContentLoaded', applyBadges);
	} else {
		applyBadges();
	}

	try{
		const mq = window.matchMedia('(display-mode: standalone)');
		if (mq && 'addEventListener' in mq){
			mq.addEventListener('change', applyBadges);
		} else if (mq && 'addListener' in mq) {
			mq.addListener(applyBadges);
		}
	}catch(_){/* no-op */}
})();

