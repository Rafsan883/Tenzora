import { useState, useEffect } from "react";
import { Eye, EyeOff, ChevronRight, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import {
  getTrendingAnime,
  getPopularAnime,
  getNewReleases,
  getJustCompletedAnime,
  getUpcomingAnime,
} from "../services/api";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import Hero from "../components/home/Hero";
import EstimatedSchedule from "../components/home/EstimatedSchedule";
import GenreNav from "../components/home/GenreNav";
import AnimeRow from "../components/home/AnimeRow";
import { useAuth } from "../hooks/useAuth";
import ShareBanner from "../components/common/ShareBanner";
import W2GNoticeBanner from "../components/common/W2GNoticeBanner";
import { AdNativeBanner } from "../components/common/AdBanner";

import TopMovies from "../components/home/TopMovies";
import ThreeColumnSection from "../components/home/ThreeColumnSection";
import AnimeCard from "../components/common/AnimeCard";
import HorizontalProgressCard from "../components/home/HorizontalProgressCard";
import SidebarListCard from "../components/home/SidebarListCard";
import { removeProgress } from "../services/progressService";
import LiveComments from "../components/LiveComments";

function SidebarList({ title, data, isLoading, tabs, activeTab, onTabChange }) {
  const getViewAllLink = () => {
    if (activeTab === "TOP AIRING") return "/browse?sort=TRENDING_DESC";
    if (activeTab === "UPCOMING") return "/browse?status=NOT_YET_RELEASED";
    return "/browse";
  };

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="mb-5 flex items-center justify-between border-b border-white/[0.08] pb-4">
        {tabs ? (
          <div className="flex gap-4 border-l-2 border-discord-500 pl-3">
            {tabs.map(tab => (
              <button 
                key={tab} 
                onClick={() => onTabChange(tab)}
                className={`text-[12px] font-black uppercase tracking-[0.16em] transition-colors md:text-[14px] ${activeTab === tab ? 'text-white' : 'text-white/35 hover:text-discord-300'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        ) : (
          <h2 className="text-[14px] font-black uppercase tracking-[0.16em] text-white">{title}</h2>
        )}
        <Link 
          to={getViewAllLink()} 
          className="border border-white/[0.1] bg-white/[0.04] p-1 text-white/45 transition-all group hover:border-discord-400 hover:bg-discord-600 hover:text-white"
          title={`View all ${activeTab ? activeTab.toLowerCase() : title.toLowerCase()}`}
        >
          <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
      {/* MOBILE: Horizontal Scroll */}
      <div className="flex min-h-[100px] snap-x snap-mandatory flex-nowrap gap-3 overflow-x-auto pb-4 scrollbar-hide md:hidden">
        {isLoading 
          ? Array.from({length: 5}).map((_,i) => <div key={i} className="h-[200px] w-[140px] shrink-0 snap-start animate-pulse border border-white/[0.06] bg-white/[0.04]" />)
          : data?.slice(0, 10).map(anime => (
              <div key={anime.id} className="w-[140px] shrink-0 snap-start">
                <AnimeCard anime={anime} variant="anixo" />
              </div>
            ))
        }
      </div>

      {/* DESKTOP: Vertical List */}
      <div className="hidden flex-col gap-2 md:flex">
        {isLoading 
          ? Array.from({length: 5}).map((_,i) => <div key={i} className="h-[104px] animate-pulse border border-white/[0.06] bg-white/[0.04]" />)
          : data?.slice(0, 10).map(anime => <SidebarListCard key={anime.id} anime={anime} />)
        }
      </div>
    </div>
  );
}

export default function Home() {
  const { globalProgress, setGlobalProgress, user } = useAuth();
  
  const [activeSidebarTab, setActiveSidebarTab] = useState("TOP AIRING");

  const [showContinueWatching, setShowContinueWatching] = useState(() => {
    const saved = localStorage.getItem('showContinueWatching');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('showContinueWatching', JSON.stringify(showContinueWatching));
  }, [showContinueWatching]);

  const toggleContinueWatching = () => {
    setShowContinueWatching(!showContinueWatching);
  };

  const getCached = (key) => {
    try {
      const data = localStorage.getItem(`cache_home_${key}`);
      return data ? JSON.parse(data) : undefined;
    } catch { return undefined; }
  };
  const setCache = (key, data) => {
    try {
      localStorage.setItem(`cache_home_${key}`, JSON.stringify(data));
    } catch (e) { console.warn("Cache write failed:", e); }
  };

  const { data: trendingData, isLoading: loadingTrending, isFetching: fetchingTrending } = useQuery({
    queryKey: ["trending", 1],
    queryFn: async ({ signal }) => {
      const res = await getTrendingAnime(1, signal);
      if (res?.media) setCache("trending", res);
      return res;
    },
    placeholderData: getCached("trending"),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 2, // 2 minutes
  });

  const { data: popularData, isLoading: loadingPopular, isFetching: fetchingPopular } = useQuery({
    queryKey: ["popular", 1],
    queryFn: async ({ signal }) => {
      const res = await getPopularAnime(1, signal);
      if (res?.media) setCache("popular", res);
      return res;
    },
    placeholderData: getCached("popular"),
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 2,
  });

  const { data: newReleasesData, isLoading: loadingNew, isFetching: fetchingNew } = useQuery({
    queryKey: ["newReleases", 1],
    queryFn: async ({ signal }) => {
      const res = await getNewReleases(1, signal);
      if (res?.media) setCache("new", res);
      return res;
    },
    placeholderData: getCached("new"),
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 2,
  });

  const { data: justCompletedData, isLoading: loadingJustCompleted } = useQuery({
    queryKey: ["justCompleted"],
    queryFn: async ({ signal }) => {
      const res = await getJustCompletedAnime(1, signal);
      if (res?.media) setCache("completed", res);
      return res;
    },
    placeholderData: getCached("completed"),
    staleTime: 1000 * 60 * 60,
  });

  const { data: upcomingData, isLoading: loadingUpcoming } = useQuery({
    queryKey: ["upcoming"],
    queryFn: async ({ signal }) => {
      const res = await getUpcomingAnime(1, signal);
      if (res?.media) setCache("upcoming", res);
      return res;
    },
    placeholderData: getCached("upcoming"),
    staleTime: 1000 * 60 * 30,
  });

  const handleRemoveProgress = async (animeId) => {
    setGlobalProgress(prev => prev.filter(p => p.animeId !== animeId));
    if (user) {
      try {
        await removeProgress(animeId);
      } catch (error) {
        console.error("Failed to remove progress:", error);
      }
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050609] text-white selection:bg-discord-500/30">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[520px] w-[900px] -translate-x-1/2 bg-discord-600/[0.06] blur-[140px]" />
        <div className="absolute -right-40 top-[42%] h-[420px] w-[420px] bg-indigo-500/[0.035] blur-[120px]" />
      </div>

      <div className="relative z-10">
        <Navbar />
        <Hero data={trendingData?.media} isLoading={loadingTrending} />
        <GenreNav />

        <div className="mx-auto mt-6 flex max-w-[1720px] flex-col items-start gap-5 px-3 md:mt-10 md:gap-8 md:px-5 xl:flex-row">
          
          {/* ─── LEFT COLUMN (MAIN CONTENT) ─── */}
          <div className="flex min-w-0 w-full flex-col gap-5 md:gap-8 xl:w-[70%]">
            
            {/* Announcement Banner */}
            {new Date() < new Date('2026-10-25') && (
              <div className="mx-auto mb-1 flex w-full max-w-3xl items-start justify-center gap-3 border border-discord-500/25 bg-[#0b0d14]/80 px-5 py-3 text-center shadow-[0_12px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:items-center md:px-6">
                <Info size={18} className="mt-0.5 shrink-0 text-discord-400 sm:mt-0" />
                <span className="text-sm font-bold tracking-wide text-indigo-100 md:text-base">
                  ⚠️ Missing new episodes? Please clear your Browser History & Cache (Site Data) to apply our latest fixes! We are currently working on a major upcoming update.
                </span>
              </div>
            )}

            {/* Watch History */}
            <div id="continue-watching" className="w-full">
                {showContinueWatching ? (
                  <AnimeRow
                    subtitle="Your Watchlist"
                    title="Watch History"
                    data={globalProgress?.map(p => ({
                      ...p,
                      id: p.animeId,
                      animeId: p.animeId,
                      anilistId: p.anilistId,
                      title: { english: p.title },
                      coverImage: { large: p.coverImage },
                      bannerImage: p.bannerImage,
                      episode: p.episode,
                      currentTime: p.currentTime,
                      duration: p.duration,
                      isProgress: true
                    }))}
                    isLoading={false}
                    isScrollable={true}
                    onRemove={handleRemoveProgress}
                    CardComponent={HorizontalProgressCard}
                    cardVariant="anixo"
                    headerAction={
                      <button
                        onClick={toggleContinueWatching}
                        className="p-1 hover:bg-white/10 rounded transition-all text-white/40 hover:text-white cursor-pointer flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ml-4"
                        title="Hide Section"
                      >
                        <Eye size={15} />
                      </button>
                    }
                    emptyMessage="You haven't watched anything yet. Start exploring!"
                  />
                ) : (
                  <div className="flex items-center gap-3 py-4">
                    <p className="text-[13px] font-medium text-white/40">Your Watchlist</p>
                    <h2 className="text-xl md:text-[22px] font-bold text-white/30 leading-none tracking-tight text-center md:text-left">
                      Watch History
                    </h2>
                    <button
                      onClick={toggleContinueWatching}
                      className="p-1 hover:bg-white/10 rounded transition-all text-white/35 hover:text-white cursor-pointer flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ml-4"
                      title="Show Section"
                    >
                      <EyeOff size={15} />
                    </button>
                  </div>
                )}
              </div>
            
            {/* Live Comments */}
            <div className="w-full border border-white/[0.07] bg-white/[0.012] p-1 shadow-[0_18px_60px_rgba(0,0,0,0.18)] md:mt-1 md:p-2">
              <LiveComments />
            </div>

            <div className="border border-white/[0.07] bg-white/[0.012] shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
              <ShareBanner />
            </div>
            <div className="border border-white/[0.07] bg-white/[0.012] shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
              <W2GNoticeBanner />
            </div>

            {/* Main Anime Grids */}
            <div id="main-grid" className="mt-1 flex w-full flex-col gap-6 md:gap-8">
              <AnimeRow
                title="Newest"
                data={newReleasesData?.media || []}
                isLoading={loadingNew}
                isFetching={fetchingNew}
                limit={16}
                viewAllLink="/browse"
                cardVariant="anixo"
              />
              <AnimeRow
                title="Popular"
                data={trendingData?.media || []}
                isLoading={loadingTrending}
                isFetching={fetchingTrending}
                limit={16}
                viewAllLink="/browse?sort=TRENDING_DESC"
                cardVariant="anixo"
              />
              <AnimeRow
                title="Top Rated"
                data={popularData?.media || []}
                isLoading={loadingPopular}
                isFetching={fetchingPopular}
                limit={16}
                viewAllLink="/browse?sort=SCORE_DESC"
                cardVariant="anixo"
              />
            </div>

          </div>

          {/* ─── RIGHT COLUMN (SIDEBAR) ─── */}
          <div className="flex min-w-0 w-full shrink-0 flex-col gap-10 overflow-hidden border border-white/[0.07] bg-white/[0.012] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.18)] md:p-5 xl:w-[30%]">
            <SidebarList 
              tabs={["TOP AIRING", "UPCOMING"]}
              activeTab={activeSidebarTab}
              onTabChange={setActiveSidebarTab}
              data={activeSidebarTab === "TOP AIRING" ? trendingData?.media : upcomingData?.media} 
              isLoading={activeSidebarTab === "TOP AIRING" ? loadingTrending : loadingUpcoming} 
            />

            <TopMovies />
          </div>

        </div>

        {/* ─── FULL-WIDTH SECTIONS (Outside the split layout) ─── */}
        <div className="mx-auto mt-12 w-full max-w-[1720px] px-3 md:px-5">
          <ThreeColumnSection
            newReleases={newReleasesData?.media || []}
            justCompleted={justCompletedData?.media || []}
            isLoading={loadingNew || loadingJustCompleted}
          />
        </div>


        <AdNativeBanner />
        <div className="mx-auto mb-10 mt-12 w-full max-w-[1720px] px-3 md:px-5">
          <EstimatedSchedule />
        </div>
        <Footer />
      </div>
    </div>
  );
}
