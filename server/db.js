// SQLite database (Node's built-in node:sqlite, no npm packages needed)
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = process.env.SDUSELL_DATA || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'sdusell.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone         TEXT,
  city          TEXT,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS listings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  search_text TEXT NOT NULL DEFAULT '',        -- lowercased title+description (JS lowercasing handles Cyrillic; SQLite LIKE does not)
  price       INTEGER NOT NULL DEFAULT 0,      -- in tenge (KZT)
  category    TEXT NOT NULL,
  city        TEXT NOT NULL,
  condition   TEXT NOT NULL DEFAULT 'used',    -- new | used
  negotiable  INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active',  -- active | sold
  views       INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_city     ON listings(city);
CREATE INDEX IF NOT EXISTS idx_listings_user     ON listings(user_id);
CREATE INDEX IF NOT EXISTS idx_images_listing    ON images(listing_id);
`);

const CATEGORIES = [
  'Electronics', 'Transport', 'Fashion', 'Home & Garden',
  'Kids', 'Sports & Hobbies', 'Books & Study', 'Services', 'Other',
];

const CITIES = [
  'Almaty', 'Astana', 'Shymkent', 'Karaganda', 'Aktobe', 'Taraz', 'Pavlodar',
  'Oskemen', 'Semey', 'Atyrau', 'Kostanay', 'Kyzylorda', 'Oral', 'Petropavl',
  'Aktau', 'Temirtau', 'Turkistan', 'Kokshetau', 'Taldykorgan', 'Ekibastuz',
  'Kaskelen',
];

module.exports = { db, DATA_DIR, CATEGORIES, CITIES };
