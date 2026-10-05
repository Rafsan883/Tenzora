import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { addToWatchlist, removeFromWatchlist } from '../../services/watchlistService';
import { animeIdentity, matchesAnime } from '../../utils/animeIdentity';

const STATUS_OPTIONS = [
  { value: 'Watching', label: 'WATCHING', color: 'bg-green-500' },
  { value: 'Completed', label: 'DONE', color: 'bg-blue-500' },
  { value: 'Dropped', label: 'DROP', color: 'bg-red-500' },
  { value: 'Planning', label: 'PLAN TO WATCH', color: 'bg-yellow-500' },
];

export default function SaveAsPopOver({ animeId, anime, onClose }) {
  const { user, globalWatchlist, setGlobalWatchlist } = useAuth();
  const popoverRef = useRef(null);
  const identity = animeIdentity(anime, animeId);
  const currentStatus = globalWatchlist.find(item => matchesAnime(item, identity))?.status;
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        onClose();
      }
    };
    
    // Add event listener with slight delay to prevent immediate close on mount click
    const timeout = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);
    
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [animeId, onClose]);

  const handleStatusUpdate = async (statusValue) => {
    if (!user) {
      window.dispatchEvent(new CustomEvent('require-login'));
      return;
    }

    setIsUpdating(true);

    try {
      const title = typeof anime?.title === 'string' ? anime.title : anime?.title?.english || anime?.title?.romaji || `Anime ${animeId}`;
      const image = typeof anime?.coverImage === 'string' ? anime.coverImage : anime?.coverImage?.large || anime?.image;
      const result = statusValue ? await addToWatchlist(identity.animeId, title, image, statusValue, 0, 0, identity) : await removeFromWatchlist(identity.animeId, identity.idSource);
      if (!result.success) throw new Error(result.message);
      setGlobalWatchlist(result.watchlist);
      onClose();
    } catch (e) {
      console.error("Failed to update status", e);
      window.alert(e.message || 'Could not save this anime.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div 
      ref={popoverRef}
      className="absolute top-8 right-0 w-[160px] bg-bg border border-border shadow-2xl rounded-lg py-1 z-[60] font-senpai"
      onClick={(e) => e.stopPropagation()} // Prevent card click
    >
      <div className="px-3 py-1.5 border-b border-white/5 mb-1">
        <span className="text-[10px] text-textMuted font-bold uppercase tracking-widest">Save As</span>
      </div>
      
      {STATUS_OPTIONS.map(option => (
        <button
          key={option.value}
          onClick={() => handleStatusUpdate(option.value)}
          disabled={isUpdating}
          className="w-full text-left px-3 py-1.5 hover:bg-surfaceHover transition-colors flex items-center justify-between group"
        >
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${option.color} ${currentStatus === option.value ? 'animate-pulse ring-2 ring-white/20 ring-offset-1 ring-offset-bg' : ''}`} />
            <span className={`text-xs font-semibold ${currentStatus === option.value ? 'text-white' : 'text-textMuted group-hover:text-white'}`}>
              {option.label}
            </span>
          </div>
          {currentStatus === option.value && (
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          )}
        </button>
      ))}
      
      {currentStatus && (
        <div className="px-2 mt-1 pt-1 border-t border-white/5">
          <button 
            onClick={() => handleStatusUpdate(null)}
            className="w-full py-1 text-center text-[10px] text-red-500/70 hover:text-red-500 font-bold transition-colors uppercase tracking-widest"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
