/* =============================================================
   Dashboard terpadu -- ekstensi app (MVCS), app.js tidak diubah.
   - Menu "Dashboard": KPI + grafik terpadu (barang, lokasi/distribusi,
     transaksi, kontak, finance, laporan) dihitung langsung dari dataset.
   - Tombol "Transaksi Kasir": satu aksi menulis ke SEMUA dataset terkait:
     transaksi + item_transaksi + stok per lokasi + barang + jurnal + laporan.
   ============================================================= */
(() => {
  /* CSS disisipkan dari sini supaya halaman tidak bergantung pada versi style.css yang ter-deploy. */
  if (!document.getElementById('css-dashboard')) document.head.appendChild(Object.assign(document.createElement('style'), { id: 'css-dashboard', textContent: `
/* ---- Dashboard terpadu ---- */
.dash-top{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;margin-bottom:14px;}
.dash-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;flex:1;min-width:260px;}
.kpi{background:var(--white);border:1px solid var(--line);border-radius:4px;padding:10px 12px;display:flex;flex-direction:column;gap:4px;}
.kpi span{font-size:12px;color:var(--ink-soft);}
.kpi strong{font-size:17px;color:var(--blue-900);}
.dash-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:14px;margin-bottom:14px;}
.dash-card{margin:0;min-width:0;}
.dash-sub{margin:16px 0 8px;font-size:15px;color:var(--blue-900);}
.trx-line{display:grid;grid-template-columns:1fr 80px;gap:6px;margin-bottom:6px;}
.dash-filter{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;font-size:13px;}
.dash-note{color:var(--ink-soft);font-size:12px;}
` }));
  const $ = id => document.getElementById(id), D = k => app.model.data[k] || [];
  const esc = app.view.escapeHtml, fmt = app.view.formatValue, rp = v => 'Rp ' + fmt(v);
  const sum = (rows, f) => rows.reduce((s, r) => s + (Number(f(r)) || 0), 0);
  let periode = '';   // '' = semua; atau 'YYYY-MM'
  const inP = r => !periode || String(r.tanggal).slice(0, 7) === periode;
  const periods = () => [...new Set([...D('transaksi'), ...D('jurnal'), ...D('distribusi')].map(r => String(r.tanggal).slice(0, 7)).filter(Boolean))].sort().reverse();
  const KAS = ['Kas', 'Bank QRIS'];   // akun kas & bank (QRIS) dihitung sebagai kas
  const maxId = rows => Math.max(0, ...rows.map(r => Number(r.id) || 0));
  const group = (rows, by, val) => {
    const g = new Map();
    rows.forEach(r => { const k = r[by] || '(kosong)'; g.set(k, (g.get(k) || 0) + (val ? Number(val(r)) || 0 : 1)); });
    return [...g].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };

  /* ---------- Model: angka turunan ---------- */
  const laporan = () => {   // laporan kas per periode, dihitung dari jurnal
    const p = new Map();
    D('jurnal').filter(r => KAS.includes(r.akun)).forEach(r => {
      const k = String(r.tanggal).slice(0, 7), x = p.get(k) || { periode: k, kategori: 'Semua', masuk: 0, keluar: 0, saldo: 0 };
      x.masuk += Number(r.debit) || 0; x.keluar += Number(r.kredit) || 0; x.saldo = x.masuk - x.keluar; p.set(k, x);
    });
    return [...p.values()].sort((a, b) => a.periode.localeCompare(b.periode));
  };
  const kpis = () => {
    const trx = D('transaksi').filter(t => t.status !== 'Batal' && inP(t)), harga = Object.fromEntries(D('barang').map(b => [b.kode, b.harga]));
    return [
      ['Penjualan', rp(sum(trx.filter(t => t.jenis === 'Jual'), t => t.total))],
      ['Pembelian', rp(sum(trx.filter(t => t.jenis === 'Beli'), t => t.total))],
      [periode ? 'Mutasi Kas & Bank' : 'Saldo Kas & Bank', rp(sum(D('jurnal').filter(r => KAS.includes(r.akun) && inP(r)), r => r.debit - r.kredit))],
      ['Nilai Persediaan', rp(sum(D('stok'), s => s.stok * (harga[s.kode] || 0)))],
      ['Total Stok', fmt(sum(D('stok'), s => s.stok))],
      ['Transaksi', fmt(trx.length)]
    ];
  };

  /* ---------- View: dashboard ---------- */
  const bar = p => p.length ? app.view.barChartSvg(p) : '<p class="chart-empty">Belum ada data.</p>';
  const pie = p => p.length ? app.view.pieChartSvg(p) : '<p class="chart-empty">Belum ada data.</p>';
  const card = (t, body) => `<section class="panel dash-card"><h2 class="panel-head">${t}</h2><div class="chart-body">${body}</div></section>`;
  const table = (cols, rows) => `<div class="table-wrap"><table><thead><tr>${cols.map(c => `<th>${c[1]}</th>`).join('')}</tr></thead><tbody>${
    rows.map(r => `<tr>${cols.map(c => `<td>${esc(c[2] ? fmt(r[c[0]]) : r[c[0]])}</td>`).join('')}</tr>`).join('') || '<tr class="empty-row"><td colspan="9">Belum ada data.</td></tr>'}</tbody></table></div>`;

  const dashHtml = () => {
    const trx = D('transaksi').filter(t => t.status !== 'Batal' && inP(t)), jur = D('jurnal').filter(inP), dist = D('distribusi').filter(inP),
      lap = laporan().filter(x => !periode || x.periode === periode), lapT = [
      { label: 'Kas Masuk', value: sum(lap, x => x.masuk) }, { label: 'Kas Keluar', value: sum(lap, x => x.keluar) }];
    return `
      <div class="dash-filter"><label for="dash_periode">Periode</label>
        <select id="dash_periode"><option value="">Semua periode</option>${periods().map(p => `<option value="${p}"${p === periode ? ' selected' : ''}>${p}</option>`).join('')}</select>
        <span class="dash-note">Filter berlaku untuk transaksi, distribusi, jurnal, dan laporan. Stok adalah posisi terkini.</span></div>
      <div class="dash-top"><div class="dash-kpis">${kpis().map(([k, v]) => `<div class="kpi"><span>${k}</span><strong>${v}</strong></div>`).join('')}</div>
        <button type="button" class="btn btn-primary" data-trx>+ Transaksi Kasir</button></div>
      <div class="dash-grid">
        ${card('Barang: Stok per Barang', bar(group(D('barang'), 'nama', b => b.stok)))}
        ${card('Barang: Stok per Kategori', pie(group(D('barang'), 'kategori', b => b.stok)))}
        ${card('Lokasi: Stok per Lokasi', bar(group(D('stok'), 'lokasi', s => s.stok)))}
        ${card('Distribusi Keluar (dari)', bar(group(dist, 'dari', d => d.banyak)))}
        ${card('Distribusi Masuk (ke)', bar(group(dist, 'ke', d => d.banyak)))}
        ${card('Transaksi: Jual vs Beli', pie(group(trx, 'jenis', t => t.total)))}
        ${card('Penjualan per Customer', bar(group(trx.filter(t => t.jenis === 'Jual'), 'kontak', t => t.total)))}
        ${card('Pembelian per Vendor', bar(group(trx.filter(t => t.jenis === 'Beli'), 'kontak', t => t.total)))}
        ${card('Kontak per Jenis', pie(group(D('kontak'), 'jenis')))}
        ${card('User per Grup', pie(group(D('users'), 'grup')))}
        ${card('Finance: Mutasi per Akun', bar(group(jur, 'akun', r => Number(r.debit) + Number(r.kredit))))}
        ${card('Laporan: Kas Masuk vs Keluar', pie(lapT))}
      </div>
      <h3 class="dash-sub">Laporan Kas per Periode</h3>
      ${table([['periode', 'Periode'], ['masuk', 'Masuk', 1], ['keluar', 'Keluar', 1], ['saldo', 'Saldo', 1]], lap)}
      <h3 class="dash-sub">Transaksi Terbaru</h3>
      ${table([['invoice', 'Invoice'], ['tanggal', 'Tanggal'], ['jenis', 'Jenis'], ['kontak', 'Kontak'], ['kasir', 'Kasir'], ['lokasi', 'Lokasi'], ['total', 'Total', 1], ['status', 'Status']],
        D('transaksi').filter(inP).sort((a, b) => String(b.tanggal).localeCompare(a.tanggal) || String(b.invoice).localeCompare(a.invoice)).slice(0, 8))}`;
  };

  const sync = () => {   // tampilkan #dash hanya di menu dashboard; sisanya tetap konten tabel bawaan
    const on = app.model.active === 'dashboard', cb = document.querySelector('.content-body');
    let el = $('dash');
    if (!el){ el = Object.assign(document.createElement('div'), { id: 'dash' }); cb.appendChild(el); }
    [...cb.children].forEach(c => { if (c !== el && c.id !== 'notice') c.style.display = on ? 'none' : ''; });
    el.style.display = on ? '' : 'none';
    if (on) el.innerHTML = dashHtml();
  };
  const origRender = app.view.renderPage;
  app.view.renderPage = function(){ origRender.call(this); sync(); };

  /* ---------- Drawer: transaksi kasir ---------- */
  const lokOpts = j => D('lokasi').map(l => `<option value="${esc(l.nama)}"${l.jenis === (j === 'Jual' ? 'Toko' : 'Gudang') ? ' selected' : ''}>${esc(l.nama)} (${esc(l.jenis)})</option>`).join('');
  const kontakOpts = j => D('kontak').filter(k => k.jenis === (j === 'Jual' ? 'Customer' : 'Vendor')).map(k => `<option value="${esc(k.nama)}">${esc(k.nama)}</option>`).join('');
  const lineHtml = i => `<div class="trx-line"><select name="kode_${i}">${D('barang').map(b => `<option value="${esc(b.kode)}">${esc(b.nama)} - ${rp(b.harga)}</option>`).join('')}</select>
    <input type="number" name="qty_${i}" min="0" step="any" placeholder="Qty" value="${i === 0 ? 1 : ''}" aria-label="Qty baris ${i + 1}"></div>`;

  app.view.DRAWERS.trx = {
    title: () => 'Transaksi Kasir', submit: 'Simpan Transaksi', aux: () => null,
    body: () => `
      <div class="field-group"><label for="trx_jenis">Jenis</label><select id="trx_jenis" name="jenis"><option>Jual</option><option>Beli</option></select></div>
      <div class="field-group"><label for="trx_kasir">Kasir (user)</label><input type="text" id="trx_kasir" name="kasir" value="${esc(app.model.session?.nama || '')}" readonly></div>
      <div class="field-group"><label for="trx_kontak">Kontak (customer / vendor)</label><select id="trx_kontak" name="kontak">${kontakOpts('Jual')}</select></div>
      <div class="field-group"><label for="trx_lokasi">Lokasi terdampak</label><select id="trx_lokasi" name="lokasi">${lokOpts('Jual')}</select></div>
      <div class="field-group"><label>Keranjang (isi qty &gt; 0; baris kosong dilewati)</label>${[0, 1, 2, 3].map(lineHtml).join('')}</div>
      <p class="auth-hint">Jual: stok lokasi berkurang, Kas (D) / Penjualan (K). Beli: stok bertambah, Persediaan (D) / Kas (K).</p>`
  };

  const put = async (key, rows) => { app.model.data[key] = rows; await app.services.save(key, rows); };

  /* Inti transaksi (dipakai form Jual/Beli dan Kasir): cek stok per lokasi, lalu tulis semua dataset terkait. */
  async function post({ jenis, lokasi, kontak, lines, pembayaran = 'Cash' }){
    if (!kontak) return { error: `Belum ada kontak ${jenis === 'Jual' ? 'Customer' : 'Vendor'}. Tambahkan di menu Kontak.` };
    const need = {}, sign = jenis === 'Jual' ? -1 : 1, stok = D('stok').map(s => ({ ...s }));
    lines.forEach(l => need[l.kode] = (need[l.kode] || 0) + l.banyak);
    for (const [kode, q] of Object.entries(need)){
      let s = stok.find(x => x.kode === kode && x.lokasi === lokasi);
      if (!s){ s = { id: maxId(stok) + 1, kode, lokasi, stok: 0 }; stok.push(s); }
      if (sign < 0 && s.stok < q) return { error: `Stok ${kode} di ${lokasi} tidak cukup (tersedia ${s.stok}, diminta ${q}).` };
      s.stok += sign * q;
    }
    const pre = jenis === 'Jual' ? 'INV-JL-' : 'INV-BL-', tanggal = new Date().toISOString().slice(0, 10), total = sum(lines, l => l.banyak * l.harga);
    const no = Math.max(0, ...D('transaksi').filter(t => String(t.invoice).startsWith(pre)).map(t => parseInt(String(t.invoice).slice(pre.length)) || 0)) + 1;
    const invoice = pre + String(no).padStart(4, '0'), jid = maxId(D('jurnal')) + 1, iid = maxId(D('item_transaksi'));
    const [debit, kredit] = jenis === 'Jual' ? [pembayaran === 'QRIS' ? 'Bank QRIS' : 'Kas', 'Penjualan'] : ['Persediaan', 'Kas'];

    await put('transaksi', [...D('transaksi'), { invoice, tanggal, jenis, kontak, kasir: app.model.session?.nama || '-', lokasi, pembayaran, total, status: 'Selesai' }]);
    await put('item_transaksi', [...D('item_transaksi'), ...lines.map((l, i) => ({ id: iid + i + 1, invoice, kode: l.kode, banyak: l.banyak, harga: l.harga, lokasi }))]);
    await put('stok', stok);
    await put('barang', D('barang').map(b => need[b.kode] ? { ...b, stok: b.stok + sign * need[b.kode] } : b));
    await put('jurnal', [...D('jurnal'),
      { id: jid, tanggal, akun: debit, debit: total, kredit: 0, keterangan: invoice },
      { id: jid + 1, tanggal, akun: kredit, debit: 0, kredit: total, keterangan: invoice }]);
    await put('laporan', laporan());
    return { invoice, total, sign };
  }
  app.trx = { post, rp };

  async function trxSave(e){
    const f = new FormData(e.target), jenis = f.get('jenis'), lokasi = f.get('lokasi'), lines = [];
    for (let i = 0; i < 4; i++){
      const qty = Number(f.get('qty_' + i)), b = D('barang').find(x => x.kode === f.get('kode_' + i));
      if (qty > 0 && b) lines.push({ kode: b.kode, banyak: qty, harga: b.harga });
    }
    if (!lines.length) return app.view.showFormError('Isi minimal satu barang dengan qty lebih dari 0.');
    const r = await post({ jenis, lokasi, kontak: f.get('kontak'), lines });
    if (r.error) return app.view.showFormError(r.error);
    app.view.closeDrawer();
    sync();
    app.view.notify(`${r.invoice} tersimpan: ${rp(r.total)}, stok ${lokasi} ${r.sign < 0 ? 'berkurang' : 'bertambah'}, jurnal tercatat.`);
  }
  app.controller.drawerHandlers.trx = { submit: trxSave, aux: () => {} };

  document.addEventListener('click', e => {
    if (!e.target.closest('[data-trx]')) return;
    const a = (D('akses').find(x => x.kode === app.model.session?.grup) || {}).modul || '';
    if (!a.includes('pos')) return app.view.notify('Grup Anda tidak punya akses modul POS.', 'error');
    app.view.openDrawer('trx', {});
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'dash_periode'){ periode = e.target.value; return sync(); }
    if (e.target.id !== 'trx_jenis') return;
    $('trx_kontak').innerHTML = kontakOpts(e.target.value);
    $('trx_lokasi').innerHTML = lokOpts(e.target.value);
  });
})();
