/* =============================================================
   Kasir -- katalog barang + keranjang belanja (drawer) + bayar Cash / QRIS.
   Pengaturan di index.html: APP_CONFIG.kasir. Butuh dashboard.js (app.trx.post).
   QRIS: tidak ada verifikasi ke penyedia pembayaran; kasir mengonfirmasi manual.
   ============================================================= */
(() => {
  /* CSS disisipkan dari sini supaya halaman tidak bergantung pada versi style.css yang ter-deploy. */
  if (!document.getElementById('css-kasir')) document.head.appendChild(Object.assign(document.createElement('style'), { id: 'css-kasir', textContent: `
/* ---- Kasir ---- */
.kasir-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;}
.kasir-bar input[type=search]{flex:1;min-width:160px;padding:7px 10px;border:1px solid var(--line);border-radius:var(--radius-sm,3px);}
.catalog{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;}
.prod{background:var(--white);border:1px solid var(--line);border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:6px;}
.prod h3{margin:0;font-size:14px;color:var(--blue-900);}
.prod-meta{margin:0;font-size:12px;color:var(--ink-soft);}
.prod .btn{margin-top:auto;justify-content:center;}
.prod .btn:disabled{opacity:.5;cursor:not-allowed;}
.cart-line{display:flex;justify-content:space-between;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--blue-100);}
.cart-qty{display:flex;align-items:center;gap:4px;}
.cart-qty .btn{padding:4px 10px;}
.cart-qty span{min-width:24px;text-align:center;}
.cart-total{display:flex;justify-content:space-between;font-size:16px;margin:12px 0;}
.pay-opts{display:flex;gap:16px;}
.pay-opt{display:inline-flex;align-items:center;gap:6px;cursor:pointer;}
.qris-box{text-align:center;border:1px dashed var(--blue-500);border-radius:6px;padding:12px;margin-top:8px;}
.qris-box img{max-width:220px;width:100%;}
.qris-ph{width:180px;height:180px;margin:0 auto;display:flex;align-items:center;justify-content:center;background:var(--blue-100);color:var(--blue-900);border-radius:6px;}
` }));
  const $ = id => document.getElementById(id), D = k => app.model.data[k] || [], esc = app.view.escapeHtml;
  const K = () => app.model.cfg.kasir || {}, rp = v => app.trx.rp(v), metodes = () => K().pembayaran || ['Cash', 'QRIS'];
  const st = { lokasi: '', q: '', kat: '', cart: {}, kontak: '', metode: '', bayar: '', qrisOk: false };

  const lokasiList = () => D('lokasi').filter(l => l.jenis === (K().lokasiJenis || 'Toko'));
  const stokDi = kode => Number(D('stok').find(s => s.kode === kode && s.lokasi === st.lokasi)?.stok) || 0;
  const lines = () => Object.entries(st.cart).map(([kode, banyak]) => {
    const b = D('barang').find(x => x.kode === kode);
    return b && banyak > 0 ? { kode, nama: b.nama, banyak, harga: b.harga } : null;
  }).filter(Boolean);
  const total = () => lines().reduce((s, l) => s + l.banyak * l.harga, 0);
  const count = () => lines().reduce((s, l) => s + l.banyak, 0);
  const opt = (v, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(v)}</option>`;

  /* ---------- Halaman katalog ---------- */
  const pageHtml = () => {
    if (!st.lokasi) st.lokasi = lokasiList()[0]?.nama || '';
    return `<div class="kasir-bar">
      <label for="kasir_lokasi">Lokasi</label><select id="kasir_lokasi">${lokasiList().map(l => opt(l.nama, st.lokasi)).join('')}</select>
      <input type="search" id="kasir_q" placeholder="Cari nama / kode barang" value="${esc(st.q)}" aria-label="Cari barang">
      <select id="kasir_kat" aria-label="Kategori"><option value="">Semua kategori</option>${[...new Set(D('barang').map(b => b.kategori))].map(c => opt(c, st.kat)).join('')}</select>
      <button type="button" class="btn btn-primary" id="kasir_open"></button></div>
      <div class="catalog" id="kasir_grid"></div>`;
  };
  const gridHtml = () => {
    const q = st.q.trim().toLowerCase();
    return D('barang').filter(b => (!st.kat || b.kategori === st.kat) && (!q || `${b.nama} ${b.kode}`.toLowerCase().includes(q))).map(b => {
      const s = stokDi(b.kode), n = st.cart[b.kode] || 0;
      return `<article class="prod"><h3>${esc(b.nama)}</h3><p class="prod-meta">${esc(b.kode)} · ${esc(b.kategori)}</p>
        <strong>${rp(b.harga)}</strong><p class="prod-meta">Stok: ${s} ${esc(b.satuan)}</p>
        <button type="button" class="btn" data-add="${esc(b.kode)}"${n >= s ? ' disabled' : ''}>${n ? `+ Tambah (${n})` : '+ Keranjang'}</button></article>`;
    }).join('') || '<p class="chart-empty">Barang tidak ditemukan.</p>';
  };
  const refresh = () => {
    if (!$('kasir_grid')) return;
    $('kasir_grid').innerHTML = gridHtml();
    $('kasir_open').textContent = `Keranjang (${count()}) - ${rp(total())}`;
  };

  const prev = app.view.renderPage;
  app.view.renderPage = function(){
    prev.call(this);   // dashboard.js sudah mengatur tampilan #dash
    const on = app.model.active === 'kasir', cb = document.querySelector('.content-body');
    let el = $('kasir');
    if (!el){ el = Object.assign(document.createElement('div'), { id: 'kasir' }); cb.appendChild(el); }
    if (on){
      [...cb.children].forEach(c => { if (c !== el && c.id !== 'notice') c.style.display = 'none'; });
      el.innerHTML = pageHtml(); refresh();
    }
    el.style.display = on ? '' : 'none';
  };

  /* ---------- Drawer keranjang ---------- */
  const kembali = () => Math.max(0, (Number(st.bayar) || 0) - total());
  const cartBody = () => {
    const ls = lines(), T = total(), ms = metodes(), cust = D('kontak').filter(k => k.jenis === 'Customer'), q = K().qris || {};
    st.metode ||= ms[0]; st.kontak ||= cust[0]?.nama || '';
    const btn = (a, kode, t, label) => `<button type="button" class="btn" data-cart="${a}" data-kode="${esc(kode)}" aria-label="${label}">${t}</button>`;
    return `${ls.length ? ls.map(l => `<div class="cart-line"><div><strong>${esc(l.nama)}</strong><br><small>${rp(l.harga)} x ${l.banyak} = ${rp(l.harga * l.banyak)}</small></div>
        <div class="cart-qty">${btn('dec', l.kode, '-', 'Kurangi')}<span>${l.banyak}</span>${btn('inc', l.kode, '+', 'Tambah')}${btn('del', l.kode, '&times;', 'Hapus')}</div></div>`).join('')
        : '<p class="chart-empty">Keranjang kosong. Pilih barang dari katalog.</p>'}
      <p class="cart-total">Total <strong>${rp(T)}</strong></p>
      <div class="field-group"><label for="cart_kontak">Customer</label><select id="cart_kontak">${cust.map(c => opt(c.nama, st.kontak)).join('')}</select></div>
      <div class="field-group"><label>Pembayaran</label><div class="pay-opts">${ms.map(m => `<label class="pay-opt"><input type="radio" name="metode" value="${esc(m)}"${m === st.metode ? ' checked' : ''}> ${esc(m)}</label>`).join('')}</div></div>
      <div id="pay_Cash" class="field-group"${st.metode === 'Cash' ? '' : ' hidden'}><label for="cart_bayar">Uang diterima</label>
        <input type="number" id="cart_bayar" min="0" step="any" value="${esc(st.bayar)}"><p id="cart_kembali" class="auth-hint">Kembalian: ${rp(kembali())}</p></div>
      <div id="pay_QRIS" class="qris-box"${st.metode === 'QRIS' ? '' : ' hidden'}>
        ${q.image ? `<img src="${esc(q.image)}" alt="QRIS ${esc(q.merchant || '')}">` : '<div class="qris-ph">QRIS toko<br><small>isi kasir.qris.image di index.html</small></div>'}
        <p><strong>${esc(q.merchant || '')}</strong><br>Nominal: ${rp(T)}</p>
        <label class="pay-opt"><input type="checkbox" id="qris_ok"${st.qrisOk ? ' checked' : ''}> Pembayaran QRIS sudah diterima</label></div>`;
  };
  app.view.DRAWERS.cart = { title: () => 'Keranjang Belanja', submit: 'Bayar', aux: () => ({ label: 'Kosongkan', danger: true }), body: cartBody };
  const redrawCart = () => { $('drawerBody').innerHTML = cartBody(); refresh(); };

  async function checkout(){
    const err = app.view.showFormError, ls = lines(), T = total();
    if (!(D('akses').find(x => x.kode === app.model.session?.grup)?.modul || '').includes('pos')) return err('Grup Anda tidak punya akses modul POS.');
    if (!ls.length) return err('Keranjang masih kosong.');
    if (st.metode === 'Cash' && !(Number(st.bayar) >= T)) return err('Uang diterima kurang dari total.');
    if (st.metode === 'QRIS' && !st.qrisOk) return err('Centang konfirmasi bahwa pembayaran QRIS sudah diterima.');
    const r = await app.trx.post({ jenis: 'Jual', lokasi: st.lokasi, kontak: st.kontak, lines: ls, pembayaran: st.metode });
    if (r.error) return err(r.error);
    const msg = `${r.invoice} lunas via ${st.metode}: ${rp(r.total)}${st.metode === 'Cash' ? `, kembalian ${rp(kembali())}` : ''}.`;
    Object.assign(st, { cart: {}, bayar: '', qrisOk: false });
    app.view.closeDrawer(); refresh(); app.view.notify(msg);
  }
  app.controller.drawerHandlers.cart = { submit: checkout, aux: () => { st.cart = {}; redrawCart(); } };

  /* ---------- Event (delegasi) ---------- */
  document.addEventListener('click', e => {
    const add = e.target.closest('[data-add]'), c = e.target.closest('[data-cart]');
    if (add){ const k = add.dataset.add; if ((st.cart[k] || 0) < stokDi(k)) st.cart[k] = (st.cart[k] || 0) + 1; refresh(); }
    else if (c){
      const k = c.dataset.kode, n = st.cart[k] || 0;
      st.cart[k] = c.dataset.cart === 'del' ? 0 : c.dataset.cart === 'inc' ? Math.min(n + 1, stokDi(k)) : Math.max(n - 1, 0);
      redrawCart();
    }
    else if (e.target.closest('#kasir_open')) app.view.openDrawer('cart', {});
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'kasir_lokasi'){ st.lokasi = t.value; st.cart = {}; refresh(); }   // stok beda per lokasi
    else if (t.id === 'kasir_kat'){ st.kat = t.value; refresh(); }
    else if (t.id === 'cart_kontak') st.kontak = t.value;
    else if (t.id === 'qris_ok') st.qrisOk = t.checked;
    else if (t.name === 'metode'){
      st.metode = t.value;
      metodes().forEach(m => { const p = $('pay_' + m); if (p) p.hidden = m !== st.metode; });
    }
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'kasir_q'){ st.q = e.target.value; refresh(); }
    else if (e.target.id === 'cart_bayar'){ st.bayar = e.target.value; $('cart_kembali').textContent = `Kembalian: ${rp(kembali())}`; }
  });
})();
