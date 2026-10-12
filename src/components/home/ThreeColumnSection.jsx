import { useState } from "react";
import { Tv, Star, ArrowUpRight } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getMostViewedAnime } from "../../services/api";
import { getWatchUrl } from "../../utils/url";
import AnimeCard from "../common/AnimeCard";

/* ── Skeleton Loaders ── */
function SkeletonListItem() {
  return (
    <div className="flex items-center gap-4 border-b border-white/[0.08] px-2 py-2.5 last:border-0">
      <div className="h-[84px] w-[60px] shrink-0 animate-pulse border border-white/[0.08] bg-[#101117]" />
      <div className="flex-1 space-y-3">
        <div className="h-3.5 w-full animate-pulse bg-[#101117]" />
        <div className="flex gap-2">
          <div className="h-2.5 w-8 animate-pulse bg-[#101117]" />
          <div className="h-2.5 w-12 animate-pulse bg-[#101117]" />
        </div>
      </div>
    </div>
  );
}

function SkeletonRankedItem({ featured }) {
  if (featured) {
    return (
      <div className="mb-4 relative rounded-xl overflow-hidden aspect-[16/9] w-full bg-[#1a1a1a] animate-pulse" />
    );
  }
  return (
    <div className="flex items-center gap-4 border-b border-white/[0.08] px-2 py-2.5 last:border-0">
      <div className="h-8 w-8 shrink-0 animate-pulse border border-white/[0.08] bg-[#101117]" />
      <div className="h-[84px] w-[60px] shrink-0 animate-pulse border border-white/[0.08] bg-[#101117]" />
      <div className="flex-1 space-y-3">
        <div className="h-3.5 w-3/4 animate-pulse bg-[#101117]" />
        <div className="flex gap-2">
          <div className="h-2.5 w-10 animate-pulse bg-[#101117]" />
          <div className="h-2.5 w-8 animate-pulse bg-[#101117]" />
        </div>
      </div>
    </div>
  );
}

