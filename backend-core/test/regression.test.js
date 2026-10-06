import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import sendEmail from '../src/utils/sendEmail.js';

let mongo, server, base, User;
before(async () => {
  process.env.MONGOMS_DOWNLOAD_DIR ||= '/tmp/omnirush/mongodb-binaries';
  mongo = await MongoMemoryServer.create();
  Object.assign(process.env, { MONGO_URI: mongo.getUri(), JWT_SECRET: randomBytes(32).toString('hex'), NODE_ENV: 'development', LOCAL_PREVIEW: 'true', TURNSTILE_SECRET_KEY: '', FRONTEND_URL: 'http://localhost:5173' });
  ({ default: User } = await import('../src/models/User.js'));
  const { default: app } = await import('../src/app.js');
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  await mongo?.stop();
});
async function request(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, data: await response.json() };
}
let sequence = 0;
function environment(t, values) {
  for (const [key, value] of Object.entries(values)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
}
async function account() {
  const name = `testuser_${++sequence}`;
  const body = { username: name, email: `${name}@gmail.com`, password: 'Initial123!' };
  const result = await request('/auth/register', { method: 'POST', body });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return { ...result.data, email: body.email, password: body.password };
}

test('registration hashes once and /auth/me has stable identity without secrets', async () => {
  const user = await account();
  const login = await request('/auth/login', { method: 'POST', body: { email: user.email, password: user.password } });
  assert.equal(login.status, 200);
  const stored = await User.findById(user.user.id);
  assert.notEqual(stored.password, user.password);
  assert.equal(await stored.matchPassword(user.password), true);
  const profile = await request('/auth/me', { token: login.data.token });
  assert.equal(profile.data.user.id, user.user.id);
  for (const key of ['password', 'tokenVersion', 'resetPasswordToken', 'anilistOAuthState']) assert.equal(key in profile.data.user, false);
});
test('username uniqueness is case insensitive and malformed registration is rejected', async () => {
  const user = await account();
  const duplicate = await request('/auth/register', { method: 'POST', body: { username: user.user.username.toUpperCase(), email: 'duplicate@gmail.com', password: 'Initial123!' } });
  assert.equal(duplicate.status, 409);
  assert.equal((await request('/auth/register', { method: 'POST', body: { username: 'bad name', email: 'bad@gmail.com', password: 'Initial123!' } })).status, 400);
});
test('profile saves without rehashing and password changes revoke previous JWTs', async t => {
  t.mock.method(axios, 'post', async () => ({ data: {} }));
  const user = await account();
  assert.equal((await request('/auth/me', { method: 'PUT', token: user.token, body: { displayName: 'Updated Name' } })).status, 200);
  const changed = await request('/auth/me', { method: 'PUT', token: user.token, body: { currentPassword: user.password, password: 'Replacement123!' } });
  assert.equal(changed.status, 200, JSON.stringify(changed.data));
  assert.ok(changed.data.token);
  assert.equal((await request('/auth/me', { token: user.token })).status, 401);
  assert.equal((await request('/auth/me', { token: changed.data.token })).status, 200);
  assert.equal((await request('/auth/login', { method: 'POST', body: { email: user.email, password: 'Replacement123!' } })).status, 200);
});
test('recovery rejects short passwords, consumes reset token, and revokes sessions', async () => {
  const user = await account();
  const recovery = await request('/auth/forgot-password', { method: 'POST', body: { email: user.email } });
  assert.equal(recovery.status, 200);
  const resetToken = recovery.data.resetUrl.split('/').pop();
  const path = `/auth/reset-password/${resetToken}`;
  assert.equal((await request(path, { method: 'POST', body: { password: 'x' } })).status, 400);
  assert.equal((await request(path, { method: 'POST', body: { password: 'Recovered123!' } })).status, 200);
  assert.equal((await request(path, { method: 'POST', body: { password: 'Recovered123!' } })).status, 400);
  assert.equal((await request('/auth/me', { token: user.token })).status, 401);
});
test('email delivery uses the Resend HTTPS API', async t => {
  environment(t, { RESEND_API_KEY: 're_test_key', RESEND_FROM: 'TenZora <onboarding@resend.dev>' });
  let requestDetails;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requestDetails = { url, options, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({ id: 'email_test_id' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  const result = await sendEmail({
    email: 'recipient@example.com',
    subject: 'Test message',
    message: 'Plain text body',
    html: '<p>HTML body</p>',
  });

  assert.deepEqual(result, { id: 'email_test_id' });
  assert.equal(requestDetails.url, 'https://api.resend.com/emails');
  assert.equal(requestDetails.options.headers.Authorization, 'Bearer re_test_key');
  assert.deepEqual(requestDetails.body, {
    from: 'TenZora <onboarding@resend.dev>',
    to: ['recipient@example.com'],
    subject: 'Test message',
    text: 'Plain text body',
    html: '<p>HTML body</p>',
  });
});
test('email changes require reauthentication and bot accounts cannot log in', async () => {
  const user = await account();
  assert.equal((await request('/auth/me', { method: 'PUT', token: user.token, body: { email: 'different@gmail.com' } })).status, 401);
  await User.updateOne({ _id: user.user.id }, { $set: { isBot: true } });
  assert.equal((await request('/auth/login', { method: 'POST', body: { email: user.email, password: user.password } })).status, 401);
});
test('watchlist additions are deduplicated under concurrent requests and validated', async () => {
  const user = await account();
  const options = { method: 'POST', token: user.token, body: { animeId: '1', title: 'Cowboy Bebop', status: 'Watching' } };
  const responses = await Promise.all(Array.from({ length: 5 }, () => request('/watchlist/add', options)));
  assert.ok(responses.every(result => result.status === 200));
  const list = await request('/watchlist', { token: user.token });
  assert.equal(list.data.watchlist.length, 1);
  assert.equal((await request('/watchlist/add', { ...options, body: { ...options.body, score: 100 } })).status, 400);
});
test('MAL import maps namespace and export maps back; failed replacement preserves library', async t => {
  t.mock.method(axios, 'post', async (_url, payload) => ({ data: { data: { m0: payload.query.includes('idMal: 20') ? { id: 1735, idMal: 20 } : null } } }));
  const user = await account();
  const imported = await request('/watchlist/import', { method: 'POST', token: user.token, body: { mode: 'Replace', items: [{ animeId: '20', idSource: 'MAL', title: 'Mapped anime' }] } });
  assert.equal(imported.status, 200, JSON.stringify(imported.data));
  assert.equal(imported.data.watchlist[0].animeId, '1735');
  assert.equal(imported.data.watchlist[0].idMal, 20);
  const exported = await request('/watchlist/export/mal', { token: user.token });
  assert.equal(exported.data.items[0].animeId, '20');
  assert.equal(exported.data.items[0].idSource, 'MAL');
  assert.equal((await request('/watchlist/import', { method: 'POST', token: user.token, body: { mode: 'Replace', items: [{ animeId: '999', idSource: 'MAL', title: 'Unmapped' }] } })).status, 422);
  assert.equal((await request('/watchlist', { token: user.token })).data.watchlist[0].animeId, '1735');
});
test('progress separates MAL and AniList IDs and rejects invalid times', async () => {
  const user = await account();
  for (const isMAL of [false, true]) {
    const result = await request('/progress/save', { method: 'POST', token: user.token, body: { animeId: '20', isMAL, episode: 1, currentTime: 12, duration: 120 } });
    assert.equal(result.status, 200, JSON.stringify(result.data));
  }
  const progress = await request('/progress', { token: user.token });
  assert.deepEqual(progress.data.continueWatching.map(item => item.animeId).sort(), ['20', 'mal:20']);
  assert.equal((await request('/progress/save', { method: 'POST', token: user.token, body: { animeId: '20', episode: 0, currentTime: -1 } })).status, 400);
});
test('active bans block writes, deleted accounts cannot use JWTs, OAuth requires authentication', async () => {
  const user = await account();
  await User.updateOne({ _id: user.user.id }, { $set: { banUntil: new Date(Date.now() + 60000) } });
  assert.equal((await request('/watchlist/add', { method: 'POST', token: user.token, body: { animeId: '1', title: 'Blocked' } })).status, 403);
  assert.equal((await request('/auth/me', { token: user.token })).status, 200);
  assert.equal((await request('/auth/anilist', { method: 'POST' })).status, 401);
  await User.deleteOne({ _id: user.user.id });
  assert.equal((await request('/auth/me', { token: user.token })).status, 401);
});
test('email change remains pending until one-time verification and rotates the JWT', async t => {
  t.mock.method(axios, 'post', async () => ({ data: {} }));
  const user = await account();
  const email = 'verified_new@gmail.com';
  const pending = await request('/auth/me', { method: 'PUT', token: user.token, body: { email, currentPassword: user.password } });
  assert.equal(pending.status, 200, JSON.stringify(pending.data));
  assert.equal(pending.data.user.email, user.email);
  assert.equal(pending.data.user.pendingEmail, email);
  assert.equal('emailChangeToken' in pending.data.user, false);
  const token = pending.data.emailVerificationUrl.split('/').pop();
  const verified = await request('/auth/email/confirm', { method: 'POST', token: user.token, body: { token } });
  assert.equal(verified.status, 200, JSON.stringify(verified.data));
  assert.equal(verified.data.user.email, email);
  assert.equal((await request('/auth/me', { token: user.token })).status, 401);
  assert.equal((await request('/auth/email/confirm', { method: 'POST', token: verified.data.token, body: { token } })).status, 400);
});
test('concurrent imports merge atomically and invalid imports do not partially update', async () => {
  const user = await account();
  const imported = await Promise.all([1, 2, 3].map(id => request('/watchlist/import', { method: 'POST', token: user.token, body: { mode: 'Merge', items: [{ animeId: String(id), title: `Anime ${id}` }] } })));
  assert.ok(imported.every(result => result.status === 200), JSON.stringify(imported));
  assert.equal((await request('/watchlist', { token: user.token })).data.watchlist.length, 3);
  assert.equal((await request('/watchlist/import', { method: 'POST', token: user.token, body: { mode: 'Merge', items: [{ animeId: '4', title: 'Valid' }, { animeId: '5', title: 'Invalid', score: -1 }] } })).status, 400);
  assert.equal((await request('/watchlist', { token: user.token })).data.watchlist.length, 3);
});

test('Google-created accounts hash plaintext once and reject unverified identities', async t => {
  environment(t, { GOOGLE_CLIENT_ID: 'test-google-client' });
  const originalFetch = globalThis.fetch;
  let verified = true;
  t.mock.method(globalThis, 'fetch', async (url, options) => String(url).startsWith('https://oauth2.googleapis.com/')
    ? Response.json({ aud: 'test-google-client', email: 'google_test@gmail.com', name: 'Google Test', email_verified: verified })
    : originalFetch(url, options));
  const originalHash = bcrypt.hash;
  const plaintexts = [];
  t.mock.method(bcrypt, 'hash', async (password, ...args) => {
    assert.doesNotMatch(password, /^\$2[aby]\$/);
    plaintexts.push(password);
    return originalHash(password, ...args);
  });
  const created = await request('/auth/google', { method: 'POST', body: { token: 'test-google-token' } });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  assert.equal(plaintexts.length, 1);
  assert.equal(await (await User.findById(created.data.user.id)).matchPassword(plaintexts[0]), true);
  assert.equal((await request('/auth/me', { token: created.data.token })).status, 200);
  verified = false;
  assert.equal((await request('/auth/google', { method: 'POST', body: { token: 'test-google-token' } })).status, 401);
});

test('AniList OAuth binds hashed expiring state to the initiating account and consumes it once', async t => {
  environment(t, { ANILIST_CLIENT_ID: 'test-anilist-client', ANILIST_CLIENT_SECRET: 'test-anilist-secret', ANILIST_REDIRECT_URI: `${base}/auth/anilist/callback` });
  const owner = await account();
  const other = await account();
  const start = await request('/auth/anilist', { method: 'POST', token: owner.token, body: { userId: other.user.id } });
  assert.equal(start.status, 200);
  const state = new URL(start.data.url).searchParams.get('state');
  const stored = await User.findById(owner.user.id);
  assert.notEqual(stored.anilistOAuthState, state);
  assert.ok(stored.anilistOAuthExpire > new Date());
  assert.equal((await User.findById(other.user.id)).anilistOAuthState, undefined);
  let exchanges = 0;
  t.mock.method(axios, 'post', async url => {
    if (url === 'https://anilist.co/api/v2/oauth/token') {
      exchanges++;
      return { data: { access_token: 'test-only-access-token' } };
    }
    return { data: { data: { Viewer: { id: 123, name: 'AniList Test', avatar: {} } } } };
  });
  const callback = value => fetch(`${base}/auth/anilist/callback?code=test-code&state=${value}`, { redirect: 'manual' });
  assert.match((await callback(other.user.id)).headers.get('location'), /anilist_invalid_state/);
  assert.match((await callback(state)).headers.get('location'), /anilist_connected/);
  assert.match((await callback(state)).headers.get('location'), /anilist_invalid_state/);
  assert.equal(exchanges, 1);
  assert.equal((await User.findById(owner.user.id)).anilist.id, 123);
  assert.equal((await User.findById(other.user.id)).anilist?.id, undefined);
  const pending = await request('/auth/anilist', { method: 'POST', token: owner.token });
  const expiredState = new URL(pending.data.url).searchParams.get('state');
  await User.updateOne({ _id: owner.user.id }, { $set: { anilistOAuthExpire: new Date(0) } });
  assert.match((await callback(expiredState)).headers.get('location'), /anilist_invalid_state/);
  assert.equal(exchanges, 1);
});
