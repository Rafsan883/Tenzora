import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import process from 'node:process';

function cookieValue(cookieHeader, name) {
  if (typeof cookieHeader !== 'string') return null;
  const item = cookieHeader.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  if (!item) return null;
  try { return decodeURIComponent(item.slice(name.length + 1)); } catch { return null; }
}

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user || req.user.isBot || (decoded.ver || 0) !== (req.user.tokenVersion || 0)) {
        return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
      }
      if (req.user.banUntil && req.user.banUntil > new Date() && !['GET', 'HEAD'].includes(req.method)) {
        return res.status(403).json({ success: false, message: 'Your account is temporarily restricted.' });
      }

      if (req.user) {
        // Use updateOne to avoid full document save and versioning conflicts
        await User.updateOne({ _id: req.user._id }, { $set: { lastActive: Date.now() } });
      }

      next();
    } catch (error) {
      console.error("[AuthMiddleware] Token failure:", error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else if ((token = cookieValue(req.headers.cookie, 'tenzora_session'))) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user || req.user.isBot || (decoded.ver || 0) !== (req.user.tokenVersion || 0)) {
        return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
      }
      if (req.user.banUntil && req.user.banUntil > new Date() && !['GET', 'HEAD'].includes(req.method)) {
        return res.status(403).json({ success: false, message: 'Your account is temporarily restricted.' });
      }

      await User.updateOne({ _id: req.user._id }, { $set: { lastActive: Date.now() } });
      return next();
    } catch (error) {
      console.error('[AuthMiddleware] Cookie token failure:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

export const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Not authorized as an admin' });
  }
};

// Cron authentication — validates CRON_SECRET from CF Worker scheduled triggers
export const cronAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[CronAuth] CRON_SECRET not configured in environment');
    return res.status(500).json({ success: false, message: 'Cron secret not configured' });
  }

  if (!authHeader || !authHeader.startsWith('Bearer')) {
    return res.status(401).json({ success: false, message: 'No cron authorization' });
  }

  const token = authHeader.split(' ')[1];
  if (token !== cronSecret) {
    console.warn('[CronAuth] Invalid cron secret received');
    return res.status(403).json({ success: false, message: 'Invalid cron secret' });
  }

  next();
};
