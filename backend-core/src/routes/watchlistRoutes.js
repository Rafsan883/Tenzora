import express from 'express';
import { getWatchlist, addToWatchlist, removeFromWatchlist, bulkImport, clearWatchlist } from '../controllers/watchlistController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
router.get('/export/mal', protect, async (req, res) => {
  const { exportMAL } = await import('../controllers/watchlistController.js');
  return exportMAL(req, res);
});

router.use(protect);

router.route('/')
  .get(getWatchlist);

router.route('/add')
  .post(addToWatchlist);

router.route('/remove/:animeId')
  .delete(removeFromWatchlist);

router.route('/import')
  .post(bulkImport);

router.route('/clear')
  .delete(clearWatchlist);

export default router;
