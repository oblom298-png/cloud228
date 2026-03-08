// api/register.js — POST /api/register
import { dbRead, dbWrite } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  const { user } = req.body || {};
  if (!user?.id || !user?.name || !user?.email) {
    return res.status(400).json({ error: 'Неверные данные' });
  }

  const db = await dbRead();
  if (!db.users) db.users = [];
  if (!db.tracks) db.tracks = [];

  // Check name uniqueness
  const nameTaken = db.users.some(
    u => u.name.trim().toLowerCase() === user.name.trim().toLowerCase()
  );
  if (nameTaken) {
    return res.status(409).json({ error: `Имя «${user.name}» уже занято` });
  }

  // Check email uniqueness
  const emailTaken = db.users.some(
    u => u.email.toLowerCase() === user.email.toLowerCase()
  );
  if (emailTaken) {
    return res.status(409).json({ error: 'Email уже зарегистрирован' });
  }

  const newUser = {
    id:          user.id,
    name:        user.name.trim(),
    email:       user.email.toLowerCase(),
    role:        user.role || 'listener',
    tracksCount: 0,
    followers:   0,
    verified:    true,
    joinedAt:    user.joinedAt || new Date().toLocaleDateString('ru-RU'),
    _followers:  [],
  };

  db.users.push(newUser);
  db.ts = Date.now();
  await dbWrite(db);

  console.log(`[REGISTER] ${newUser.name} (${newUser.role}) <${newUser.email}>`);
  return res.status(200).json({ ok: true, user: newUser });
}
