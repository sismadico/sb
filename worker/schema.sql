-- D1: dataset disimpan sebagai array JSON per kunci (cocok dengan PUT /api/<key> milik app.js)
CREATE TABLE IF NOT EXISTS dataset (key TEXT PRIMARY KEY, rows TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS cred    (username TEXT PRIMARY KEY, hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS profile (username TEXT PRIMARY KEY, nama TEXT, foto TEXT);
