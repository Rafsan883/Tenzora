import { useState } from 'react';
import { useAuth } from './useAuth';
import { addToWatchlist, removeFromWatchlist } from '../services/watchlistService';
import { animeIdentity, matchesAnime } from '../utils/animeIdentity';

export function useWatchlist(id, anime, getTitle) {
  const { user, triggerAuthToast, globalWatchlist, setGlobalWatchlist } = useAuth();
  const [isWatchlistLoading, setIsWatchlistLoading] = useState(false);
  const [showWatchlistDropdown, setShowWatchlistDropdown] = useState(false);
  const identity = animeIdentity(anime, id);
  const isBookmarked = globalWatchlist.some(item => matchesAnime(item, identity));

  const handleUpdateWatchlistStatus = async status => {
    if (!user) return triggerAuthToast('Sign in to manage your watchlist');
    if (isWatchlistLoading) return;
    setIsWatchlistLoading(true);
    setShowWatchlistDropdown(false);
    try {
      const result = status === 'Remove'
        ? await removeFromWatchlist(identity.animeId, identity.idSource)
        : await addToWatchlist(identity.animeId, getTitle(anime?.title), anime?.coverImage?.large || anime?.coverImage?.extraLarge, status, 0, 0, identity);
      if (!result.success) throw new Error(result.message || 'Could not update watchlist');
      setGlobalWatchlist(result.watchlist || []);
    } catch (error) {
      window.alert(error.message);
    } finally {
      setIsWatchlistLoading(false);
    }
  };

  return {
    backendWatchlist: globalWatchlist,
    isBookmarked,
    isWatchlistLoading,
    showWatchlistDropdown,
    setShowWatchlistDropdown,
    handleToggleBackendWatchlist: () => handleUpdateWatchlistStatus(isBookmarked ? 'Remove' : 'Watching'),
    handleUpdateWatchlistStatus,
  };
}
