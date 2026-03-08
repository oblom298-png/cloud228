// api/track.js — POST /api/track (upload track metadata)
import { dbRead, dbWrite } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  const { track } = req.body || {};
  if (!track?.id || !track?.title) {
    return res.status(400).json({ error: 'track.id и track.title обязательны' });
  }

  const db = await dbRead();
  if (!db.tracks) db.tracks = [];
  if (!db.users)  db.users  = [];

  // Strip audio blob URLs and large data — server only stores metadata
  const saved = {
    ...track,
    audioUrl:    undefined,  // never store blob URLs on server
    coverImage:  track.coverImage || undefined,  // store cover as dataURL (small images only)
    _likedBy:    [],
    _repostedBy: [],
  };

  // Limit coverImage size to ~500KB
  if (saved.coverImage && saved.coverImage.length > 700000) {
    saved.coverImage = undefined;
  }

  const alreadyExists = db.tracks.some(t => t.id === saved.id);
  if (!alreadyExists) {
    db.tracks.unshift(saved);

    // Update artist track count
    const uIdx = db.users.findIndex(u => u.id === track.artistId);
    if (uIdx !== -1) {
      db.users[uIdx].tracksCount = (db.users[uIdx].tracksCount || 0) + 1;
    }

    db.ts = Date.now();
    await dbWrite(db);
    console.log(`[TRACK] "${track.title}" by ${track.artist}`);
  }

  return res.status(200).json({ ok: true });
}
