import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ArrowUpRight, Play, Calendar, ListVideo, Star } from "lucide-react";
import AnimeCard from "../common/AnimeCard";
import { getTopMovies } from "../../services/api";
import { optimizeImage } from "../../utils/image";
import { useLanguage } from "../../context/LanguageContext";
import { getWatchUrl } from "../../utils/url";
import { useState } from "react";

function TopMoviesCard({ anime }) {
  const [imgError, setImgError] = useState(false);
  const { getTitle } = useLanguage();
  
  return (
    <Link
      to={getWatchUrl(anime?.id, anime?.title)}
      className="group flex min-w-0 items-center gap-4 overflow-hidden border border-white/[0.08] bg-white/[0.018] p-2.5 transition-all duration-300 hover:border-discord-400/50 hover:bg-discord-500/[0.06]"
    >
      {/* Poster */}
      <div className="relative h-[84px] w-[60px] shrink-0 overflow-hidden border border-white/[0.08] bg-[#090a0e]">
        {!imgError ? (
          <img
            src={optimizeImage(anime?.coverImage?.large, 200)}
            alt={getTitle(anime?.title)}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="h-full w-full bg-[#090a0e]" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="truncate text-[13px] font-bold leading-snug text-white transition-colors group-hover:text-discord-300">
          {getTitle(anime?.title)}
        </h4>
        
        <div className="mt-1.5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-wide text-white/45">
          <span className="border border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-white">MOVIE</span>
          <span className="flex items-center gap-1">
            <Calendar size={12} className="text-white/40" />
            {anime?.seasonYear || "TBA"}
          </span>
          <span className="flex items-center gap-1 text-yellow-500">
            <Star size={12} className="fill-current" />
            {anime?.averageScore || "NR"}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function TopMovies() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["topMovies"],
    queryFn: async () => {
      const res = await getTopMovies();
      return res;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  return (
    <div className="flex flex-col min-w-0 overflow-hidden">
      <div className="mb-5 flex items-center justify-between border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-5 w-1 bg-discord-500" />
          <h2 className="text-lg font-black uppercase leading-tight tracking-tight text-white">
            TOP MOVIES
          </h2>
        </div>
        <span
          onClick={() => navigate("/browse?format=MOVIE")}
          className="flex h-7 w-7 cursor-pointer items-center justify-center border border-discord-400/40 bg-discord-600 text-white transition-colors hover:bg-discord-500"
        >
          <ArrowUpRight size={14} />
        </span>
      </div>

      {/* MOBILE: Horizontal Scroll */}
      <div className="flex min-h-[100px] snap-x snap-mandatory flex-nowrap gap-3 overflow-x-auto pb-4 scrollbar-hide md:hidden">
        {isLoading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-[200px] w-[140px] shrink-0 snap-start animate-pulse border border-white/[0.06] bg-white/[0.04]" />
          ))
        ) : error || !data?.media ? (
          <div className="text-red-400 text-sm py-4 w-full">Failed to load top movies.</div>
        ) : (
          data.media.slice(0, 10).map((anime) => (
            <div key={anime?.id} className="w-[140px] shrink-0 snap-start">
              <AnimeCard anime={anime} variant="anixo" />
            </div>
          ))
        )}
      </div>

      {/* DESKTOP: Vertical List */}
      <div className="hidden flex-col gap-2 md:flex">
        {isLoading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-[84px] animate-pulse border border-white/[0.06] bg-white/[0.04]" />
          ))
        ) : error || !data?.media ? (
          <div className="text-red-400 text-sm py-4">Failed to load top movies.</div>
        ) : (
          data.media.slice(0, 10).map((anime) => (
            <TopMoviesCard key={anime?.id} anime={anime} />
          ))
        )}
      </div>
    </div>
  );
}
