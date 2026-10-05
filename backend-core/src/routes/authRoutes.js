import express from 'express';
const router = express.Router();
import { register, login, googleLogin, getMe, updateMe, forgotPassword, resetPassword, connectAnilist, anilistCallback, disconnectAnilist, syncAnilistLibrary, confirmEmailChange } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import rateLimit from 'express-rate-limit';
import { verifyTurnstile } from '../middleware/turnstileMiddleware.js';

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
router.use(['/register', '/login', '/google', '/forgot-password', '/reset-password'], authLimiter);

router.post('/register', verifyTurnstile, register);
router.post('/login', verifyTurnstile, login);
router.post('/google', verifyTurnstile, googleLogin);
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
router.post('/email/confirm', protect, confirmEmailChange);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// AniList OAuth
router.post('/anilist', protect, connectAnilist);
router.get('/anilist/callback', anilistCallback);
router.post('/anilist/disconnect', protect, disconnectAnilist);
router.post('/anilist/sync', protect, syncAnilistLibrary);

export default router;
