import React, { useState, useEffect, useRef, memo } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { optimizeImage } from "../../utils/image";
import { getWatchUrl } from "../../utils/url";
import { Mic, Plus } from "lucide-react";
import SaveAsPopOver from "./SaveAsPopOver";

const AnimeCard = memo(({ anime, variant = "" }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const cardRef = useRef(null);
  const { getTitle } = useLanguage();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "200px" } // Load slightly before entering viewport
    );

    const card = cardRef.current;
    if (card) observer.observe(card);
    return () => {
      observer.disconnect();
    };
  }, []);

  if (!anime) return null;

  const title = getTitle(anime.title);
  const format = (anime.format || "TV").toString().toUpperCase();
  const isAnixo = variant === "anixo";

  const episodeFields = anime.episodes && typeof anime.episodes === "object" ? anime.episodes : {};
  const totalEpisodes = anime.episodeCount
    ?? episodeFields.total
    ?? (typeof anime.episodes === "number" || typeof anime.episodes === "string" ? anime.episodes : null)
    ?? anime.nextAiringEpisode?.episode
    ?? null;
  const subtitleEpisodes = anime.subCount
    ?? anime.subEpisodes
    ?? episodeFields.sub
    ?? episodeFields.subbed
    ?? totalEpisodes;
  // AniList only exposes the total episode count for most cards. Use an
  // explicit dub count when available and keep the visual badge populated
  // with the total as the fallback used by the existing catalog data.
  const dubEpisodes = anime.dubCount
    ?? anime.dubEpisodes
    ?? episodeFields.dub
    ?? episodeFields.dubbed
    ?? totalEpisodes;
  
  // Format watch URL
  const queryParams = new URLSearchParams();
  if (anime.isMAL) queryParams.set("mal", "true");
  if (anime.isProgress) {
    queryParams.set("ep", anime.episode || 1);
    if (anime.currentTime) queryParams.set("t", anime.currentTime);
  }
  const queryString = queryParams.toString();
  const cardUrl = `${getWatchUrl(anime.id, anime.title)}${queryString ? `?${queryString}` : ""}`;

  // Hover Events for GlobalHoverManager
  let hoverTimeout;
  const handlePointerEnter = (e) => {
    // Completely disable hover card on touch/mobile devices
    if (e.pointerType && e.pointerType !== 'mouse') return;
    if (window.innerWidth < 768) return; // Strict guard for mobile screens
    if (window.matchMedia('(hover: none)').matches) return; // Fallback CSS check

    const rect = cardRef.current.getBoundingClientRect();
    hoverTimeout = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('show-anime-hover', { 
        detail: { anime, rect } 
      }));
    }, 400); // 400ms delay to prevent accidental hovers
  };

  const handlePointerLeave = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    clearTimeout(hoverTimeout);
    window.dispatchEvent(new CustomEvent('hide-anime-hover'));
  };

  return (
    <div 
      ref={cardRef} 
      className="group relative flex w-full flex-col font-mono"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {/* Poster Container */}
      <Link 
        to={cardUrl}
        className={`group/poster relative block aspect-[2/3] w-full cursor-pointer overflow-hidden border bg-[#07080c] transition-[transform,border-color,box-shadow] duration-300 ${isAnixo ? "border-white/[0.11] shadow-[0_14px_32px_rgba(0,0,0,0.38)] hover:-translate-y-1 hover:border-discord-400/70 hover:shadow-[0_16px_34px_rgba(88,101,242,0.2)]" : "rounded-[2px] border-transparent"}`}
      >
        {isVisible && !imgError ? (
          <img
            src={optimizeImage(anime.coverImage?.large || anime.coverImage?.extraLarge || anime.coverImage?.medium, 300)}
            alt={title}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover brightness-[0.92] saturate-[0.88] transition-[transform,filter] duration-500 ease-out group-hover/poster:scale-[1.06] group-hover/poster:brightness-105 group-hover/poster:saturate-100"
          />
        ) : (
          <div className="h-full w-full animate-shimmer bg-[#0b0c11]" />
        )}
        
        <div className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-t from-black/95 via-black/15 to-transparent opacity-85 transition-opacity duration-300 group-hover/poster:opacity-100" />
        <div className="pointer-events-none absolute inset-0 z-[6] border border-transparent transition-colors duration-300 group-hover/poster:border-discord-400/35" />

        {/* Format Tag (Top Left) */}
        <div className="absolute left-2 top-2 z-10 rounded-[2px] border border-white/20 bg-black/80 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.12em] text-white shadow-sm backdrop-blur-md">
          {format}
        </div>

        {isAnixo && (totalEpisodes || subtitleEpisodes || dubEpisodes) && (
          <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center gap-1 font-mono text-[9px] font-black uppercase tracking-[0.04em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            {subtitleEpisodes && (
              <span className="inline-flex items-center gap-1 rounded-[3px] border border-white/15 bg-black/75 px-1.5 py-0.5 text-white/90 backdrop-blur-sm">
                <span className="text-[8px] leading-none">cc</span>
                {subtitleEpisodes}
              </span>
            )}
            {dubEpisodes && (
              <span className="inline-flex items-center gap-1 rounded-[3px] border border-white/15 bg-black/75 px-1.5 py-0.5 text-white/90 backdrop-blur-sm">
                <Mic size={10} strokeWidth={2.5} aria-hidden="true" />
                {dubEpisodes}
              </span>
            )}
            {totalEpisodes && (
              <span className="inline-flex items-center rounded-[3px] border border-white/15 bg-black/75 px-1.5 py-0.5 text-white/90 backdrop-blur-sm">
                {totalEpisodes}
              </span>
            )}
          </div>
        )}
      </Link>

      {/* Quick Add Button (Top Right) - Extracted from Link to prevent navigation */}
      <div className="pointer-events-none absolute right-2 top-2 z-20 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 max-md:pointer-events-auto max-md:opacity-100">
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowSaveMenu(!showSaveMenu);
          }}
          className="flex h-7 w-7 items-center justify-center border border-white/20 bg-black/80 text-white shadow-[0_4px_14px_rgba(0,0,0,0.35)] backdrop-blur-md transition-all hover:border-discord-300 hover:bg-discord-600 hover:text-white"
        >
          <Plus size={14} strokeWidth={3} />
        </button>
        
        {/* Save As Menu Popover */}
        {showSaveMenu && (
          <SaveAsPopOver 
            animeId={anime.id}
            anime={anime}
            onClose={() => setShowSaveMenu(false)} 
          />
        )}
      </div>

      {/* Title Below Poster (Senpaiflix Style) */}
      <div className="mt-3 px-1 text-center">
        <Link to={cardUrl}>
          <h3 className={`line-clamp-2 text-center font-mono text-[11px] font-bold leading-[1.45] tracking-[0.015em] transition-colors md:text-xs ${isAnixo ? "text-white/90 group-hover:text-indigo-200" : "text-white group-hover:text-primary"}`}>
            {title}
          </h3>
        </Link>
      </div>
    </div>
  );
});

AnimeCard.displayName = "AnimeCard";
export default AnimeCard;
