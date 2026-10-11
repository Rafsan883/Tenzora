import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { Play, Pause, Bookmark, ChevronLeft, ChevronRight, Info, VolumeX, Volume2 } from "lucide-react";
import { addToWatchlist } from '../../services/watchlistService';
import { animeIdentity } from '../../utils/animeIdentity';
import { useAuth } from "../../hooks/useAuth";
import LoginModal from "../auth/LoginModal";
import { optimizeImage } from "../../utils/image";
import { getWatchUrl } from "../../utils/url";
import { fetchAnimeLogo } from "../../services/api";
import { useLanguage } from "../../context/LanguageContext";
import { useRef } from "react";

const HeroTrailer = ({ trailerId, isMuted, onPlay, onPause, onEnded, onError, activePlayerRef, ytReady }) => {
  const playerRef = useRef(null);
  const latest = useRef({ isMuted, onPlay, onPause, onEnded, onError });
  useEffect(() => { latest.current = { isMuted, onPlay, onPause, onEnded, onError }; }, [isMuted, onPlay, onPause, onEnded, onError]);

  useEffect(() => {
    if (!ytReady || !window.YT || !window.YT.Player) return;

    const playerId = `youtube-player-${trailerId}`;
    
    playerRef.current = new window.YT.Player(playerId, {
      height: '100%',
      width: '100%',
      videoId: trailerId,
      playerVars: {
        autoplay: 1,
        mute: latest.current.isMuted ? 1 : 0,
        controls: 0,
        showinfo: 0,
        rel: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        disablekb: 1,
        loop: 1,
        playlist: trailerId,
        origin: typeof window !== 'undefined' ? window.location.origin : ''
      },
      events: {
        onReady: (event) => {
          if (activePlayerRef) {
            activePlayerRef.current = event.target;
          }
          if (!latest.current.isMuted && typeof event.target.setVolume === 'function') {
            event.target.setVolume(100);
          }
        },
          onStateChange: (event) => {
            if (event.data === 1) { // YT.PlayerState.PLAYING
            latest.current.onPlay?.();
          } else if (event.data === 2) { // YT.PlayerState.PAUSED
            latest.current.onPause?.();
          } else if (event.data === 0) { // YT.PlayerState.ENDED
            latest.current.onEnded?.();
          }
        },
        onError: () => {
          latest.current.onError?.();
        }
      }
    });

    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy();
      }
      if (activePlayerRef?.current === playerRef.current) activePlayerRef.current = null;
    };
  }, [trailerId, ytReady, activePlayerRef]);

  return (
    <div className="pointer-events-none absolute inset-0">
      <div id={`youtube-player-${trailerId}`} className="absolute left-1/2 top-1/2 h-[300vh] w-[300vw] -translate-x-1/2 -translate-y-1/2 scale-[1.02] opacity-60 md:h-[150vh] md:w-[150vw]" />
    </div>
  );
};

