import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", 
  "Horror", "Mahou Shoujo", "Mecha", "Music", "Mystery", 
  "Psychological", "Romance", "Sci-Fi", "Slice of Life", 
  "Sports", "Supernatural", "Thriller"
];

export default function GenreNav() {
  const scrollRef = useRef(null);
  const navigate = useNavigate();

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === "left" ? -300 : 300;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  return (
    <div className="group relative w-full border-y border-white/[0.08] bg-[#08090d]/90 py-3 backdrop-blur-xl">
      <div className="max-w-[1720px] mx-auto px-4 relative flex items-center">
        {/* Left Button */}
        <button 
          onClick={() => scroll("left")}
           className="absolute left-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center bg-gradient-to-r from-[#08090d] via-[#08090d] to-transparent text-white/50 transition-opacity hover:text-white md:opacity-0 md:group-hover:opacity-100"
        >
          <ChevronLeft size={20} />
        </button>

        {/* Scrollable Container */}
        <div 
          ref={scrollRef}
           className="flex flex-1 items-center gap-3 overflow-x-auto px-6 scrollbar-hide md:gap-6"
        >
          {GENRES.map(genre => (
            <button
              onClick={() => navigate(`/browse?genre=${genre}`)}
              className="flex-shrink-0 border border-white/[0.1] bg-white/[0.035] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white/55 transition-colors duration-150 hover:border-discord-400/60 hover:bg-discord-600 hover:text-white"
            >
              {genre}
            </button>
          ))}
        </div>

        {/* Right Button */}
        <button 
          onClick={() => scroll("right")}
           className="absolute right-0 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center bg-gradient-to-l from-[#08090d] via-[#08090d] to-transparent text-white/50 transition-opacity hover:text-white md:opacity-0 md:group-hover:opacity-100"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
