import { backendApi } from './api';

export async function getWatchlist() {
  try {
    const res = await backendApi.get('/watchlist');
    return res.data;
  } catch (error) {
    console.error("Get watchlist error:", error.response?.data || error.message);
    return { success: false, message: error.response?.data?.message || 'Error fetching watchlist' };
  }
}

export async function addToWatchlist(animeId, title, coverImage, status = 'Planning', progress = 0, score = 0, identity = {}) {
  try {
    const res = await backendApi.post('/watchlist/add', {
      animeId,
      title,
      coverImage,
      status,
      progress,
      score,
      ...identity
    });
    return res.data;
  } catch (error) {
    console.error("Add to watchlist error:", error.response?.data || error.message);
    return { success: false, message: error.response?.data?.message || 'Error adding to watchlist' };
  }
}

export async function removeFromWatchlist(animeId, idSource = 'ANILIST') {
  try {
    const res = await backendApi.delete(`/watchlist/remove/${animeId}`, { params: { idSource } });
    return res.data;
  } catch (error) {
    console.error("Remove from watchlist error:", error.response?.data || error.message);
    return { success: false, message: error.response?.data?.message || 'Error removing from watchlist' };
  }
}

export async function clearWatchlist() {
  try {
    const res = await backendApi.delete('/watchlist/clear');
    return res.data;
  } catch (error) {
    console.error("Clear watchlist error:", error.response?.data || error.message);
    return { success: false, message: error.response?.data?.message || 'Error clearing watchlist' };
  }
}
