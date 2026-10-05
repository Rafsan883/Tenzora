import { useEffect, useRef } from 'react';

export default function TurnstileChallenge({ onVerify }) {
  const container = useRef(null);
  useEffect(() => {
    const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    if (!sitekey) return;
    let active = true, widget;
    const render = () => {
      if (!active || !container.current || widget !== undefined) return;
      widget = window.turnstile.render(container.current, { sitekey, theme: 'dark', callback: onVerify, 'expired-callback': () => onVerify(''), 'error-callback': () => onVerify('') });
    };
    let script = document.getElementById('turnstile-api');
    if (window.turnstile) render();
    else {
      if (!script) {
        script = document.createElement('script');
        script.id = 'turnstile-api';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', render);
    }
    return () => {
      active = false;
      script?.removeEventListener('load', render);
      if (widget !== undefined) window.turnstile?.remove(widget);
    };
  }, [onVerify]);
  return <div ref={container} />;
}
