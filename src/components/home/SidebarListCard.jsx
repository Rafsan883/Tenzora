import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { optimizeImage } from "../../utils/image";
import { getWatchUrl } from "../../utils/url";
import { Calendar, MessageSquare, Star } from "lucide-react";

export default function SidebarListCard({ anime }) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef(null);
  const [imgError, setImgError] = useState(false);
  const { getTitle } = useLanguage();

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
  }, []);

  if (!anime) return null;

  return (
    <Link
      to={getWatchUrl(anime.id, anime.title)}
      ref={cardRef}
      className={`group flex min-w-0 items-center gap-4 overflow-hidden border border-white/[0.08] bg-white/[0.018] p-2.5 transition-all duration-300 hover:border-discord-400/50 hover:bg-discord-500/[0.06] ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Poster */}
      <div className="relative h-[84px] w-[60px] shrink-0 overflow-hidden border border-white/[0.08] bg-[#090a0e]">
        {isVisible && !imgError ? (
          <img
            src={optimizeImage(anime.coverImage?.large, 200)}
            alt={getTitle(anime.title)}
            loading="lazy"
            onError={() => setImgError(true)}
            onLoad={(e) => e.target.classList.remove("opacity-0")}
            className="w-full h-full object-cover opacity-0 transition-[opacity,transform] duration-700 ease-out group-hover:scale-110"
          />
        ) : !isVisible ? (
          <div className="h-full w-full animate-pulse bg-[#090a0e]" />
        ) : (
          <div className="h-full w-full bg-[#090a0e]" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1.5 min-w-0">
           <div className="mt-[7px] h-1.5 w-1.5 shrink-0 bg-discord-500" />
           <h4 className="truncate text-[13px] font-bold leading-snug text-white transition-colors group-hover:text-discord-300">
            {getTitle(anime.title)}
          </h4>
        </div>
        
        <div className="mt-1.5 flex items-center gap-3 pl-3 text-[10px] font-bold uppercase tracking-wide text-white/45">
          <span>{anime.format || "TV"}</span>
          <span className="flex items-center gap-1">
            <Calendar size={12} className="text-white/40" />
            {anime.seasonYear || anime.startDate?.year || "2026"}
          </span>
          {anime.episodes && (
             <span className="flex items-center gap-1">
               <svg className="w-3.5 h-3.5 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                 <rect x="2" y="2" width="20" height="15" rx="2" ry="2" />
                 <path d="M17 2v15" />
                 <path d="M7 2v15" />
                 <path d="M2 7h20" />
                 <path d="M2 12h20" />
                 <path d="M8 22h8" />
                 <path d="M12 17v5" />
               </svg>
               {anime.episodes}
             </span>
          )}
        </div>
      </div>
    </Link>
  );
}