export default function Hero({ data = [], isLoading }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const muteBtnRef = useRef(null);
  const [videoState, setVideoState] = useState({});
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [logos, setLogos] = useState({});
  const requestedLogos = useRef(new Set());
  const [ytReady, setYtReady] = useState(() => Boolean(window.YT?.Player));
  const activePlayerRef = useRef(null);

  // Bind native event listener to the mute button to bypass React's synthetic event
  // and preserve browser's user-gesture token for autoplay policies.
  // Also bypasses YouTube widgetapi.js entirely by sending raw postMessage.
  useEffect(() => {
    const btn = muteBtnRef.current;
    if (!btn) return;

    const handleMuteToggle = () => {
      const player = activePlayerRef.current;
      if (!player) return;
      
      const iframe = typeof player.getIframe === 'function' ? player.getIframe() : null;
      if (!iframe || !iframe.contentWindow) return;

      const newMuted = !isMuted;
      
      if (!newMuted) {

        iframe.contentWindow.postMessage('{"event":"command","func":"unMute","args":[]}', '*');
        iframe.contentWindow.postMessage('{"event":"command","func":"setVolume","args":[100]}', '*');
        iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":[]}', '*');
        setIsMuted(false);
      } else {

        iframe.contentWindow.postMessage('{"event":"command","func":"mute","args":[]}', '*');
        setIsMuted(true);
      }
    };

    btn.addEventListener('click', handleMuteToggle);
    return () => btn.removeEventListener('click', handleMuteToggle);
  }, [currentIndex, isMuted]);

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      return;
    }

    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      if (firstScriptTag) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.head.appendChild(tag);
      }
    }

    window.onYouTubeIframeAPIReady = () => {
      setYtReady(true);
    };
  }, []);
  const { user, triggerAuthToast, setGlobalWatchlist } = useAuth();
  const { language } = useLanguage();
  const lang = language === "JP" ? "ja" : "en";

  const displayData = useMemo(() => data?.slice(0, 10) || [], [data]);
  const timerRef = useRef(null);

  const advanceSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % displayData.length);
  }, [displayData.length]);

  const startFallbackTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(advanceSlide, 8000);
  }, [advanceSlide]);

  useEffect(() => {
    if (displayData.length === 0) return;
    
    // Initial start
    startFallbackTimer();
    
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, displayData.length, startFallbackTimer]);

  const handlePlay = (id) => {
    setVideoState(prev => ({ ...prev, [id]: 'playing' }));
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePause = (id) => {
    setVideoState(prev => ({ ...prev, [id]: 'paused' }));
  };

  const handleToggleTrailer = (id) => {
    const player = activePlayerRef.current;
    if (!player) return;

    const isPlaying = typeof player.getPlayerState === 'function' && player.getPlayerState() === 1;
    if (isPlaying) {
      player.pauseVideo?.();
      handlePause(id);
    } else {
      player.playVideo?.();
      handlePlay(id);
    }
  };

  useEffect(() => {
    // Fetch logos for all hero items
    displayData.forEach(async (anime) => {
      // Create a unique key for the state to force update if language changes
      const logoKey = `${anime.id}_${lang}`;
      if (!requestedLogos.current.has(logoKey)) {
        requestedLogos.current.add(logoKey);
        const title = lang === "ja" ? (anime.title?.romaji || anime.title?.native) : (anime.title?.english || anime.title?.romaji);
        const logo = await fetchAnimeLogo(anime.id, title, lang);
        if (logo) {
          setLogos(prev => ({ ...prev, [logoKey]: logo }));
        }
      }
    });
  }, [displayData, lang]);

  if (isLoading || displayData.length === 0) {
    return (
      <div className="relative h-[520px] w-full animate-pulse overflow-hidden border-b border-white/[0.08] bg-[#050609] md:h-[680px]">
        <div className="absolute inset-0 bg-white/[0.025]" />
      </div>
    );
  }

  const handleWatchLater = async (anime) => {
    if (!user) {
      triggerAuthToast("Sign in to manage your watchlist");
      setShowLoginModal(true);
      return;
    }
    const result = await addToWatchlist(anime.id, anime.title?.english || anime.title?.romaji, anime.coverImage?.large, 'Planning', 0, 0, animeIdentity(anime));
    if (result.success) setGlobalWatchlist(result.watchlist);
    triggerAuthToast(result.success ? 'Added to watchlist' : result.message, result.success ? 'success' : 'error');
  };

  return (
    <div className="group relative h-[550px] w-full select-none overflow-hidden border-b border-white/[0.1] bg-[#050609] font-mono md:h-[680px]">
      {displayData.map((anime, i) => {
        const isFirst = i === 0;
        const isActive = i === currentIndex;
        
        const title = lang === "ja" ? (anime.title?.romaji || anime.title?.native) : (anime.title?.english || anime.title?.romaji);
        const watchUrl = getWatchUrl(anime.id, anime.title);
        const logoKey = `${anime.id}_${lang}`;

        return (
          <div
            key={anime.id}
            className={`absolute inset-0 transition-opacity duration-[1200ms] ease-in-out ${isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}
          >
            {/* Cinematic Blurred Background or Trailer */}
            <div className="absolute inset-0 overflow-hidden bg-[#050609]">
              <img
                src={optimizeImage(anime.bannerImage || anime.coverImage?.extraLarge, 1920)}
                alt={title}
                fetchPriority={isFirst ? "high" : "auto"}
                loading={isFirst ? "eager" : "lazy"}
                decoding="async"
                onError={(e) => {
                  if (!e || (!e.target && !e.currentTarget)) return;
                  const target = e.currentTarget || e.target;
                  const fallback = anime.coverImage?.extraLarge;
                  if (fallback && target.src !== fallback) {
                    target.src = fallback;
                  }
                }}
                className={`pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_20%] brightness-[0.72] saturate-[0.86] transition-[opacity,filter] duration-1000 md:object-center ${isActive && anime.trailer?.site === "youtube" && ['playing', 'paused'].includes(videoState[anime.id]) ? 'opacity-0' : 'opacity-75'}`}
              />
              {isActive && anime.trailer?.site === "youtube" && videoState[anime.id] !== 'error' && (
                <HeroTrailer 
                  trailerId={anime.trailer.id} 
                  isMuted={isMuted} 
                  activePlayerRef={activePlayerRef}
                  ytReady={ytReady}
                  onPlay={() => handlePlay(anime.id)}
                  onPause={() => handlePause(anime.id)}
                  onEnded={advanceSlide}
                  onError={() => setVideoState(prev => ({ ...prev, [anime.id]: 'error' }))}
                />
              )}
              {/* Layered cinematic fades preserve contrast over poster art and video. */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_35%,transparent_0%,rgba(5,5,9,0.12)_42%,rgba(5,5,9,0.72)_100%)]" />
              <div className="pointer-events-none absolute bottom-0 left-0 h-[72%] w-full bg-gradient-to-t from-[#050609] via-[#050609]/82 to-transparent" />
              <div className="pointer-events-none absolute left-0 top-0 h-full w-[94%] bg-gradient-to-r from-[#050609]/[0.98] via-[#050609]/60 to-transparent md:w-[70%]" />
            </div>

            {/* Content Container */}
            <div className="container pointer-events-none relative z-20 mx-auto flex h-full max-w-[1720px] flex-col justify-end px-6 pb-20 md:justify-center md:px-12 md:pb-0">
              <div className={`pointer-events-auto flex w-full flex-col items-start text-left transition-all duration-700 delay-100 md:max-w-[800px] ${isActive ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
                
                {/* Featured Spotlight Tag */}
                <div className="mb-4">
                  <span className="border border-discord-400/45 bg-black/35 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-indigo-100 shadow-[0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur-md">
                    Featured Spotlight
                  </span>
                </div>

                {/* Anime Title or Logo */}
                {logos[logoKey] ? (
                  <img 
                    src={logos[logoKey]} 
                    alt={title} 
                    className="mb-6 max-h-[140px] w-auto object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.9)] md:max-h-[180px]"
                    loading="lazy"
                  />
                ) : (
                  <h2 className="mb-4 line-clamp-2 text-3xl font-black leading-[0.98] tracking-[-0.055em] text-white drop-shadow-[0_8px_24px_rgba(0,0,0,0.95)] md:text-5xl lg:text-7xl">
                    {title}
                  </h2>
                )}

                {/* Meta Information (Senpaiflix Monospace) */}
                <div className="mb-6 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-textMuted">
                  <span className="bg-white px-1.5 py-0.5 text-black">HD</span>
                  <span className="border border-white/20 px-2 py-0.5">{anime.format || "TV"}</span>
                  <span className="border border-emerald-400/30 px-2 py-0.5 text-emerald-300">{anime.status || "UNKNOWN"}</span>
                  <span>{anime.seasonYear || "?"}</span>
                  {anime.episodes && (
                    <>
                      <span className="h-1 w-1 bg-white/25" />
                      <span>{anime.episodes} EPS</span>
                    </>
                  )}
                </div>

                {/* Synopsis */}
                <p className="mb-8 max-w-[600px] line-clamp-3 text-sm leading-relaxed tracking-[0.01em] text-white/70 md:text-base">
                  {anime.description?.replace(/<[^>]*>?/gm, '') || "No description available."}
                </p>

                {/* Call to Action Buttons */}
                <div className="relative z-30 flex w-full items-center gap-3 md:w-auto md:gap-4">
                  <Link 
                    to={watchUrl} 
                    className="flex items-center justify-center gap-2 border border-discord-400 bg-discord-500 px-7 py-3 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-black"
                  >
                    <Play size={18} fill="currentColor" />
                    Watch Now
                  </Link>

                  <Link 
                    to={`/anime/${anime.id}`}
                    className="flex items-center justify-center gap-2 border border-white/20 bg-white/[0.08] px-7 py-3 text-sm font-bold uppercase tracking-widest text-white backdrop-blur-sm transition-colors hover:bg-white/[0.18]"
                  >
                    <Info size={18} />
                    Details
                  </Link>
                  <button aria-label="Watch later" onClick={() => handleWatchLater(anime)} className="border border-white/20 bg-white/[0.08] p-3 text-white backdrop-blur-sm transition-colors hover:bg-white/[0.18]"><Bookmark size={18} /></button>
                </div>
              </div>

              {/* Trailer controls stay outside the iframe so sound and playback remain user-controllable. */}
              <div className="pointer-events-auto absolute bottom-20 right-6 z-30 flex items-center gap-2 md:bottom-32 md:right-12">
                <button
                  onClick={() => handleToggleTrailer(anime.id)}
                  aria-label={videoState[anime.id] === 'playing' ? "Pause trailer" : "Play trailer"}
                  className="flex h-10 w-10 items-center justify-center border border-white/30 bg-black/45 text-white backdrop-blur-md transition-all hover:border-discord-300 hover:bg-discord-600/80"
                >
                  {videoState[anime.id] === 'playing' ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
                </button>
                <button
                  ref={isActive ? muteBtnRef : null}
                  aria-label={isMuted ? "Turn trailer sound on" : "Mute trailer"}
                  className="flex h-10 w-10 items-center justify-center border border-white/30 bg-black/45 text-white backdrop-blur-md transition-all hover:border-discord-300 hover:bg-discord-600/80"
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Horizontal Slider Pagination Dots */}
      <div className="absolute bottom-6 left-0 right-0 z-50 flex items-center justify-center gap-2">
        {displayData.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={`transition-all duration-300 ${
              currentIndex === i ? "w-6 h-1.5 bg-primary" : "w-1.5 h-1.5 bg-white/40 hover:bg-white/60"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Navigation Arrows */}
      <button 
        onClick={() => setCurrentIndex((prev) => (prev === 0 ? displayData.length - 1 : prev - 1))}
        className="absolute left-4 top-1/2 z-40 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-white/15 bg-black/55 text-white backdrop-blur-md transition-all hover:border-discord-300 hover:bg-discord-600/80 md:left-8 md:h-12 md:w-12"
        aria-label="Previous Slide"
      >
        <ChevronLeft size={24} />
      </button>

      <button 
        onClick={() => setCurrentIndex((prev) => (prev === displayData.length - 1 ? 0 : prev + 1))}
        className="absolute right-4 top-1/2 z-40 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-white/15 bg-black/55 text-white backdrop-blur-md transition-all hover:border-discord-300 hover:bg-discord-600/80 md:right-8 md:h-12 md:w-12"
        aria-label="Next Slide"
      >
        <ChevronRight size={24} />
      </button>

      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
}
