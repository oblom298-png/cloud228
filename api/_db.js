// api/_db.js — Universal persistent storage
// - Local / Railway: writes to data/db.json file
// - Vercel: uses Upstash Redis REST API (set env vars KV_REST_API_URL + KV_REST_API_TOKEN)
//           OR falls back to in-process global (works within single warm instance)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL_ENV != null;
const UPSTASH_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const USE_UPSTASH   = IS_VERCEL && UPSTASH_URL && UPSTASH_TOKEN;

// ─── File-based store (local / Railway) ──────────────────────────────────────
let __dataDir, __dbFile;
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname  = dirname(__filename);
  __dataDir = join(__dirname, '..', 'data');
  __dbFile  = join(__dataDir, 'db.json');
} catch { /* ignore */ }

function fileRead() {
  try {
    if (!existsSync(__dbFile)) return null;
    return JSON.parse(readFileSync(__dbFile, 'utf8'));
  } catch { return null; }
}

function fileWrite(data) {
  try {
    if (!existsSync(__dataDir)) mkdirSync(__dataDir, { recursive: true });
    writeFileSync(__dbFile, JSON.stringify(data, null, 2));
  } catch (e) { console.error('[DB] fileWrite error:', e.message); }
}

// ─── Upstash REST helpers ─────────────────────────────────────────────────────
const REDIS_KEY = 'claudmusic_db';

async function upstashGet() {
  try {
    const res = await fetch(`${UPSTASH_URL}/get/${REDIS_KEY}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    const json = await res.json();
    if (!json.result) return null;
    return JSON.parse(json.result);
  } catch (e) { console.error('[DB] upstashGet error:', e.message); return null; }
}

async function upstashSet(data) {
  try {
    const encoded = encodeURIComponent(JSON.stringify(data));
    await fetch(`${UPSTASH_URL}/set/${REDIS_KEY}?EX=2592000`, {  // expire 30 days
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(JSON.stringify(data)),  // Upstash expects JSON string body
    });
    void encoded;
  } catch (e) { console.error('[DB] upstashSet error:', e.message); }
}

// ─── In-memory fallback (single Vercel instance, warm) ───────────────────────
function getGlobal() {
  if (!global.__cm_store) {
    global.__cm_store = { tracks: [], users: [], ts: Date.now() };
  }
  return global.__cm_store;
}

function setGlobal(data) {
  global.__cm_store = { ...data, ts: Date.now() };
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function dbRead() {
  if (USE_UPSTASH) {
    const data = await upstashGet();
    if (data) { setGlobal(data); return data; }
    return getGlobal();
  }
  if (!IS_VERCEL) {
    // Local / Railway — use file
    const data = fileRead();
    if (data) { setGlobal(data); return data; }
    return getGlobal();
  }
  // Vercel without Upstash — in-memory only
  return getGlobal();
}

export async function dbWrite(data) {
  setGlobal(data);
  if (USE_UPSTASH) {
    await upstashSet(data);
    return;
  }
  if (!IS_VERCEL) {
    fileWrite(data);
  }
  // Vercel without Upstash: only in-memory (data lost on cold start)
}

export function dbReadSync() {
  if (!IS_VERCEL) {
    const data = fileRead();
    if (data) { setGlobal(data); return data; }
  }
  return getGlobal();
}

export function dbWriteSync(data) {
  setGlobal(data);
  if (!IS_VERCEL) fileWrite(data);
}

export const isVercel = IS_VERCEL;
export const hasUpstash = USE_UPSTASH;
