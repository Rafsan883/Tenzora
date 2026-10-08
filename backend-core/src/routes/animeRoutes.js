import express from 'express';
import { animeSchedule, browseAnime, searchAnime } from '../controllers/animeController.js';

const router = express.Router();

router.get('/browse', browseAnime);
router.get('/search', searchAnime);
router.get('/schedule', animeSchedule);

export default router;
