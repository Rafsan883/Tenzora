import express from 'express';
import { getRecommendations } from '../controllers/aiController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, getRecommendations);

export default router;
