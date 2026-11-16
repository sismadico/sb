// Pemakaian: node worker/seed.mjs > seed.sql && wrangler d1 execute sb-db --remote --file=seed.sql
// Membaca ../*.json sebagai data awal. Password awal diacak per user dan dicetak ke STDERR (ganti lewat Profil).
import { readFileSync } from 'node:fs'; import { pbkdf2Sync, randomBytes } from 'node:crypto';
const q = s => `'${String(s).replace(/'/g, "''")}'`, dir = new URL('../', import.meta.url);
const keys = ['users','setting','akses','barang','distribusi','lokasi','stok','transaksi','item_transaksi','kontak','akun','jurnal','laporan','landing'];
for (const k of keys) console.log(`INSERT OR REPLACE INTO dataset(key,rows) VALUES(${q(k)},${q(JSON.stringify(JSON.parse(readFileSync(new URL(`${k}.json`, dir)))))});`);
for (const u of JSON.parse(readFileSync(new URL('users.json', dir)))) {
  const pw = randomBytes(6).toString('base64url'), h = pbkdf2Sync(pw, u.username, 100000, 32, 'sha256').toString('hex');
  console.log(`INSERT OR REPLACE INTO cred(username,hash) VALUES(${q(u.username)},${q(h)});`); console.error(`${u.username}: ${pw}`);
}
