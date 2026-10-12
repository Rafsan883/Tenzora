import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ProgressAnimeCard from "../components/common/ProgressAnimeCard";
import Pagination from "../components/common/Pagination";
import { useAuth } from "../hooks/useAuth";
import { removeProgress, getProgress } from "../services/progressService";
import { syncAnilist } from "../services/authService";
import { Clock, Trash2, RefreshCw } from "lucide-react";
import AccountShell from "../components/account/AccountShell";

export default function ContinueWatching() {
  const { t } = useTranslation();
  const { user, globalProgress, setGlobalProgress } = useAuth();

  const [currentPage, setCurrentPage] = useState(1);
  const [isSyncing, setIsSyncing] = useState(false);
  const itemsPerPage = 24;
  const [syncCooldown, setSyncCooldown] = useState(() => {
    const lastSync = localStorage.getItem('lastAnilistSync');
    if (lastSync) {
      const diff = Math.floor((Date.now() - parseInt(lastSync)) / 1000);
      if (diff < 30) {
        return 30 - diff;
      }
    }
    return 0;
  });

  useEffect(() => {
    let timer;
    if (syncCooldown > 0) {
      timer = setInterval(() => {
        setSyncCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [syncCooldown]);

  useEffect(() => {
    // FETCH LATEST PROGRESS ON MOUNT (REAL SYNC)
    const syncProgress = async () => {
      try {
        const res = await getProgress();
        if (res.success) {
          setGlobalProgress(res.continueWatching);
        }
      } catch (err) {
        console.error("Failed to sync progress on mount:", err);
      }
    };

    if (user) syncProgress();
  }, [user, setGlobalProgress]);

  const handleRemove = async (animeId) => {
    if (user) {
      const res = await removeProgress(animeId);
      if (res.success) {
        setGlobalProgress(prev => prev.filter(p => p.animeId !== animeId));
      }
    } else {
      // For guests: just remove from state
      setGlobalProgress(prev => prev.filter(p => p.animeId !== animeId));
    }
  };

  const handleSync = async () => {
    if (isSyncing || syncCooldown > 0) return;
    setIsSyncing(true);
    try {
      const res = await syncAnilist();
      if (res.success) {
        localStorage.setItem('lastAnilistSync', Date.now().toString());
        // Refresh local progress from backend after sync
        const progressRes = await getProgress();
        if (progressRes.success) {
          setGlobalProgress(progressRes.continueWatching);
        }
      }
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const progressCards = (globalProgress || []).map(p => ({
    ...p,
    id: p.animeId,
    animeId: p.animeId,
    anilistId: p.anilistId,
    title: { english: p.title },
    coverImage: { large: p.coverImage },
    episode: p.episode,
    currentTime: p.currentTime,
    duration: p.duration,
    isProgress: true
  }));

  return (
    <AccountShell footer>
        <div className="mb-6 flex flex-col justify-between gap-5 rounded-[20px] border border-white/[0.08] bg-[#151517] px-7 py-7 shadow-[0_20px_60px_rgba(0,0,0,.16)] sm:flex-row sm:items-center">
          <div>
            <h2 className="text-[25px] font-extrabold tracking-[-0.04em] text-white">CONTINUE WATCHING</h2>
            <p className="mt-1 text-[13px] text-white/45">Resume your latest episodes and watch sessions across all devices.</p>
          </div>
          
          {user && user?.anilist?.username && (
            <button 
              onClick={handleSync}
              disabled={isSyncing || syncCooldown > 0}
              className={`flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all md:py-2 sm:w-auto ${
                (isSyncing || syncCooldown > 0)
                ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed' 
                : 'bg-[#02A9FF]/10 border-[#02A9FF]/20 text-[#02A9FF] hover:bg-[#02A9FF] hover:text-white hover:border-[#02A9FF]'
              }`}
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : syncCooldown > 0 ? 'opacity-50' : ''} />
              <span>
                <span className="inline sm:hidden">{isSyncing ? t('continueWatching.syncing') : syncCooldown > 0 ? t('continueWatching.waitCooldown', { cooldown: syncCooldown }) : t('continueWatching.anilistSync')}</span>
                <span className="hidden sm:inline">{isSyncing ? t('continueWatching.syncingLibrary') : syncCooldown > 0 ? t('continueWatching.waitCooldown', { cooldown: syncCooldown }) : t('continueWatching.anilistSync')}</span>
              </span>
            </button>
          )}
        </div>

        {/* Grid */}
        {progressCards.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {progressCards
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((anime, i) => (
                <div key={`${anime.id}-${i}`} className="group relative">
                  <ProgressAnimeCard anime={anime} />
                  
                  {/* Remove Button - Positioned absolutely relative to the group */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRemove(anime.id);
                    }}
                    className="absolute right-2 top-2 z-50 rounded-lg border border-white/10 bg-black/70 p-2.5 text-white/90 shadow-xl backdrop-blur-md transition-all duration-300 hover:bg-black hover:text-cyan-300 md:opacity-0 md:group-hover:opacity-100"
                    title={t('continueWatching.removeFromHistory')}
                  >
                    <Trash2 size={16} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
            
            {progressCards.length > itemsPerPage && (
              <div className="mt-12">
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(progressCards.length / itemsPerPage)}
                  onPageChange={(page) => {
                    setCurrentPage(page);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </div>
            )}
          </>
        ) : (
          <div className="relative mx-auto flex max-w-3xl flex-col items-center justify-center overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#151517] py-24 shadow-xl">
            <div className="relative w-20 h-20 mb-6 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
              <Clock size={32} className="text-white/20" strokeWidth={1.5} />
            </div>
            <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tight">{t('continueWatching.noSession')}</h2>
            <p className="text-white/30 mb-8 text-[13px] max-w-xs text-center leading-relaxed">
              {t('continueWatching.desc')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <Link to="/browse" className="bg-white text-black font-black py-3 px-8 rounded-xl text-[11px] uppercase tracking-[0.2em] transition-all hover:scale-105">
                {t('continueWatching.explore')}
              </Link>
              {user?.anilist?.username && (
                <button 
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="bg-discord-600 text-white font-black py-3 px-8 rounded-xl text-[11px] uppercase tracking-[0.2em] transition-all hover:scale-105 flex items-center gap-2"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing ? t('continueWatching.syncingLibrary') : t('continueWatching.syncFromAnilist')}
                </button>
              )}
            </div>
          </div>
        )}
    </AccountShell>
  );
}
