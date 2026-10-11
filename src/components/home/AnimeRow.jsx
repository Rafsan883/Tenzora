import { useRef, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import AnimeCard from "../common/AnimeCard";
import SkeletonCard from "../common/SkeletonCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function AnimeRow({ 
  title, 
  subtitle, 
  data, 
  isLoading, 
  isFetching = false, 
  limit = 6, 
  tabs = [], 
  activeTab = "", 
  onTabChange, 
  onRemove, 
  isScrollable = false, 
  viewAllLink = "", 
  CardComponent = AnimeCard, 
  cardVariant = "",
  headerAction,
  emptyMessage
}) {
  const Card = CardComponent;
  const hasData = data && data.length > 0;
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isScrollable) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [isScrollable, data, checkScroll]);

  const scroll = (direction) => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
  };

  return (
    <section className={`mx-auto mt-0 w-full overflow-hidden font-sans ${cardVariant === "anixo" ? "border border-white/[0.08] bg-white/[0.014] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.16)] md:p-5" : "px-4 md:px-8"}`}>
      {/* Header Area */}
      <div className={`mb-5 flex flex-row items-center justify-between gap-2 border-b pb-4 ${cardVariant === "anixo" ? "border-white/[0.08]" : "border-transparent md:mb-6"}`}>
        
        <div className="flex flex-col items-start gap-1">
          {subtitle && (
            <p className="font-senpai text-[10px] font-bold uppercase tracking-[0.2em] text-discord-400 md:text-xs">{subtitle}</p>
          )}
          <div className="flex items-center gap-2 md:gap-3">
            {cardVariant === "anixo" && <span className="h-5 w-1 shrink-0 bg-discord-500" />}
            <h2 className="text-lg font-black uppercase leading-none tracking-tight text-white sm:text-xl md:text-2xl">
              {title}
            </h2>
            {headerAction}
          </div>
        </div>

        <div className="flex flex-row items-center gap-3 md:gap-4 shrink-0">
          {/* Tabs */}
          {tabs && tabs.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto border border-white/[0.08] bg-black/30 p-1 scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => onTabChange?.(tab)}
                    className={`whitespace-nowrap px-3 py-1 font-senpai text-[10px] font-bold uppercase tracking-wider transition-colors md:px-4 md:py-1.5 md:text-xs ${
                      activeTab === tab
                        ? "bg-white text-black"
                        : "text-textMuted hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          {/* View All Link — visible on ALL breakpoints */}
          {viewAllLink && (
            <Link
              to={viewAllLink}
              className="flex items-center gap-1 whitespace-nowrap font-senpai text-[10px] font-bold uppercase tracking-widest text-textMuted transition-colors duration-200 hover:text-discord-300 md:text-xs"
            >
              View All <ChevronRight size={12} className="opacity-60" />
            </Link>
          )}

          {/* Scroll Navigation Controls (Desktop only) */}
          {isScrollable && (
            <div className="hidden md:flex items-center gap-1">
              <button
                onClick={() => scroll("left")}
                disabled={!canScrollLeft}
                  className={`flex h-8 w-8 items-center justify-center border transition-all duration-200 ${
                    canScrollLeft 
                      ? "cursor-pointer border-white/20 bg-white/[0.05] text-white hover:border-discord-400" 
                      : "cursor-not-allowed border-white/[0.08] bg-white/[0.02] text-textMuted opacity-50"
                }`}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => scroll("right")}
                disabled={!canScrollRight}
                  className={`flex h-8 w-8 items-center justify-center border transition-all duration-200 ${
                    canScrollRight 
                      ? "cursor-pointer border-white/20 bg-white/[0.05] text-white hover:border-discord-400" 
                      : "cursor-not-allowed border-white/[0.08] bg-white/[0.02] text-textMuted opacity-50"
                }`}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid container or Scrollable Flexbox */}
      <div className="relative group/row w-full">
        {isFetching && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg/40 backdrop-blur-sm transition-all duration-300 rounded">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin shadow-xl"></div>
          </div>
        )}
        
        {/* Left Scroll Overlay Arrow (Desktop Hover) */}
        {isScrollable && canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="hidden md:flex absolute left-0 top-0 bottom-4 z-40 w-16 items-center justify-center bg-gradient-to-r from-bg via-bg/80 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
          >
            <div className="bg-bg/80 backdrop-blur-md p-2 rounded-full border border-white/10 text-white shadow-xl hover:scale-110 transition-transform">
              <ChevronLeft size={24} />
            </div>
          </button>
        )}

        {/* Right Scroll Overlay Arrow (Desktop Hover) */}
        {isScrollable && canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="hidden md:flex absolute right-0 top-0 bottom-4 z-40 w-16 items-center justify-center bg-gradient-to-l from-bg via-bg/80 to-transparent opacity-0 group-hover/row:opacity-100 transition-opacity duration-300"
          >
            <div className="bg-bg/80 backdrop-blur-md p-2 rounded-full border border-white/10 text-white shadow-xl hover:scale-110 transition-transform">
              <ChevronRight size={24} />
            </div>
          </button>
        )}

        {/* --- SCROLLABLE ROW (Watch History / Continue Watching) --- */}
        {isScrollable ? (
          <div
            ref={scrollRef}
            className="flex min-h-[100px] w-full flex-nowrap gap-3 overflow-x-auto pb-6 scrollbar-hide md:gap-5"
          >
            {isLoading ? (
              Array.from({ length: limit }).map((_, i) => (
                <div key={i} className="w-[140px] md:w-[180px] shrink-0">
                  <SkeletonCard />
                </div>
              ))
            ) : hasData ? (
              data.slice(0, data.length).map((anime, i) => (
                <div key={`${anime.id}-${i}`} className="relative group/card shrink-0 w-[140px] md:w-[180px]">
                  <Card anime={anime} variant={cardVariant} />
                  {onRemove && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemove(anime.id);
                      }}
                      className="absolute left-2 top-2 z-30 border border-white/10 bg-black/80 p-1.5 text-white opacity-100 shadow-2xl backdrop-blur-md transition-all duration-300 hover:bg-black hover:text-red-400 md:opacity-0 md:group-hover/card:opacity-100"
                      title="Remove from history"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v6M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-full flex w-full flex-col items-center justify-center py-12 font-senpai text-textMuted">
                <p className="border border-white/10 px-6 py-2 text-center text-xs font-bold uppercase leading-relaxed tracking-widest">
                  {emptyMessage || "No Data Available"}
                </p>
              </div>
            )}
          </div>
        ) : (
          /* --- NON-SCROLLABLE ROW (Newest, Popular, Top Rated) --- */
          <div
            className="flex min-h-[100px] w-full snap-x snap-mandatory flex-nowrap gap-3 overflow-x-auto pb-4 scrollbar-hide md:grid md:grid-cols-4 md:gap-x-3 md:gap-y-8 md:overflow-visible md:pb-0 md:snap-none lg:grid-cols-6 xl:grid-cols-8"
          >
            {isLoading ? (
              Array.from({ length: limit }).map((_, i) => (
                <div key={i} className="w-[130px] shrink-0 snap-start md:w-auto md:shrink md:snap-align-none">
                  <SkeletonCard />
                </div>
              ))
            ) : hasData ? (
              data.slice(0, limit).map((anime, i) => (
                <div key={`${anime.id}-${i}`} className="relative group/card shrink-0 w-[130px] snap-start md:w-auto md:shrink md:snap-align-none">
                  <Card anime={anime} variant={cardVariant} />
                </div>
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center py-12 font-senpai text-textMuted">
                <p className="border border-white/10 px-6 py-2 text-center text-xs font-bold uppercase leading-relaxed tracking-widest">
                  {emptyMessage || "No Data Available"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
