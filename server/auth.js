// Password hashing (scrypt) and session tokens, using only Node's crypto module
const crypto = require('node:crypto');
const { db } = require('./db');

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64);
  const real = Buffer.from(hash, 'hex');
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .run(token, userId, Date.now() + SESSION_TTL_MS);
  return token;
}

function getUserFromToken(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id, u.name, u.email, u.phone, u.city, u.created_at, s.expires_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ?`).get(token);
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  delete row.expires_at;
  return row;
}

function destroySession(token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

module.exports = { hashPassword, verifyPassword, createSession, getUserFromToken, destroySession };
