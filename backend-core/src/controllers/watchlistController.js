import User from '../models/User.js';
import axios from 'axios';
import { resolveAnimeIds } from '../utils/animeIds.js';

// Helper to sync watchlist to AniList
const syncWatchlistToAnilist = async (user, animeId, status, progress, score) => {
  if (!user.anilist || !user.anilist.accessToken) return;

  const mediaId = parseInt(animeId);
  if (isNaN(mediaId)) return;

  const statusMap = {
    'Watching': 'CURRENT',
    'Planning': 'PLANNING',
    'Completed': 'COMPLETED',
    'Dropped': 'DROPPED',
    'On-Hold': 'PAUSED',
    'Paused': 'PAUSED'
  };

  const variables = { mediaId };
  if (status) variables.status = statusMap[status] || 'PLANNING';
  if (progress !== undefined) variables.progress = parseInt(progress);
  if (score !== undefined) variables.scoreRaw = Math.round(score * 10);

  try {
    const query = `
      mutation ($mediaId: Int, $status: MediaListStatus, $progress: Int, $scoreRaw: Int) {
        SaveMediaListEntry (mediaId: $mediaId, status: $status, progress: $progress, scoreRaw: $scoreRaw) {
          id
        }
      }
    `;

    await axios.post('https://graphql.anilist.co', {
      query,
      variables
    }, {
      headers: {
        Authorization: `Bearer ${user.anilist.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
    });
    console.log(`[AniList] Watchlist synced for ${user.username}: Media ${mediaId}`);
  } catch (error) {
    console.error("[AniList] Watchlist Sync Error:", error.response?.data || error.message);
  }
};

// @desc    Get user watchlist
export const getWatchlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('watchlist');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const uniqueWatchlist = [];
    const seenIds = new Set();
    const rawWatchlist = user.watchlist || [];
    
    for (const item of rawWatchlist) {
      if (!seenIds.has(String(item.animeId))) {
        seenIds.add(String(item.animeId));
        uniqueWatchlist.push(item);
      }
    }

    res.status(200).json({
      success: true,
      watchlist: uniqueWatchlist
    });
  } catch (error) {
    console.error("Get watchlist error:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Add to watchlist
export const addToWatchlist = async (req, res) => {
  try {
    const { animeId, title, coverImage, status, progress, score } = req.body;
    
    if (!animeId || !title) {
      return res.status(400).json({ success: false, message: 'Please provide animeId and title' });
    }

    const [identity] = await resolveAnimeIds([{ animeId, idSource: req.body.idSource, idMal: req.body.idMal }]);
    const sAnimeId = identity.animeId;

    // 1. Check if it exists
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const existingIndex = user.watchlist.findIndex(item => item.animeId === sAnimeId);

    if (existingIndex > -1) {
        // UPDATE existing entry
        const updateObj = {};
        if (status) updateObj['watchlist.$[entry].status'] = status;
        if (progress !== undefined) updateObj['watchlist.$[entry].progress'] = progress;
        if (score !== undefined) updateObj['watchlist.$[entry].score'] = score;
        if (coverImage) updateObj['watchlist.$[entry].coverImage'] = coverImage;
        if (identity.idMal) updateObj['watchlist.$[entry].idMal'] = identity.idMal;
        updateObj['watchlist.$[entry].addedAt'] = Date.now();

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { $set: updateObj },
            { new: true, runValidators: true, arrayFilters: [{ 'entry.animeId': sAnimeId }] }
        );

        void syncWatchlistToAnilist(user, sAnimeId, status, progress, score);
        return res.status(200).json({
            success: true,
            message: 'Watchlist updated',
            watchlist: updatedUser.watchlist
        });
    } else {
        // ADD new entry
        const insertedUser = await User.findOneAndUpdate(
            { _id: req.user._id, 'watchlist.animeId': { $ne: sAnimeId } },
            { 
                $push: { 
                    watchlist: { 
                        animeId: sAnimeId,
                        idMal: identity.idMal,
                        title, 
                        coverImage, 
                        status: status || 'Planning', 
                        progress: progress || 0, 
                        score: score || 0,
                        addedAt: Date.now()
                    } 
                } 
            },
            { new: true, runValidators: true }
        );
        const updatedUser = insertedUser || await User.findById(req.user._id);
        void syncWatchlistToAnilist(user, sAnimeId, status, progress, score);

        return res.status(200).json({
            success: true,
            message: 'Added to watchlist',
            watchlist: updatedUser.watchlist
        });
    }
  } catch (error) {
    console.error("Add/Update watchlist error:", error.message);
    res.status(error.status || (error.name === 'ValidationError' ? 400 : 502)).json({ success: false, message: error.status ? error.message : error.name === 'ValidationError' ? 'Invalid watchlist values' : 'Could not save watchlist' });
  }
};

// @desc    Remove from watchlist
export const removeFromWatchlist = async (req, res) => {
  try {
    const { animeId } = req.params;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { watchlist: req.query.idSource === 'MAL' ? { idMal: Number(animeId) } : { animeId: String(animeId) } } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Removed from watchlist',
      watchlist: updatedUser.watchlist
    });
  } catch (error) {
    console.error("Remove watchlist error:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Bulk import watchlist (merge or replace)
export const bulkImport = async (req, res) => {
  try {
    const { mode } = req.body;
    let { items } = req.body;
    if (mode && !['Merge', 'Replace'].includes(mode)) return res.status(400).json({ success: false, message: 'Invalid import mode' });

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'No items to import' });
    }
    if (items.length > 5000 || items.some(item => !item || typeof item !== 'object')) return res.status(400).json({ success: false, message: 'Invalid import data' });
    items = await resolveAnimeIds(items);

    // Deduplicate incoming items based on animeId to prevent copied/duplicate bookmarks
    const uniqueItemsMap = new Map();
    items.forEach(item => {
      const sAnimeId = String(item.animeId);
      if (sAnimeId && sAnimeId !== 'undefined' && sAnimeId !== 'null') {
        // If duplicate exists, keep the one with higher progress
        if (uniqueItemsMap.has(sAnimeId)) {
          const existing = uniqueItemsMap.get(sAnimeId);
          if ((item.progress || 0) > (existing.progress || 0)) {
            uniqueItemsMap.set(sAnimeId, item);
          }
        } else {
          uniqueItemsMap.set(sAnimeId, item);
        }
      }
    });
    const uniqueItems = Array.from(uniqueItemsMap.values());
    const validation = new User({ watchlist: uniqueItems.map(item => ({ ...item, title: item.title || `Anime ${item.animeId}` })) }).validateSync('watchlist');
    if (validation) throw validation;

    if (mode === "Replace") {
        const formattedItems = uniqueItems.map(item => ({
            animeId: String(item.animeId),
            idMal: item.idMal,
            title: item.title || `Anime ${item.animeId}`,
            coverImage: item.coverImage || '',
            status: item.status || 'Planning',
            progress: item.progress || 0,
            score: item.score || 0,
            addedAt: Date.now()
        }));

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { $set: { watchlist: formattedItems } },
            { new: true, runValidators: true }
        );

        return res.status(200).json({
            success: true,
            message: 'Watchlist replaced',
            watchlist: updatedUser.watchlist
        });
    }

    const operations = uniqueItems.flatMap(item => {
      const animeId = String(item.animeId);
      const values = { 'watchlist.$[entry].addedAt': new Date() };
      for (const field of ['status', 'idMal', 'coverImage', 'title']) if (item[field]) values[`watchlist.$[entry].${field}`] = item[field];
      const maximum = {};
      if (item.progress !== undefined) maximum['watchlist.$[entry].progress'] = Number(item.progress);
      if (Number(item.score) > 0) values['watchlist.$[entry].score'] = Number(item.score);
      return [
        { updateOne: { filter: { _id: req.user._id, 'watchlist.animeId': animeId }, update: { $set: values, ...(Object.keys(maximum).length ? { $max: maximum } : {}) }, arrayFilters: [{ 'entry.animeId': animeId }] } },
        { updateOne: { filter: { _id: req.user._id, 'watchlist.animeId': { $ne: animeId } }, update: { $push: { watchlist: { animeId, idMal: item.idMal, title: item.title || `Anime ${animeId}`, coverImage: item.coverImage || '', status: item.status || 'Planning', progress: item.progress || 0, score: item.score || 0, addedAt: new Date() } } } } },
      ];
    });
    if (operations.length) await User.bulkWrite(operations, { ordered: true });
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.status(200).json({
      success: true,
      message: 'Watchlist merged',
      watchlist: user.watchlist
    });
  } catch (error) {
    console.error("Bulk import error:", error);
    res.status(error.status || (error.name === 'ValidationError' ? 400 : 502)).json({ success: false, message: error.status ? error.message : 'Watchlist import failed' });
  }
};

// @desc    Clear entire watchlist
export const clearWatchlist = async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { watchlist: [] } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Watchlist cleared successfully',
      watchlist: []
    });
  } catch (error) {
    console.error("Clear watchlist error:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const exportMAL = async (req, res) => {
  try {
    const items = await resolveAnimeIds(req.user.watchlist.map(item => item.toObject()), 'MAL');
    res.json({ success: true, items });
  } catch (error) { res.status(error.status || 502).json({ success: false, message: error.message }); }
};
