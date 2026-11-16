/* =============================================================
   Landing page -- dirender dari dataset `landing` (+ barang & setting).
   Tampil sebagai halaman pertama sebelum login (tanpa sesi / setelah logout);
   tombol "Masuk" membuka modal login bawaan. Konten diubah di Master > Landing.
   Kolom dataset: bagian (hero|fitur|katalog|kontak|footer), urutan, judul,
   isi, ikon, tombol, tautan ('masuk' = buka login, atau URL), aktif (ya|tidak).
   ============================================================= */
(() => {
  const $ = id => document.getElementById(id), D = k => app.model.data[k] || [], esc = app.view.escapeHtml;
  const rp = v => 'Rp ' + app.view.formatValue(v);
  const safe = u => /^(https?:\/\/|#|\/|mailto:|tel:)/i.test(String(u || '').trim()) ? String(u).trim() : '#';   // tolak javascript: dsb.
  const part = b => D('landing').filter(r => r.bagian === b && String(r.aktif || 'ya') !== 'tidak')
    .sort((x, y) => (Number(x.urutan) || 0) - (Number(y.urutan) || 0));

  const html = preview => {
    const brand = D('setting').find(s => s.kode === 'NAMA_TOKO')?.nilai || app.model.cfg.brand;
    const link = r => r.tautan === 'masuk' || !r.tautan
      ? `<button type="button" class="btn btn-primary" data-lp="masuk">${esc(r.tombol)}</button>`
      : `<a class="btn btn-primary" href="${esc(safe(r.tautan))}">${esc(r.tombol)}</a>`;
    const hero = part('hero')[0], sec = (r, body) => `<section class="lp-sec"><h2>${esc(r.judul)}</h2>${r.isi ? `<p class="lp-lead">${esc(r.isi)}</p>` : ''}${body}</section>`;
    return `
      <header class="lp-nav"><strong>${esc(brand)}</strong>
        ${preview ? '<button type="button" class="btn" data-lp="tutup">Tutup Pratinjau</button>' : '<button type="button" class="btn" data-lp="masuk">Masuk</button>'}</header>
      ${hero ? `<section class="lp-hero"><h1>${esc(hero.judul)}</h1><p>${esc(hero.isi)}</p>${hero.tombol ? link(hero) : ''}</section>` : ''}
      ${part('fitur').length ? `<section class="lp-sec"><div class="lp-grid">${part('fitur').map(f =>
        `<article class="lp-card"><span class="lp-ico" aria-hidden="true">${esc(f.ikon)}</span><h3>${esc(f.judul)}</h3><p>${esc(f.isi)}</p></article>`).join('')}</div></section>` : ''}
      ${part('katalog').map(r => sec(r, `<div class="lp-grid">${D('barang').slice(0, 8).map(b =>
        `<article class="lp-card"><h3>${esc(b.nama)}</h3><p class="prod-meta">${esc(b.kategori)}</p><strong>${rp(b.harga)}</strong>
         <p class="prod-meta">${Number(b.stok) > 0 ? 'Tersedia' : 'Habis'}</p></article>`).join('')}</div>`)).join('')}
      ${part('kontak').map(r => sec(r, '')).join('')}
      <footer class="lp-foot">${esc(part('footer')[0]?.isi || '')}</footer>`;
  };

  let preview = false, skip = false;
  const open = p => {
    preview = p;
    const el = $('landing') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'landing', className: 'landing' });
    el.innerHTML = html(p); el.style.display = 'block'; el.scrollTop = 0;
  };
  const close = () => { if ($('landing')) $('landing').style.display = 'none'; };

  /* Tanpa sesi / setelah logout: landing dulu, baru login. */
  const origLogin = app.view.showLogin;
  app.view.showLogin = function(){
    if (skip || !part('hero').length){ skip = false; return origLogin.call(this); }
    open(false);
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-lp]');
    if (a){ close(); if (a.dataset.lp === 'masuk' && !preview){ skip = true; app.view.showLogin(); } return; }
    if (e.target.closest('#lp_preview')) open(true);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && preview) close(); });

  /* Tombol pratinjau hanya di menu Landing. */
  const prev = app.view.renderPage;
  app.view.renderPage = function(){
    prev.call(this);
    let b = $('lp_preview');
    if (!b){
      b = Object.assign(document.createElement('button'), { type: 'button', className: 'btn', id: 'lp_preview', textContent: 'Pratinjau Landing' });
      document.querySelector('.table-actions').prepend(b);
    }
    b.hidden = app.model.active !== 'landing';
  };
})();
