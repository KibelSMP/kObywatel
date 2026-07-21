'use client';

// Embeds a Tally.so form. Loads the Tally widget script once and wires up the
// iframe (same bootstrap the legacy pages inlined). The iframe is sandboxed to
// the minimum the form needs (scripts, forms, same-origin for its own storage,
// popups for the post-submit redirect).

import { useEffect, useRef } from 'react';

export default function TallyEmbed({ src, title, height = 300 }) {
  const ref = useRef(null);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;

    const load = () => {
      if (typeof window.Tally !== 'undefined') {
        window.Tally.loadEmbeds();
      } else if (!iframe.getAttribute('src')) {
        iframe.setAttribute('src', iframe.dataset.tallySrc);
      }
    };

    const SCRIPT = 'https://tally.so/widgets/embed.js';
    if (typeof window.Tally !== 'undefined') {
      load();
    } else if (!document.querySelector(`script[src="${SCRIPT}"]`)) {
      const s = document.createElement('script');
      s.src = SCRIPT;
      s.onload = load;
      s.onerror = load;
      document.body.appendChild(s);
    } else {
      load();
    }
  }, []);

  return (
    <iframe
      ref={ref}
      data-tally-src={src}
      loading="lazy"
      width="100%"
      height={height}
      frameBorder="0"
      marginHeight="0"
      marginWidth="0"
      title={title}
      sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
      className="w-full rounded-3xl"
    />
  );
}
