/* =============================================================
   Landing page -- dirender dari dataset `landing` (+ barang & setting).
   Tampil sebagai halaman pertama sebelum login (tanpa sesi / setelah logout);
   tombol "Masuk" membuka modal login bawaan. Konten diubah di Master > Landing.
   Kolom dataset: bagian (hero|slide|fitur|katalog|kontak|footer), urutan, judul,
   isi, ikon, gambar, tombol, tautan ('masuk' = buka login, atau URL), aktif (ya|tidak).
   bagian 'slide': gambar (path relatif / URL / data:image), judul & isi = teks keterangan.
   ============================================================= */
(() => {
  /* CSS disisipkan dari sini supaya halaman tidak bergantung pada versi style.css yang ter-deploy. */
  if (!document.getElementById('css-landing')) document.head.appendChild(Object.assign(document.createElement('style'), { id: 'css-landing', textContent: `
/* ---- Landing page ---- */
.landing{position:fixed;inset:0;z-index:90;overflow:auto;background:var(--blue-50);display:none;}
.lp-nav{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 24px;background:linear-gradient(var(--blue-500),var(--blue-700));color:var(--white);font-size:20px;}
.lp-hero{text-align:center;padding:64px 20px;background:linear-gradient(var(--blue-100),var(--blue-300));}
.lp-hero h1{margin:0 0 12px;font-size:clamp(28px,5vw,44px);color:var(--blue-900);}
.lp-hero p{margin:0 auto 22px;max-width:560px;font-size:17px;color:var(--ink-soft);}
.lp-sec{max-width:1000px;margin:0 auto;padding:32px 20px;}
.lp-sec h2{margin:0 0 6px;color:var(--blue-900);}
.lp-lead{margin:0 0 16px;color:var(--ink-soft);}
.lp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;}
.lp-card{background:var(--white);border:1px solid var(--line);border-radius:6px;padding:16px;display:flex;flex-direction:column;gap:6px;}
.lp-card h3{margin:0;font-size:16px;color:var(--blue-900);}
.lp-card p{margin:0;color:var(--ink-soft);font-size:14px;}
.lp-ico{font-size:28px;}
.lp-foot{text-align:center;padding:24px;color:var(--ink-soft);font-size:13px;border-top:1px solid var(--line);}
` }));
  const $ = id => document.getElementById(id), D = k => app.model.data[k] || [], esc = app.view.escapeHtml;
  const rp = v => 'Rp ' + app.view.formatValue(v);
  const safe = u => /^(https?:\/\/|#|\/|mailto:|tel:)/i.test(String(u || '').trim()) ? String(u).trim() : '#';   // tolak javascript: dsb.
  const imgSrc = u => /^(https?:\/\/|data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,]|[\w./-]+$)/i.test(String(u || '').trim()) ? String(u).trim() : '';
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
      ${part('slide').length ? `<section class="lp-sec"><div class="lp-slider" id="lp_slider" role="region" aria-roledescription="carousel" aria-label="Galeri">
        ${part('slide').map((s, i) => `<figure class="lp-slide${i ? '' : ' on'}" aria-hidden="${i !== 0}"><img src="${esc(imgSrc(s.gambar))}" alt="${esc(s.judul)}"><figcaption><strong>${esc(s.judul)}</strong><span>${esc(s.isi)}</span></figcaption></figure>`).join('')}
        ${part('slide').length > 1 ? `<button type="button" class="lp-arrow prev" data-slide="-1" aria-label="Slide sebelumnya">&lsaquo;</button><button type="button" class="lp-arrow next" data-slide="1" aria-label="Slide berikutnya">&rsaquo;</button>
        <div class="lp-dots">${part('slide').map((_, i) => `<button type="button" data-dot="${i}" class="${i ? '' : 'on'}" aria-label="Slide ${i + 1}"></button>`).join('')}</div>` : ''}
      </div></section>` : ''}
      ${part('fitur').length ? `<section class="lp-sec"><div class="lp-grid">${part('fitur').map(f =>
        `<article class="lp-card"><span class="lp-ico" aria-hidden="true">${esc(f.ikon)}</span><h3>${esc(f.judul)}</h3><p>${esc(f.isi)}</p></article>`).join('')}</div></section>` : ''}
      ${part('katalog').map(r => sec(r, `<div class="lp-grid">${D('barang').slice(0, 8).map(b =>
        `<article class="lp-card"><h3>${esc(b.nama)}</h3><p class="prod-meta">${esc(b.kategori)}</p><strong>${rp(b.harga)}</strong>
         <p class="prod-meta">${Number(b.stok) > 0 ? 'Tersedia' : 'Habis'}</p></article>`).join('')}</div>`)).join('')}
      ${part('kontak').map(r => sec(r, '')).join('')}
      <footer class="lp-foot">${esc(part('footer')[0]?.isi || '')}</footer>`;
  };

  /* Slider: otomatis tiap 5 detik, jeda saat disorot/fokus, mati bila pengguna memilih kurangi gerak. */
  let preview = false, skip = false, idx = 0, timer = null;
  const stop = () => { clearInterval(timer); timer = null; };
  const show = n => {
    const el = $('lp_slider'), s = el ? [...el.querySelectorAll('.lp-slide')] : [];
    if (!s.length) return;
    idx = (n + s.length) % s.length;
    s.forEach((x, i) => { x.classList.toggle('on', i === idx); x.setAttribute('aria-hidden', String(i !== idx)); });
    el.querySelectorAll('[data-dot]').forEach((d, i) => d.classList.toggle('on', i === idx));
  };
  const play = () => { stop(); if ($('lp_slider') && !matchMedia('(prefers-reduced-motion: reduce)').matches) timer = setInterval(() => show(idx + 1), 5000); };
  const open = p => {
    preview = p;
    const el = $('landing') || Object.assign(document.body.appendChild(document.createElement('div')), { id: 'landing', className: 'landing' });
    el.innerHTML = html(p); el.style.display = 'block'; el.scrollTop = 0; idx = 0;
    const sl = $('lp_slider');
    if (sl){ sl.onmouseenter = sl.onfocusin = stop; sl.onmouseleave = sl.onfocusout = play; play(); }
  };
  const close = () => { stop(); if ($('landing')) $('landing').style.display = 'none'; };

  /* Tanpa sesi / setelah logout: landing dulu, baru login. */
  const origLogin = app.view.showLogin;
  app.view.showLogin = function(){
    if (skip || !part('hero').length){ skip = false; return origLogin.call(this); }
    open(false);
  };
  document.addEventListener('click', e => {
    const sw = e.target.closest('[data-slide],[data-dot]');
    if (sw){ show(sw.dataset.dot !== undefined ? Number(sw.dataset.dot) : idx + Number(sw.dataset.slide)); return; }
    const a = e.target.closest('[data-lp]');
    if (a){ close(); if (a.dataset.lp === 'masuk' && !preview){ skip = true; app.view.showLogin(); } return; }
    if (e.target.closest('#lp_preview')) open(true);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && preview) close();
    if ($('landing')?.style.display === 'block' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) show(idx + (e.key === 'ArrowRight' ? 1 : -1));
  });

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
