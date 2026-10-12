import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { markAsRead, markAllRead, clearNotifications } from "../services/notificationService";
import { getAnimeDetails } from "../services/api";
import { Bell, Calendar, Info, AlertCircle } from "lucide-react";
import AccountShell from "../components/account/AccountShell";

const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return Math.floor(seconds) + "s ago";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  if (seconds < 2592000) return Math.floor(seconds / 86400) + "d ago";
  return Math.floor(seconds / 2592000) + "mo ago";
};

const formatNotificationText = (notif) => {
  let title = notif.title.replace('🚀', '').trim();
  let message = notif.message.replace('!', '');

  if (notif.type === 'NEW_EPISODE') {
    if (title === 'New Episode Aired') {
      const match = message.match(/Episode (\d+) of (.*?) is now available/);
      if (match) {
        title = match[2];
        message = `Episode ${match[1]} is now available`;
      } else {
        title = "New Episode";
      }
    }
  }
  return { title, message };
};

export default function Notifications() {
  const { user, globalNotifications, setGlobalNotifications } = useAuth();
  const navigate = useNavigate();
  const [coverCache, setCoverCache] = useState({});

  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  // Fetch cover images for notifications that don't have one
  useEffect(() => {
    const missing = globalNotifications.filter(n => n.animeId && !n.coverImage && !coverCache[n.animeId]);
    if (missing.length === 0) return;

    const uniqueIds = [...new Set(missing.map(n => n.animeId))];
    uniqueIds.slice(0, 10).forEach(async (id) => {
      try {
        const details = await getAnimeDetails(parseInt(id));
        if (details?.coverImage) {
          setCoverCache(prev => ({ ...prev, [id]: details.coverImage.large || details.coverImage.extraLarge || '' }));
        }
      } catch { /* silently fail */ }
    });
  }, [globalNotifications, coverCache]);

  // Merge cover cache into notifications
  const enrichedNotifications = globalNotifications.map(n => {
    if (n.coverImage || !n.animeId || !coverCache[n.animeId]) return n;
    return { ...n, coverImage: coverCache[n.animeId] };
  });

  const handleMarkRead = async (id) => {
    const res = await markAsRead(id);
    if (res.success) {
      setGlobalNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    }
  };

  const handleReadAll = async () => {
    const res = await markAllRead();
    if (res.success) {
      setGlobalNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    }
  };

  const handleClear = async () => {
    const res = await clearNotifications();
    if (res.success) {
      setGlobalNotifications([]);
    }
  };

  const unreadCount = enrichedNotifications.filter(n => !n.isRead).length;

  return (
    <AccountShell footer>
        <div className="mb-6 flex items-center justify-between rounded-[20px] border border-white/[0.08] bg-[#151517] px-7 py-7 shadow-[0_20px_60px_rgba(0,0,0,.16)]">
          <div>
            <h1 className="text-[25px] font-extrabold tracking-[-0.04em] text-white">NOTIFICATIONS</h1>
            <p className="mt-1 text-[13px] text-white/45">Updates on new episodes, watchlist alerts and system announcements.</p>
          </div>
          {unreadCount > 0 && <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white">{unreadCount}</span>}
        </div>
        <div className="mb-6 flex items-center gap-4 px-1">
            <button 
              onClick={handleReadAll} 
              className="text-[12px] font-bold uppercase tracking-wider text-white/40 transition-colors hover:text-white"
            >
              Mark all read
            </button>
            <button 
              onClick={handleClear} 
              className="text-[12px] font-bold uppercase tracking-wider text-white/40 transition-colors hover:text-red-400"
              title="Clear all notifications"
            >
              Clear all
            </button>
        </div>

        {/* Notification List */}
        {enrichedNotifications.length > 0 ? (
          <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#151517] px-6">
            {enrichedNotifications.map((notif) => {
              const { title, message } = formatNotificationText(notif);
              return (
              <Link
                key={notif._id}
                to={notif.targetUrl || (notif.animeId ? `/watch/${notif.animeId}` : '#')}
                onClick={() => { if (!notif.isRead) handleMarkRead(notif._id); }}
                 className={`flex cursor-pointer gap-4 border-b border-white/[0.07] py-5 transition-colors last:border-b-0 hover:bg-white/[0.03] ${!notif.isRead ? 'bg-white/[0.025]' : ''}`}
              >
                {/* Anime Cover Image or Icon */}
                {notif.type === 'NEW_EPISODE' && notif.coverImage ? (
                  <div className="relative shrink-0">
                     <div className="h-[84px] w-[60px] overflow-hidden rounded-md border border-white/10">
                      <img
                        src={notif.coverImage}
                        alt={title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    {notif.episode && (
                       <div className="absolute -bottom-1.5 -right-1.5 rounded-sm bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white shadow-md">
                        {notif.episode}
                      </div>
                    )}
                  </div>
                ) : notif.type === 'NEW_EPISODE' ? (
                   <div className="flex h-[84px] w-[60px] shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]">
                     <Calendar size={24} className="text-white/35" />
                  </div>
                ) : notif.type === 'WATCHLIST_UPDATE' ? (
                   <div className="flex h-[84px] w-[60px] shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]">
                     <Info size={24} className="text-white/35" />
                  </div>
                ) : (
                   <div className="flex h-[84px] w-[60px] shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04]">
                     <AlertCircle size={24} className="text-white/35" />
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                       <h3 className={`text-[14px] font-bold ${!notif.isRead ? 'text-white' : 'text-white/60'}`}>
                        {title}
                      </h3>
                       <p className="mt-1 line-clamp-2 text-[12px] text-white/40">
                        {message}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {!notif.isRead && (
                        <div className="w-2 h-2 bg-[#e50914] rounded-full shrink-0" />
                      )}
                       <span className="text-[11px] text-white/30">{timeAgo(notif.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </Link>
              );
            })}
          </div>
        ) : (
           <div className="flex min-h-[390px] flex-col items-center justify-center rounded-[20px] border border-white/[0.08] bg-[#151517] px-6 py-20 text-center">
             <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035]">
               <Bell size={28} className="text-white/55" />
             </div>
             <h2 className="mb-2 text-xl font-extrabold uppercase tracking-wide text-white">ALL CAUGHT UP</h2>
             <p className="mb-7 max-w-md text-[13px] leading-relaxed text-white/45">You have no unread notifications. When new episodes air or watchlists update, you'll see them here.</p>
             <Link to="/browse" className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-[12px] font-bold uppercase tracking-wider text-[#111] transition-all hover:bg-white/90">
               ◉ Browse Anime
             </Link>
          </div>
        )}
    </AccountShell>
  );
}
