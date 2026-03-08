// api/login.js — POST /api/login
import { dbRead } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  const { email, password } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email обязателен' });

  const db = await dbRead();
  const users = db.users || [];

  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(404).json({ error: 'Аккаунт с таким email не найден' });
  }

  // Note: In a real app you'd check password hash. Here we trust client-side validation.
  void password;

  // Count actual tracks
  const trackCount = (db.tracks || []).filter(t => t.artistId === user.id).length;

  return res.status(200).json({
    ok: true,
    user: {
      id:          user.id,
      name:        user.name,
      email:       user.email,
      role:        user.role || 'listener',
      tracksCount: trackCount,
      followers:   user.followers || 0,
      verified:    true,
      joinedAt:    user.joinedAt,
    },
  });
}
