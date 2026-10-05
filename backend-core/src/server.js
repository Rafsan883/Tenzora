import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import process from 'node:process';
import app from './app.js';
import connectDB from './config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file if it exists (local dev). On HF/Vercel, env vars are injected by the platform.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
await connectDB();

const PORT = process.env.PORT || 5001;

app.listen(PORT, process.env.HOST || '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});


