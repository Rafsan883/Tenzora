import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { MongoMemoryServer } from 'mongodb-memory-server';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sibling = process.env.ANIVEXA_DIR || resolve(root, '../Anivexa-API');
process.env.MONGOMS_DOWNLOAD_DIR ||= resolve(tmpdir(), 'anixo-mongodb');
const mongo = await MongoMemoryServer.create({ instance: { dbName: 'anixo_local_preview', ip: '127.0.0.1' } });
const { default: mongoose } = await import('../backend-core/node_modules/mongoose/index.js');
const { default: User } = await import('../backend-core/src/models/User.js');
await mongoose.connect(mongo.getUri());
await User.create({ username: 'preview_admin', profileId: 'localadmin', email: 'preview.admin@gmail.com', password: 'LocalPreview123!', role: 'admin', displayName: 'Local Preview Admin' });
await mongoose.disconnect();
const env = {
  ...process.env,
  NODE_ENV: 'development', LOCAL_PREVIEW: 'true',
  HOST: '127.0.0.1',
  MONGO_URI: mongo.getUri(), MONGODB_URI: mongo.getUri(),
  JWT_SECRET: randomBytes(32).toString('hex'),
  INTERNAL_SERVICE_SECRET: randomBytes(32).toString('hex'),
  CRON_SECRET: randomBytes(32).toString('hex'),
  FRONTEND_URL: 'http://localhost:5173',
  ONLINE_SERVER_URL: 'http://127.0.0.1:7861',
  VITE_BACKEND_API: '', VITE_PYTHON_API: 'http://localhost:7860',
  VITE_ANIKO_SERVER_API: 'http://localhost:4001', VITE_ANIKO_API: 'http://localhost:4001',
  VITE_PROXY_URL: 'http://localhost:4001/api/proxy',
  VITE_MEGAPLAY_URL: 'https://megaplay.buzz',
  VITE_CHAT_API: 'http://localhost:8080', VITE_COMMENT_API_URL: 'http://localhost:4000',
  VITE_ONLINE_SERVER_URL: 'http://localhost:7861',
  VITE_WATCH2GETHER_API: 'http://localhost:8081', VITE_WT_API: 'http://localhost:8081',
  GROQ_API_KEY: '', ANILIST_CLIENT_ID: '', ANILIST_CLIENT_SECRET: '',
  GOOGLE_CLIENT_ID: '', VITE_GOOGLE_CLIENT_ID: '',
  TURNSTILE_SECRET_KEY: '', VITE_TURNSTILE_SITE_KEY: '', BOT_TOKEN: '', TMDB_TOKEN: '',
  EMAIL_HOST: '', EMAIL_USER: '', EMAIL_PASS: '', REPORT_WEBHOOK: '',
};
const children = [];
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  await mongo.stop();
  process.exit(code);
}
function start(name, command, args, cwd, extra = {}) {
  const child = spawn(command, args, { cwd, env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => process.stdout.write(`[${name}] ${data}`));
  child.on('error', error => { console.error(`${name}: ${error.message}`); void stop(1); });
  child.on('exit', code => { if (!stopping) { console.error(`${name} exited (${code})`); void stop(1); } });
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());

start('backend', process.execPath, ['src/server.js'], resolve(root, 'backend-core'), { PORT: '5001' });
start('comments', process.execPath, ['server.js'], resolve(root, 'comment-service'), { PORT: '4000', COMMENT_PORT: '4000' });
start('chat', process.execPath, ['server.js'], resolve(root, 'chat-service'), { PORT: '8080', CHAT_PORT: '8080' });
start('presence', process.execPath, ['server.js'], resolve(root, 'online-server'), { PORT: '7861' });
start('watch-together', process.execPath, ['server.js'], resolve(root, 'watch2gether-service'), { PORT: '8081', WT_PORT: '8081' });
start('stream-api', process.execPath, ['server.js'], sibling, { PORT: '4001' });
const python = process.env.PYTHON_BINARY || resolve(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
start('metadata', python, ['-B', 'api/index.py'], root, { PORT: '7860', FLASK_DEBUG: '0' });
start('frontend', process.execPath, ['node_modules/vite/bin/vite.js'], root);
const readiness = [
  ['frontend', 5173, '/home'], ['backend', 5001, '/health'],
  ['comments', 4000, '/health'], ['chat', 8080, '/health'],
  ['presence', 7861, '/health'], ['watch-together', 8081, '/health'],
  ['metadata', 7860, '/health'], ['stream-api', 4001, '/docs'],
];
await Promise.all(readiness.map(async ([name, port, path]) => {
  const until = Date.now() + 120000;
  while (Date.now() < until) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(2000) });
      await response.body?.cancel();
      if (response.ok) return;
    } catch { /* Service may still be loading its modules. */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.error(`${name} did not become ready within two minutes.`);
  await stop(1);
}));
console.log('\nLocal preview: http://localhost:5173\nStreaming API: http://localhost:4001/docs\nDatabase: isolated local preview (no deployed data is used).\n');
