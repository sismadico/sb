/* Worker API untuk mode online (apiBase '/api'). Respons: { ok, data } / { ok:false, error:{message} }.
   PERHATIAN: app.js belum mengirim token, jadi endpoint dataset TIDAK terautentikasi.
   Lindungi dengan Cloudflare Access / rute internal sebelum dipakai publik. */
const KEYS = ['users', 'setting', 'akses', 'barang', 'distribusi', 'lokasi', 'stok', 'transaksi', 'item_transaksi', 'kontak', 'akun', 'jurnal', 'laporan', 'landing', 'dashboard'];
const out = (data, status = 200) => new Response(JSON.stringify(status < 400 ? { ok: true, data } : { ok: false, error: { message: data } }),
  { status, headers: { 'Content-Type': 'application/json' } });
const hash = async (u, pw) => {   // PBKDF2-SHA256, salt = username (sama dengan seed.mjs)
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const b = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(u), iterations: 100000 }, k, 256);
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
};
const json = async req => { try { return await req.json(); } catch { return null; } };

export default {
  async fetch(req, env) {
    const { pathname } = new URL(req.url), p = pathname.replace(/^\/api\/?/, '').split('/'), db = env.DB;
    if (!pathname.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(req) : out('Not found', 404);

    if (p[0] === 'auth' && req.method === 'POST' && p[1] === 'login') {
      const b = await json(req), u = String(b?.username || '').toLowerCase();
      const users = JSON.parse((await db.prepare('SELECT rows FROM dataset WHERE key=?').bind('users').first())?.rows || '[]');
      const user = users.find(r => String(r.username).toLowerCase() === u), c = await db.prepare('SELECT hash FROM cred WHERE username=?').bind(u).first();
      if (!user || user.status !== 'aktif' || !c || c.hash !== await hash(u, String(b?.password || ''))) return out('Username atau password salah.', 401);
      const prof = await db.prepare('SELECT nama, foto FROM profile WHERE username=?').bind(u).first() || {};
      return out({ username: u, nama: prof.nama || user.nama, grup: user.grup, foto: prof.foto || '' });
    }
    if (p[0] === 'auth' && req.method === 'PUT' && p[1] === 'profile') {
      const b = await json(req); if (!b?.username) return out('Data tidak valid.', 400);
      await db.prepare('INSERT INTO profile(username,nama,foto) VALUES(?,?,?) ON CONFLICT(username) DO UPDATE SET nama=excluded.nama, foto=excluded.foto')
        .bind(b.username, String(b.nama || ''), String(b.foto || '')).run();
      return out({ nama: b.nama, foto: b.foto || '' });
    }
    if (p[0] === 'auth' && req.method === 'POST' && p[1] === 'password') {
      const b = await json(req), u = String(b?.username || '').toLowerCase(), c = await db.prepare('SELECT hash FROM cred WHERE username=?').bind(u).first();
      if (!c || c.hash !== await hash(u, String(b.oldPassword || ''))) return out('Password lama salah.', 401);
      if (String(b.newPassword || '').length < 6) return out('Password baru minimal 6 karakter.', 400);
      await db.prepare('UPDATE cred SET hash=? WHERE username=?').bind(await hash(u, b.newPassword), u).run();
      return out({ changed: true });
    }

    if (KEYS.includes(p[0]) && p.length === 1) {
      if (req.method === 'GET') {
        const r = await db.prepare('SELECT rows FROM dataset WHERE key=?').bind(p[0]).first();
        return out(r ? JSON.parse(r.rows) : []);
      }
      if (req.method === 'PUT') {
        const rows = await json(req), text = JSON.stringify(rows);
        if (!Array.isArray(rows) || !rows.every(r => r && typeof r === 'object')) return out('Body harus array objek.', 400);
        if (text.length > 1_500_000) return out('Dataset terlalu besar (maks ~1,5 MB).', 413);
        await db.prepare('INSERT INTO dataset(key,rows) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET rows=excluded.rows, updated_at=CURRENT_TIMESTAMP').bind(p[0], text).run();
        return out(rows);
      }
    }
    return out('Endpoint tidak ditemukan.', 404);
  }
};
