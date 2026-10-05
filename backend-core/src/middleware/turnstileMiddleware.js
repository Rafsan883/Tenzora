export async function verifyTurnstile(req, res, next) {
  const secret = req.env?.TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return next();
  const token = req.body.turnstileToken;
  if (typeof token !== 'string' || !token || token.length > 2048) return res.status(400).json({ success: false, message: 'Please complete the verification challenge.' });
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret, response: token, remoteip: req.ip }), signal: AbortSignal.timeout(10000) });
    const result = await response.json();
    if (!response.ok || !result.success) return res.status(400).json({ success: false, message: 'Verification failed. Please try again.' });
    return next();
  } catch { return res.status(503).json({ success: false, message: 'Verification is temporarily unavailable.' }); }
}