/* ── Small list item (used in New Releases & Just Completed) ── */
function ListItem({ anime }) {
  const { t } = useTranslation();
  const { getTitle } = useLanguage();
  const navigate = useNavigate();
  return (
    <div
      className="group -mx-2 flex cursor-pointer items-center gap-4 border-b border-white/[0.08] px-2 py-2.5 transition-all duration-300 last:border-0 hover:border-discord-500/30 hover:bg-discord-500/[0.04]"
      onClick={() => navigate(getWatchUrl(anime.id, anime.title))}
    >
      <div className="relative shrink-0 overflow-hidden border border-white/[0.08] shadow-md transition-all duration-300 group-hover:border-discord-400/50">
        <img
          src={anime.coverImage?.extraLarge || anime.coverImage?.large}
          alt={getTitle(anime.title)}
          loading="lazy"
          onLoad={(e) => e.target.classList.remove("opacity-0")}
          className="w-[60px] h-[84px] object-cover opacity-0 transition-transform duration-500 group-hover:scale-110 bg-[#1a1a1a]"
          style={{ imageRendering: 'auto' }}
        />
        <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300" />
      </div>
      <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-bold leading-snug text-[#e5e5e5] transition-colors group-hover:text-discord-300">
          {getTitle(anime.title)}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className="border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/60">
            {anime.format || "TV"}
          </span>
          {anime.averageScore && (
            <span className="flex items-center gap-1 border border-yellow-500/20 bg-yellow-500/10 px-1.5 py-0.5 text-[9px] font-bold text-yellow-500">
              <Star size={9} fill="currentColor" /> {anime.averageScore}%
            </span>
          )}
          {anime.status === "NOT_YET_RELEASED" ? (
            <span className="border border-discord-500/20 bg-discord-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-discord-400">
              {t('threeColumn.upcoming')}
            </span>
          ) : (
            <span className="flex items-center gap-1 border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-white/60">
              <Tv size={9} /> {anime.episodes || "?"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Ranked item (used in Most Viewed) ── */
function RankedItem({ anime, rank }) {
  const { t } = useTranslation();
  const { getTitle } = useLanguage();
  const navigate = useNavigate();

  return (
    <div
      className="group -mx-2 flex cursor-pointer items-center gap-4 border-b border-white/[0.08] px-2 py-2.5 transition-all duration-300 last:border-0 hover:border-discord-500/30 hover:bg-discord-500/[0.04]"
      onClick={() => navigate(getWatchUrl(anime.id, anime.title))}
    >
      <span className="w-8 select-none text-center text-[32px] font-black italic text-white/10 drop-shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:text-discord-500">
        {rank}
      </span>
      <div className="relative shrink-0 overflow-hidden border border-white/[0.08] shadow-md transition-all duration-300 group-hover:border-discord-400/50">
        <img
          src={anime.coverImage?.extraLarge || anime.coverImage?.large}
          alt={getTitle(anime.title)}
          loading="lazy"
          onLoad={(e) => e.target.classList.remove("opacity-0")}
          className="w-[60px] h-[84px] object-cover opacity-0 transition-transform duration-500 group-hover:scale-110 bg-[#1a1a1a]"
          style={{ imageRendering: 'auto' }}
        />
      </div>
      <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-bold uppercase leading-tight text-[#e5e5e5] transition-colors group-hover:text-discord-300">
          {getTitle(anime.title)}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-2 text-[9px] font-bold uppercase tracking-wider text-white/60">
          {anime.status === "NOT_YET_RELEASED" ? (
             <span className="border border-discord-500/20 bg-discord-500/10 px-1.5 py-0.5 text-discord-400">{t('threeColumn.upcoming')}</span>
          ) : (
             <span className="flex items-center gap-1 border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5"><Tv size={9} /> {anime.episodes || "?"}</span>
          )}
          {anime.averageScore ? (
              <span className="flex items-center gap-1 border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-white/80">
              <Star size={9} fill="currentColor" className="text-yellow-500/80" /> {anime.averageScore}%
            </span>
          ) : null}
           <span className="border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5">{anime.format}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Section title with arrow ── */
function SectionHeader({ title, hasArrow = false, path }) {
  const navigate = useNavigate();
  const lines = title.split("\n");
  return (
    <div className="mb-6 flex items-center justify-between border-b border-white/[0.08] pb-4">
      <div className="flex items-center gap-2.5">
        <div className="h-5 w-1 bg-discord-500" />
        <h2 className="text-lg font-black uppercase leading-tight tracking-tight text-white">
          {lines.map((line, i) => (
            <span key={i}>
              {line}
              {i < lines.length - 1 && <br />}
            </span>
          ))}
        </h2>
      </div>
      {hasArrow && (
        <span
          onClick={() => path && navigate(path)}
          className="flex h-7 w-7 cursor-pointer items-center justify-center border border-discord-400/40 bg-discord-600 text-white transition-colors hover:bg-discord-500"
        >
          <ArrowUpRight size={14} />
        </span>
      )}
    </div>
  );
}

/* ── Main three-column section ── */
export default function ThreeColumnSection({ newReleases, justCompleted, isLoading }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("Day");

  const { data: mostViewedData, isLoading: loadingMostViewed } = useQuery({
    queryKey: ["mostViewed", activeTab],
    queryFn: async ({ signal }) => {
      const res = await getMostViewedAnime(activeTab, 1, signal);
      return res;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  return (
    <section className="w-full overflow-hidden border border-white/[0.08] bg-white/[0.012] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.16)] md:p-5">
      <div className="grid w-full grid-cols-1 items-start gap-6 lg:grid-cols-3 lg:gap-8">

        {/* ── LEFT: New Releases ── */}
        <div className="w-full">
          <SectionHeader
            title={t('threeColumn.newReleases')}
            hasArrow
            path="/browse?sort=START_DATE_DESC"
          />
          <div className="w-full">
            {/* MOBILE: Horizontal Scroll */}
            <div className="md:hidden flex flex-nowrap overflow-x-auto scrollbar-hide snap-x snap-mandatory gap-3 pb-4 min-h-[100px]">
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => <div key={i} className="w-[140px] shrink-0 snap-start bg-white/5 rounded-xl animate-pulse h-[200px]" />)
                : newReleases?.slice(0, 10)?.map((anime, i) => (
                  <div key={`nr-mob-${anime.id}-${i}`} className="w-[140px] shrink-0 snap-start">
                    <AnimeCard anime={anime} variant="anixo" />
                  </div>
                ))
              }
            </div>
            
            {/* DESKTOP: Vertical List */}
            <div className="hidden md:block w-full">
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => <SkeletonListItem key={i} />)
                : newReleases?.slice(0, 10)?.map((anime, i) => (
                  <ListItem key={`nr-${anime.id}-${i}`} anime={anime} />
                ))
              }
            </div>
          </div>
        </div>

        {/* ── CENTER: Most Viewed ── */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-5 w-full">
            <div className="flex items-center gap-2.5">
              <div className="w-[3px] h-5 bg-discord-600 rounded-full" />
              <h2 className="text-lg font-extrabold text-white uppercase tracking-tight">
                {t('threeColumn.mostViewed')}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {[
                { label: t('threeColumn.day'), value: "Day" },
                { label: t('threeColumn.week'), value: "Week" },
                { label: t('threeColumn.month'), value: "Month" }
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`text-[11px] md:text-[12px] font-medium transition-colors pb-[2px] ${activeTab === tab.value
                      ? "text-white border-b border-white"
                      : "text-[#666] hover:text-[#aaa]"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2 w-full">
            {loadingMostViewed ? (
              <>
                {Array.from({ length: 10 }).map((_, i) => <SkeletonRankedItem key={i} />)}
              </>
            ) : (
              <>
                {mostViewedData?.media
                  ?.slice(0, 10)
                  ?.map((anime, i) => (
                    <RankedItem key={`mv-${activeTab}-${anime.id}-${i}`} anime={anime} rank={i + 1} />
                  ))}
              </>
            )}
          </div>
        </div>

        {/* ── RIGHT: Just Completed ── */}
        <div className="w-full hidden lg:block">
          <SectionHeader
            title={t('threeColumn.justCompleted')}
            hasArrow
            path="/browse?status=FINISHED"
          />
          <div className="w-full">
            {/* MOBILE: Horizontal Scroll */}
            <div className="md:hidden flex flex-nowrap overflow-x-auto scrollbar-hide snap-x snap-mandatory gap-3 pb-4 min-h-[100px]">
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => <div key={i} className="w-[140px] shrink-0 snap-start bg-white/5 rounded-xl animate-pulse h-[200px]" />)
                : justCompleted?.slice(0, 10)?.map((anime, i) => (
                  <div key={`jc-mob-${anime.id}-${i}`} className="w-[140px] shrink-0 snap-start">
                    <AnimeCard anime={anime} variant="anixo" />
                  </div>
                ))
              }
            </div>
            
            {/* DESKTOP: Vertical List */}
            <div className="hidden md:block w-full">
              {isLoading
                ? Array.from({ length: 10 }).map((_, i) => <SkeletonListItem key={i} />)
                : justCompleted?.slice(0, 10)?.map((anime, i) => (
                  <ListItem key={`jc-${anime.id}-${i}`} anime={anime} />
                ))
              }
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
