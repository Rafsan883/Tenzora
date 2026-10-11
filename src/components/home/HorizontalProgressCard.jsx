import { useState, useEffect, useRef } from "react";
import { useLanguage } from "../../context/LanguageContext";
import { Link } from "react-router-dom";
import { optimizeImage } from "../../utils/image";
import { getWatchUrl } from "../../utils/url";
import { getAnimeDetails } from "../../services/api";

export default function HorizontalProgressCard({ anime: progressItem }) {
  const [animeData, setAnimeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef(null);
  const [imgError, setImgError] = useState(false);
  const { getTitle } = useLanguage();

  useEffect(() => {
    let active = true;
    async function fetchData() {
      try {
        let data;
        if (progressItem.anilistId) {
          data = await getAnimeDetails(progressItem.anilistId);
        } else if (progressItem.id || progressItem.animeId) {
          const id = progressItem.id || progressItem.animeId;
          const isNumeric = !isNaN(Number(id));
          data = await getAnimeDetails(progressItem.isMAL ? progressItem.idMal || String(id).replace(/^mal:/, '') : id, progressItem.isMAL || !isNumeric);
        }
        if (active) setAnimeData(data);
      } catch (err) {
        console.error('Failed to fetch anime details for progress:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchData();
    return () => { active = false; };
  }, [progressItem.id, progressItem.animeId, progressItem.anilistId, progressItem.isMAL, progressItem.idMal]);

  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(node);
        }
      },
      { rootMargin: "100px" }
    );
    
    observer.observe(node);
    
    return () => {
      observer.unobserve(node);
    };
  }, [loading]);

  if (loading) {
    return (
      <div className="w-full flex flex-col pointer-events-none">
        <div className="relative w-full aspect-[16/9] rounded-[6px] overflow-hidden bg-[#2a2a2a] animate-shimmer shadow-lg" />
        <div className="w-full mt-3 px-1 space-y-2">
          <div className="h-[14px] bg-[#2a2a2a] rounded-[4px] animate-shimmer w-full" />
        </div>
      </div>
    );
  }

  // Resolve image URL from multiple possible shapes (object or string)
  const resolveImage = (img) => {
    if (!img) return null;
    if (typeof img === 'string') return img;
    return img.extraLarge || img.large || img.medium || null;
  };

  const fallbackCover = resolveImage(progressItem.coverImage) || resolveImage(progressItem.image) || progressItem.poster || '/fallback-image.png';

  const anime = {
    ...(animeData || {
      id: String(progressItem.id || progressItem.animeId).replace(/^mal:/, ''),
      isMAL: progressItem.isMAL || String(progressItem.animeId).startsWith('mal:'),
      idMal: progressItem.idMal,
      title: progressItem.title || { english: progressItem.title },
      coverImage: { large: fallbackCover, extraLarge: fallbackCover },
      bannerImage: progressItem.bannerImage,
    }),
    episode: progressItem.episode,
    currentTime: progressItem.currentTime,
    duration: progressItem.duration,
    isProgress: true,
  };

  const queryParams = new URLSearchParams();
  if (anime.isMAL) queryParams.set("mal", "true");
  queryParams.set("ep", anime.episode || 1);
  if (anime.currentTime) queryParams.set("t", anime.currentTime);
  
  const queryString = queryParams.toString();
  const baseUrl = getWatchUrl(anime.id, anime.title);
  const cardUrl = `${baseUrl}${queryString ? `?${queryString}` : ""}`;

  const formatTime = (timeInSeconds) => {
    if (!timeInSeconds) return "00:00";
    const m = Math.floor(timeInSeconds / 60);
    const s = Math.floor(timeInSeconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Link
      to={cardUrl}
      ref={cardRef}
      className={`group flex w-full cursor-pointer flex-col border border-white/[0.08] bg-black/20 pb-2 no-underline shadow-[0_14px_32px_rgba(0,0,0,0.2)] transition-[opacity,transform,border-color] duration-500 ease-out will-change-[opacity,transform] hover:border-discord-400/60 hover:bg-white/[0.025] ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
      style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
      draggable={false}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-white/[0.08] bg-[#090a0e]">
        {isVisible && !imgError ? (
          <img
            src={optimizeImage(anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large, 600)}
            alt={getTitle(anime.title)}
            loading="lazy"
            onError={() => setImgError(true)}
            onLoad={(e) => e.target.classList.remove("opacity-0")}
            className="h-full w-full object-cover opacity-0 transition-[opacity,transform] duration-700 ease-out group-hover:scale-105"
          />
        ) : !isVisible ? (
          <div className="w-full h-full bg-[#111] animate-pulse" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#111] text-white/10 p-4">
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Missing Cover</span>
          </div>
        )}

        {/* EP Badge - Bottom Left */}
        <div className="absolute bottom-1.5 left-1.5 z-40 flex items-center justify-center border border-white/15 bg-black/80 px-2 py-0.5 text-[11px] font-black tracking-widest text-white shadow-lg backdrop-blur-sm">
          EP {anime.episode || "1"}
        </div>

        {/* Duration - Bottom Right */}
        <div className="absolute bottom-1.5 right-1.5 z-40 flex items-center justify-center border border-white/15 bg-black/80 px-2 py-0.5 text-[10px] font-bold tracking-widest text-white shadow-lg backdrop-blur-sm">
          {formatTime(anime.currentTime)}<span className="text-white/50 mx-0.5">/</span>{formatTime(anime.duration || 1440)}
        </div>

        {/* Glowing Timeline Bar */}
        <div className="absolute bottom-0 left-0 w-full z-50 h-[3px] bg-white/20">
          <div 
            className="h-full bg-discord-500 shadow-[0_0_14px_rgba(88,101,242,0.8)] transition-all duration-500 ease-out" 
            style={{ 
              width: `${anime.duration ? Math.min(100, (anime.currentTime / anime.duration) * 100) : Math.min(100, (anime.currentTime / 1440) * 100)}%` 
            }}
          />
        </div>

        {/* Hover Play Icon Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-40 pointer-events-none">
          <div className="text-white scale-75 group-hover:scale-100 transition-transform duration-500 drop-shadow-2xl">
            <svg className="w-14 h-14" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="mt-2.5 w-full px-2">
        <h3 className="line-clamp-1 text-[13px] font-bold leading-snug text-white/90 transition-colors group-hover:text-discord-300">
          {getTitle(anime.title)}
        </h3>
      </div>
    </Link>
  );
}
