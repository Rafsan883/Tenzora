import { useEffect, useState } from 'react';
import { Share, X } from 'lucide-react';
import './InstallPWABanner.css';

const DISMISSAL_KEY = 'tenzora_pwa_install_banner_dismissed';

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;

  return window.matchMedia?.('(display-mode: standalone), (display-mode: window-controls-overlay)').matches ||
    window.navigator.standalone === true;
}

function isIOSDevice() {
  if (typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent || '';
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;

  return /iPad|iPhone|iPod/.test(userAgent) || isIPadOS;
}

function wasDismissed() {
  try {
    return window.localStorage.getItem(DISMISSAL_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function InstallPWABanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [installed, setInstalled] = useState(isStandaloneMode);
  const [iosHelpVisible, setIosHelpVisible] = useState(false);
  const iosDevice = isIOSDevice();
  const showIOSInstructions = iosDevice && !deferredPrompt;

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    const handleDisplayModeChange = () => {
      setInstalled(isStandaloneMode());
    };

    const displayModeQuery = window.matchMedia?.('(display-mode: standalone), (display-mode: window-controls-overlay)');

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (displayModeQuery?.addEventListener) {
      displayModeQuery.addEventListener('change', handleDisplayModeChange);
    } else if (displayModeQuery?.addListener) {
      displayModeQuery.addListener(handleDisplayModeChange);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);

      if (displayModeQuery?.removeEventListener) {
        displayModeQuery.removeEventListener('change', handleDisplayModeChange);
      } else if (displayModeQuery?.removeListener) {
        displayModeQuery.removeListener(handleDisplayModeChange);
      }
    };
  }, []);

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISSAL_KEY, 'true');
    } catch {
      // The banner can still be dismissed when storage is unavailable.
    }

    setDismissed(true);
  };

  const handleInstall = async () => {
    if (showIOSInstructions) {
      setIosHelpVisible(true);
      return;
    }

    if (!deferredPrompt) return;

    const promptEvent = deferredPrompt;
    setDeferredPrompt(null);

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;

      if (choice?.outcome === 'accepted') {
        setInstalled(true);
      }
    } catch {
      // The prompt may expire before the user interacts with the banner.
    }
  };

  const shouldShow = !dismissed && !installed && (iosDevice || deferredPrompt);

  if (!shouldShow) return null;

  return (
    <aside className="tenzora-pwa-banner" aria-label="Tenzora PWA installation">
      <img className="tenzora-pwa-banner__icon" src="/Favicon-512.png" width="25" height="25" alt="Tenzora" />

      <div className="tenzora-pwa-banner__content">
        <strong className="tenzora-pwa-banner__title">Tenzora PWA available</strong>
        {showIOSInstructions && (
          <span id="tenzora-pwa-ios-help" className="tenzora-pwa-banner__message" aria-live="polite">
            {iosHelpVisible ? (
              <>In Safari, tap Share <Share size={14} aria-hidden="true" />, choose Add to Home Screen, then tap Add.</>
            ) : (
              <>Tap Share <Share size={14} aria-hidden="true" /> → Add to Home Screen to install Tenzora.</>
            )}
          </span>
        )}
      </div>

      <button
        type="button"
        className="tenzora-pwa-banner__install"
        onClick={handleInstall}
        aria-label={showIOSInstructions ? 'Install PWA — show iOS instructions' : 'Install PWA'}
        aria-describedby={showIOSInstructions ? 'tenzora-pwa-ios-help' : undefined}
      >
        Install PWA
      </button>

      <button
        type="button"
        className="tenzora-pwa-banner__close"
        onClick={handleDismiss}
        aria-label="Dismiss Tenzora PWA installation banner"
      >
        <X size={17} aria-hidden="true" />
      </button>
    </aside>
  );
}
