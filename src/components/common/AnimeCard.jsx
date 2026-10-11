import React, { useState, useEffect, useRef, memo } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { optimizeImage } from "../../utils/image";
import { getWatchUrl } from "../../utils/url";
import { Plus } from "lucide-react";
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
  const format = anime.format || "TV";
  const isAnixo = variant === "anixo";
  
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
      className="group relative flex w-full flex-col"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {/* Poster Container */}
      <Link 
        to={cardUrl}
        className={`group/poster relative block aspect-[2/3] w-full cursor-pointer overflow-hidden border bg-[#090a0e] transition-all duration-300 ${isAnixo ? "border-white/[0.1] shadow-[0_14px_32px_rgba(0,0,0,0.28)] hover:-translate-y-1 hover:border-discord-400/70 hover:shadow-[0_18px_38px_rgba(88,101,242,0.18)]" : "rounded-md border-transparent"}`}
      >
        {isVisible && !imgError ? (
          <img
            src={optimizeImage(anime.coverImage?.large || anime.coverImage?.extraLarge || anime.coverImage?.medium, 300)}
            alt={title}
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover/poster:scale-110"
          />
        ) : (
          <div className="w-full h-full animate-shimmer" />
        )}
        
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-1/2 bg-gradient-to-t from-black/90 via-black/35 to-transparent opacity-90" />

        {/* Format Tag (Top Left) */}
        <div className={`absolute left-2 top-2 z-10 border border-white/15 bg-black/75 px-1.5 py-0.5 font-senpai text-[9px] font-black uppercase text-white shadow-sm backdrop-blur-md ${isAnixo ? "tracking-[0.14em]" : "rounded"}`}>
          {format}
        </div>

        {isAnixo && (
          <div className="absolute bottom-2 left-2 right-2 z-10 flex items-end justify-between gap-2 text-[9px] font-black uppercase tracking-[0.12em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            <span className="line-clamp-1">{title}</span>
            {anime.averageScore ? <span className="shrink-0 text-indigo-200">★ {anime.averageScore}</span> : null}
          </div>
        )}
      </Link>

      {/* Quick Add Button (Top Right) - Extracted from Link to prevent navigation */}
      <div className="absolute top-2 right-2 z-20">
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowSaveMenu(!showSaveMenu);
          }}
          className="flex h-7 w-7 items-center justify-center border border-white/15 bg-black/75 text-white shadow-sm backdrop-blur-md transition-all hover:border-discord-400 hover:bg-discord-600 hover:text-white"
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
      <div className="mt-2 text-left">
        <Link to={cardUrl}>
          <h3 className={`line-clamp-2 font-senpai text-xs font-bold leading-snug transition-colors ${isAnixo ? "text-white/90 group-hover:text-indigo-300" : "text-white group-hover:text-primary"}`}>
            {title}
          </h3>
        </Link>
      </div>
    </div>
  );
});

AnimeCard.displayName = "AnimeCard";
export default AnimeCard;
