// api/health.js — GET /api/health
import { dbRead, isVercel, hasUpstash } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  const db = await dbRead();
  res.status(200).json({
    ok:        true,
    ts:        Date.now(),
    env:       isVercel ? 'vercel' : 'local',
    storage:   hasUpstash ? 'upstash-redis' : (isVercel ? 'in-memory' : 'file'),
    tracks:    (db.tracks || []).length,
    users:     (db.users  || []).length,
  });
}
