import express from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const Ticket = mongoose.models.SupportTicket || mongoose.model('SupportTicket', new mongoose.Schema({
  type: { type: String, enum: ['contact', 'report'], required: true },
  name: { type: String, maxlength: 100 }, email: { type: String, maxlength: 254 },
  subject: { type: String, maxlength: 200 }, message: { type: String, maxlength: 5000 },
  animeId: String, episode: Number, server: Number, issues: [String],
}, { timestamps: true }));
const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
router.post('/contact', limiter, async (req, res) => {
  const { name, email, subject, message } = req.body;
  if ([name, email, subject, message].some(v => typeof v !== 'string' || !v.trim()) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, message: 'Please provide a name, valid email, subject, and message.' });
  try {
    const ticket = await Ticket.create({ type: 'contact', name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() });
    res.status(201).json({ success: true, id: ticket.id, message: 'Message received.' });
  } catch (error) { res.status(error.name === 'ValidationError' ? 400 : 500).json({ success: false, message: 'Message could not be saved.' }); }
});
router.post('/reports', limiter, async (req, res) => {
  const { animeId, episode, server, issues, message = '' } = req.body;
  if (!/^\d+$/.test(String(animeId)) || !Number.isInteger(episode) || episode < 1 || !Array.isArray(issues) || issues.length > 10 || issues.some(v => typeof v !== 'string' || v.length > 100) || (!issues.length && !message) || typeof message !== 'string') return res.status(400).json({ success: false, message: 'Please describe the episode problem.' });
  try {
    const ticket = await Ticket.create({ type: 'report', animeId: String(animeId), episode, server, issues, message });
    res.status(201).json({ success: true, id: ticket.id });
  } catch (error) { res.status(error.name === 'ValidationError' ? 400 : 500).json({ success: false, message: 'Report could not be saved.' }); }
});
router.get('/support/tickets', protect, adminOnly, async (_req, res) => {
  try { res.json({ success: true, tickets: await Ticket.find().sort({ createdAt: -1 }).limit(100) }); }
  catch { res.status(500).json({ success: false, message: 'Could not load tickets.' }); }
});
export default router;
