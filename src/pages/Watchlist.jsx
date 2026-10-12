import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getWatchlist, clearWatchlist } from "../services/watchlistService";
import { syncAnilist } from "../services/authService";
import { RefreshCw, Trash2, Bookmark, X, ChevronDown } from "lucide-react";
import AccountShell from "../components/account/AccountShell";

export default function Watchlist() {
  const { user, globalWatchlist, setGlobalWatchlist } = useAuth();
  const navigate = useNavigate();

  const watchlist = globalWatchlist;
  const setWatchlist = setGlobalWatchlist;
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("All");
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [syncCooldown, setSyncCooldown] = useState(() => {
    const lastSync = localStorage.getItem('lastAnilistSync');
    if (lastSync) {
      const diff = Math.floor((Date.now() - parseInt(lastSync)) / 1000);
      if (diff < 30) return 30 - diff;
    }
    return 0;
  });

  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      const res = await clearWatchlist();
      if (res.success) {
        setWatchlist([]);
        setShowClearModal(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsClearing(false);
    }
  };

  useEffect(() => {
    let timer;
    if (syncCooldown > 0) {
      timer = setInterval(() => setSyncCooldown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [syncCooldown]);

  const handleSync = async () => {
    if (syncCooldown > 0) return;
    if (!user?.anilist?.username) {
      setSyncError({ type: 'auth', message: 'Please connect your AniList account in Settings first to import your bookmarks.' });
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    try {
      const res = await syncAnilist();
      if (res.success) {
        localStorage.setItem('lastAnilistSync', Date.now().toString());
        window.location.reload();
      } else {
        setSyncError({ type: 'error', message: res.message || "Failed to sync with AniList. Please try again later." });
      }
    } catch (e) {
      console.error(e);
      setSyncError({ type: 'error', message: "An unexpected error occurred during sync." });
    } finally {
      setIsSyncing(false);
    }
  };

  const subTabs = ["All", "Watching", "On-Hold", "Planning", "Completed", "Dropped"];

  useEffect(() => {
    let active = true;
    if (!user) {
      navigate("/");
      return;
    }
    const fetchWatchlist = async () => {
      const res = await getWatchlist();
      if (active && res.success) {
        setWatchlist(res.watchlist || []);
      }
      if (active) setIsLoading(false);
    };
    fetchWatchlist();
    return () => { active = false; };
  }, [user, navigate, setWatchlist]);

  if (isLoading) {
    return (
      <AccountShell>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="w-8 h-8 border-4 border-discord-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </AccountShell>
    );
  }

  const filteredWatchlist = watchlist.filter(item => activeTab === "All" || item.status === activeTab);

  return (
    <AccountShell>
        
        {/* Sync Error Notice */}
        {syncError && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <span>{syncError.message}</span>
            <button onClick={() => setSyncError(null)} className="text-red-400 hover:text-red-300">
              <X size={16} />
            </button>
          </div>
        )}

        <div className="mb-6 flex flex-col justify-between gap-5 rounded-[20px] border border-white/[0.08] bg-[#151517] px-7 py-6 shadow-[0_20px_60px_rgba(0,0,0,.16)] sm:flex-row sm:items-center">
          <div>
            <h1 className="text-[25px] font-extrabold tracking-[-0.04em] text-white">BOOKMARKS</h1>
            <p className="mt-1 text-[13px] text-white/45">Manage your anime watchlist, track completion status, and organize favorites.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-white/55">
              {filteredWatchlist.length}
            </span>
            <button
              onClick={handleSync}
              disabled={isSyncing || syncCooldown > 0}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-white/65 transition-all hover:bg-white/[0.1] hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Syncing..." : syncCooldown > 0 ? `Wait ${syncCooldown}s` : "Sync AniList"}
            </button>
            {watchlist.length > 0 && (
              <button
                onClick={() => setShowClearModal(true)}
                className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-red-400 transition-all hover:bg-red-500 hover:text-white"
              >
                <Trash2 size={14} /> Clear All
              </button>
            )}
          </div>
        </div>

        {/* Categories (Sub Nav) */}
        <div className="mb-5 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#151517] p-1 scrollbar-hide">
          <div className="flex min-w-max items-center gap-1">
            {subTabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative rounded-lg px-4 py-2.5 text-[13px] font-bold whitespace-nowrap transition-all ${
                  activeTab === tab ? "bg-white text-[#111]" : "text-white/40 hover:bg-white/[0.05] hover:text-white/80"
                }`}
              >
                {tab}
                {activeTab === "All" && tab === "All" && <span className="ml-1 text-black/45">{filteredWatchlist.length}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Category Label (Senpaiflix Style) */}
        <div className="mb-5 flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,.8)]" />
          <h2 className="text-sm font-bold text-cyan-300">
            {activeTab === "All" ? "All Anime" : activeTab}
          </h2>
          <span className="text-white/30 text-xs ml-auto font-medium">
            {filteredWatchlist.length} titles
          </span>
        </div>

        {/* Anime Grid */}
        {filteredWatchlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[20px] border border-white/[0.08] bg-[#151517] py-24 shadow-xl">
            <Bookmark size={32} className="mb-4 text-white/20" />
            <h2 className="mb-2 text-lg font-black uppercase text-white">Empty Bookmarks</h2>
            <p className="text-white/30 text-[12px] max-w-xs text-center">
              Add some anime to your Watch Later list to see them here!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {filteredWatchlist.map((item) => {
              // Convert Watchlist item to AnimeCard prop structure
              const anime = {
                id: parseInt(item.animeId),
                title: { english: item.title, romaji: item.title, native: item.title },
                coverImage: { extraLarge: item.coverImage, large: item.coverImage, medium: item.coverImage },
                // Use the watchlist status as the top-left format tag to match Senpaiflix
                format: item.status, 
                isProgress: true,
                episode: item.progress || 1,
                currentTime: item.currentTime
              };

              return (
                <div key={item.animeId} className="group relative min-h-[144px] overflow-hidden rounded-lg border border-white/[0.06] bg-[#18191d] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:bg-[#1b1c21]">
                  <Link to={`/watch/${anime.id}`} className="flex h-full min-h-[144px]">
                    <img src={anime.coverImage.large} alt={anime.title.english} className="h-[144px] w-[104px] shrink-0 object-cover brightness-90 transition duration-500 group-hover:brightness-105" />
                    <div className="flex min-w-0 flex-1 flex-col justify-between p-5">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="line-clamp-2 text-[15px] font-extrabold leading-snug text-white/90">{anime.title.english}</h3>
                        <span className="shrink-0 text-[12px] font-semibold text-white/45">{item.status}<ChevronDown size={13} className="ml-1 inline" /></span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-bold text-white/40">
                        <span className="rounded bg-white/[0.06] px-3 py-2"><span className="mr-1 text-white/25">▣</span> EP {item.progress || 1}</span>
                        <span className="rounded bg-white/[0.06] px-3 py-2">{anime.format}</span>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {/* Clear All Modal */}
        {showClearModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#151517] p-6 shadow-2xl">
              <h3 className="text-xl font-bold mb-2">Clear Watch Later</h3>
              <p className="text-white/60 text-sm mb-6">
                Are you sure you want to clear your entire Watch Later list? This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowClearModal(false)}
                  className="px-5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  disabled={isClearing}
                  className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors flex items-center gap-2"
                >
                  {isClearing ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Yes, Clear All
                </button>
              </div>
            </div>
          </div>
        )}
    </AccountShell>
  );
}
