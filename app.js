/* =============================================================
   Uji prinsip -- app = { model, view, controller, services }
   Config dibaca dari index.html (window.APP_CONFIG).
   Tabel & form dirender otomatis dari struktur JSON dataset.

   Aturan UI:
   - SEMUA form (tambah/ubah data, pencarian) tampil di DRAWER,
     bukan di area konten. Konten hanya berisi tombol & tabel.
   - Login tampil di MODAL (overlay tengah layar) dengan captcha
     penjumlahan yang dibuat lokal tanpa pustaka/layanan eksternal.
   ============================================================= */
const app = {

  /* ---------- MODEL: data, state, logika data murni ---------- */
  model: {
    cfg: window.APP_CONFIG,
    data: {},          // key -> rows[]
    active: null,      // key menu aktif
    term: '',          // kata kunci pencarian (diisi lewat drawer pencarian)
    field: '',         // kolom pencarian; '' = semua kolom
    drawer: null,      // { kind: 'row' | 'search', mode?, index?, row? }
    session: null,     // { username, nama, grup } | null
    captcha: { a: 0, b: 0 },

    menuOf(key){ return app.model.cfg.menu.find(m => m.key === key); },
    current(){ return app.model.menuOf(app.model.active); },
    rows(){ return app.model.data[app.model.active] || []; },
    fieldCfg(key){ return (app.model.current().fields || {})[key] || {}; },
    label(key){
      return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, c => c.toUpperCase());
    },
    columns(){
      const keys = [];
      [...app.model.rows().flatMap(r => Object.keys(r)), ...Object.keys(app.model.current().fields || {})]
        .forEach(k => { if (!keys.includes(k)) keys.push(k); });
      return keys;
    },
    typeOf(key){
      const f = app.model.fieldCfg(key);
      if (f.type) return f.type;
      const vals = app.model.rows().map(r => r[key]).filter(v => v !== '' && v != null);
      if (vals.length && vals.every(v => typeof v === 'number')) return 'number';
      return vals.some(v => String(v).length > 60) ? 'textarea' : 'text';
    },
    visibleRows(){
      const { term, field } = app.model, t = term.trim().toLowerCase();
      return app.model.rows()
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => !t || (field ? [row[field]] : Object.values(row)).some(v => String(v ?? '').toLowerCase().includes(t)));
    },
    resetSearch(){ app.model.term = ''; app.model.field = ''; },
    nextId(){
      return Math.max(0, ...app.model.rows().map(r => Number(r[app.model.current().pk]) || 0)) + 1;
    },
    coerce(form){
      const row = {};
      app.model.columns().forEach(k => {
        const v = form.get(k);
        if (v === null) return;
        row[k] = app.model.typeOf(k) === 'number' && v !== '' ? Number(v) : v;
      });
      return row;
    },
    validate(row, index){
      const pk = app.model.current().pk;
      if (row[pk] === '' || row[pk] == null) return `${app.model.label(pk)} wajib diisi.`;
      const dup = app.model.rows().some((r, i) => i !== index && String(r[pk]) === String(row[pk]));
      return dup ? `${app.model.label(pk)} "${row[pk]}" sudah ada.` : '';
    },

    /* Captcha penjumlahan 1-20, murni lokal (Web Crypto bawaan browser,
       tanpa dependensi). Soal baru dibuat tiap modal login dibuka dan
       tiap percobaan gagal, supaya jawaban lama tidak bisa dipakai ulang. */
    newCaptcha(){
      const [a, b] = crypto.getRandomValues(new Uint8Array(2));
      app.model.captcha = { a: (a % 20) + 1, b: (b % 20) + 1 };
    },
    checkCaptcha(answer){
      const { a, b } = app.model.captcha;
      return Number(answer) === a + b;
    }
  },

  /* ---------- VIEW: render komponen (template literal) & DOM ---------- */
  view: {
    escapeHtml(v){
      return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    $: id => document.getElementById(id),

    sessionHtml(){
      const esc = app.view.escapeHtml, { session } = app.model, mode = esc(app.model.cfg.mode);
      return session
        ? `Selamat datang <strong>${esc(session.nama)} (${esc(session.grup)})</strong> | <a href="#" data-action="logout">Log Out</a> | Mode data: <strong>${mode}</strong>`
        : `Mode data: <strong>${mode}</strong>`;
    },

    LAYERS: {
      header: cfg => `
        <header class="topbar"><div class="topbar-row">
          <div style="display:flex;align-items:center;gap:10px;">
            <button class="menu-toggle" id="menuToggle" aria-label="Buka menu" aria-controls="sidebar">&#9776;</button>
            <div class="brand"><span class="brand-mark" aria-hidden="true"></span><span class="brand-name">${app.view.escapeHtml(cfg.brand)}</span></div>
          </div>
          <div class="session" id="sessionInfo">${app.view.sessionHtml()}</div>
        </div></header>`,
      menu: cfg => `
        <div class="scrim" id="scrim"></div>
        <aside class="sidebar" id="sidebar">
          <section class="panel">
            <h2 class="panel-head">Menu</h2>
            <ul class="sidebar-list" id="menuList">
              ${cfg.menu.map(m => `<li><button type="button" data-key="${m.key}">${app.view.escapeHtml(m.label)}</button></li>`).join('')}
            </ul>
          </section>
        </aside>`,
      /* Tidak ada <form> di konten: pencarian dibuka lewat drawer. */
      content: () => `
        <main class="main"><section class="panel">
          <h1 class="panel-head" id="pageTitle"></h1>
          <div class="content-body">
            <div class="search-row">
              <button type="button" class="btn" id="searchBtn">Cari / Saring</button>
              <span class="search-summary" id="searchSummary"></span>
              <button type="button" class="btn" id="clearSearchBtn" hidden>Hapus Saringan</button>
              <div class="search-meta"><span id="dataCount"></span></div>
            </div>
            <div class="table-actions">
              <button type="button" class="btn" id="resetBtn">Muat ulang dari JSON</button>
              <button type="button" class="btn btn-primary" id="addBtn">+ Tambah Data</button>
            </div>
            <div class="table-wrap"><table>
              <thead><tr id="tableHead"></tr></thead>
              <tbody id="tableBody"></tbody>
            </table></div>
          </div>
        </section></main>`,
      footer: cfg => `
        <footer class="footer"><p>${app.view.escapeHtml(cfg.brand)}: config di index.html, tabel dan form dirender dari JSON. Sumber data: <strong id="sourceLabel"></strong></p></footer>`,

      /* Modal: login (gerbang, tidak bisa ditutup tanpa berhasil) + konfirmasi. */
      modal: cfg => `
        <div class="auth-overlay" id="authOverlay" hidden role="dialog" aria-modal="true" aria-labelledby="authTitle">
          <div class="auth-card panel">
            <h2 class="panel-head" id="authTitle">Masuk ke ${app.view.escapeHtml(cfg.brand)}</h2>
            <form class="auth-form" id="authForm" autocomplete="off">
              <div class="field-group">
                <label for="authUsername">Username</label>
                <input type="text" id="authUsername" name="username" autocomplete="username" required>
              </div>
              <div class="field-group">
                <label for="authPassword">Password</label>
                <input type="password" id="authPassword" name="password" autocomplete="current-password" required>
              </div>
              <div class="field-group">
                <label for="authCaptcha" id="authCaptchaLabel"></label>
                <input type="number" id="authCaptcha" name="captcha" required>
              </div>
              <p class="auth-error" id="authError" role="alert" hidden></p>
              <button type="submit" class="btn btn-primary auth-submit">Masuk</button>
            </form>
            ${cfg.mode === 'offline' ? '<p class="auth-hint">Demo (mode offline): <strong>wawan</strong> / wawan123</p>' : ''}
          </div>
        </div>
        <div class="auth-overlay" id="confirmOverlay" hidden role="dialog" aria-modal="true" aria-labelledby="confirmTitle">
          <div class="auth-card panel">
            <h2 class="panel-head" id="confirmTitle"></h2>
            <p class="auth-hint" id="confirmText" style="padding-top:14px"></p>
            <div class="drawer-actions">
              <button type="button" class="btn" id="confirmNo">Batal</button>
              <button type="button" class="btn btn-danger" id="confirmYes"></button>
            </div>
          </div>
        </div>`,

      /* Satu drawer generik untuk semua form; isinya ditentukan DRAWERS[kind]. */
      drawer: () => `
        <div class="drawer-scrim" id="drawerScrim"></div>
        <aside class="drawer" id="drawerPanel" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="drawerTitle">
          <form class="drawer-form" id="drawerForm">
            <div class="drawer-head">
              <h2 id="drawerTitle"></h2>
              <button type="button" class="drawer-close" id="drawerClose" aria-label="Tutup">&times;</button>
            </div>
            <div class="drawer-body" id="drawerBody"></div>
            <p class="auth-error" id="formError" hidden></p>
            <div class="drawer-actions">
              <button type="button" class="btn" id="drawerAux"></button>
              <button type="button" class="btn" id="drawerCancel">Batal</button>
              <button type="submit" class="btn btn-primary" id="drawerSubmit">Simpan</button>
            </div>
          </form>
        </aside>`
    },

    /* Registri jenis drawer: menambah form baru = menambah satu entri di sini
       (+ handler-nya di controller.drawerHandlers), tanpa percabangan if. */
    DRAWERS: {
      row: {
        title: (m, d) => `${m.label} - ${d.mode === 'create' ? 'Tambah Data' : 'Ubah Data'}`,
        submit: 'Simpan',
        aux: d => d.mode === 'edit' ? { label: 'Hapus', danger: true } : null,
        body: d => {
          const m = app.model.current();
          const seed = d.mode === 'create' && m.auto ? { ...d.row, [m.pk]: app.model.nextId() } : d.row;
          return app.model.columns().map(k => app.view.buildField(k, seed[k], d.mode)).join('');
        }
      },
      search: {
        title: m => `${m.label} - Cari / Saring`,
        submit: 'Terapkan',
        aux: () => ({ label: 'Reset', danger: false }),
        body: () => app.view.buildSearchFields()
      }
    },

    renderLayers(cfg){
      Object.entries(app.view.LAYERS).forEach(([id, tpl]) => { app.view.$(id).innerHTML = tpl(cfg); });
    },
    renderSession(){ app.view.$('sessionInfo').innerHTML = app.view.sessionHtml(); },
    renderPage(){
      const m = app.model.current(), $ = app.view.$;
      $('pageTitle').textContent = m.label;
      $('sourceLabel').textContent = m.source;
      document.querySelectorAll('#menuList button').forEach(b => b.classList.toggle('active', b.dataset.key === m.key));
      app.view.renderTable();
    },
    renderTable(){
      const cols = app.model.columns(), rows = app.model.visibleRows(), esc = app.view.escapeHtml, $ = app.view.$;
      $('tableHead').innerHTML = cols.map(c => `<th>${esc(app.model.label(c))}</th>`).join('');
      $('tableBody').innerHTML = rows.length
        ? rows.map(({ row, index }) => `
            <tr data-index="${index}" tabindex="0">
              ${cols.map(c => `<td data-label="${esc(app.model.label(c))}">${esc(row[c])}</td>`).join('')}
            </tr>`).join('')
        : `<tr class="empty-row"><td colspan="${cols.length || 1}">Tidak ada data.</td></tr>`;
      $('dataCount').textContent = `Jumlah Data: ${rows.length}`;
      app.view.renderSearchSummary();
    },
    renderSearchSummary(){
      const { term, field } = app.model, active = Boolean(term.trim());
      app.view.$('searchSummary').textContent = active
        ? `Saringan: "${term.trim()}" di ${field ? app.model.label(field) : 'semua kolom'}`
        : '';
      app.view.$('clearSearchBtn').hidden = !active;
    },
    buildField(key, value, mode){
      const m = app.model.current(), f = app.model.fieldCfg(key), esc = app.view.escapeHtml;
      const type = app.model.typeOf(key), isPk = key === m.pk;
      const ro = f.readonly || (isPk && (mode === 'edit' || m.auto));
      const attrs = `id="fld_${key}" name="${esc(key)}"${ro ? ' readonly' : ''}${isPk ? ' required' : ''}`;
      const input =
        type === 'select'   ? `<select id="fld_${key}" name="${esc(key)}">${(f.options || []).map(o =>
                                 `<option value="${esc(o)}"${String(o) === String(value) ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>` :
        type === 'textarea' ? `<textarea ${attrs} rows="3">${esc(value)}</textarea>` :
        type === 'number'   ? `<input type="number" step="any" ${attrs} value="${esc(value)}">` :
                              `<input type="text" ${attrs} value="${esc(value)}">`;
      return `<div class="field-group"><label for="fld_${key}">${esc(app.model.label(key))}</label>${input}</div>`;
    },
    buildSearchFields(){
      const esc = app.view.escapeHtml, { term, field } = app.model;
      return `
        <div class="field-group">
          <label for="fld_term">Kata kunci</label>
          <input type="text" id="fld_term" name="term" value="${esc(term)}" autocomplete="off">
        </div>
        <div class="field-group">
          <label for="fld_field">Cari di kolom</label>
          <select id="fld_field" name="field">
            <option value="">Semua kolom</option>
            ${app.model.columns().map(c => `<option value="${esc(c)}"${c === field ? ' selected' : ''}>${esc(app.model.label(c))}</option>`).join('')}
          </select>
        </div>`;
    },

    /* Membuka drawer jenis `kind`; ctx (mode/index/row) disimpan di model.drawer
       supaya controller tahu konteks saat submit/aux. */
    openDrawer(kind, ctx = {}){
      const spec = app.view.DRAWERS[kind], $ = app.view.$;
      const d = app.model.drawer = { kind, ...ctx };
      const aux = spec.aux(d);

      $('drawerTitle').textContent = spec.title(app.model.current(), d);
      $('drawerBody').innerHTML = spec.body(d);
      $('drawerSubmit').textContent = spec.submit;
      $('drawerAux').style.display = aux ? '' : 'none';
      if (aux){
        $('drawerAux').textContent = aux.label;
        $('drawerAux').classList.toggle('btn-danger', Boolean(aux.danger));
      }
      app.view.showFormError('');
      $('drawerPanel').classList.add('open');
      $('drawerPanel').setAttribute('aria-hidden', 'false');
      $('drawerScrim').classList.add('show');
      const first = document.querySelector('#drawerBody input:not([readonly]), #drawerBody select, #drawerBody textarea');
      if (first) first.focus();
    },
    closeDrawer(){
      const $ = app.view.$;
      $('drawerPanel').classList.remove('open');
      $('drawerPanel').setAttribute('aria-hidden', 'true');
      $('drawerScrim').classList.remove('show');
    },
    showFormError(msg){
      const p = app.view.$('formError');
      p.textContent = msg; p.hidden = !msg;
    },

    /* ---- Modal login ---- */
    refreshCaptcha(){
      app.model.newCaptcha();
      const { a, b } = app.model.captcha, $ = app.view.$;
      $('authCaptchaLabel').textContent = `Berapa hasil ${a} + ${b} ?`;
      $('authCaptcha').value = '';
    },
    showAuthError(msg){
      const p = app.view.$('authError');
      p.textContent = msg; p.hidden = !msg;
    },
    showLogin(){
      const $ = app.view.$;
      $('authUsername').value = '';
      $('authPassword').value = '';
      app.view.showAuthError('');
      app.view.refreshCaptcha();
      $('authOverlay').hidden = false;
      $('authUsername').focus();
    },
    hideLogin(){ app.view.$('authOverlay').hidden = true; },

    confirm({ title, text, yes }){
      return new Promise(resolve => {
        const o = app.view.$('confirmOverlay'), $ = app.view.$;
        $('confirmTitle').textContent = title;
        $('confirmText').textContent = text;
        $('confirmYes').textContent = yes;
        const done = v => { o.hidden = true; resolve(v); };
        $('confirmYes').onclick = () => done(true);
        $('confirmNo').onclick = () => done(false);
        o.hidden = false;
      });
    },
    toggleSidebar(open){
      app.view.$('sidebar').classList.toggle('open', open);
      app.view.$('scrim').classList.toggle('show', open);
    }
  },

  /* ---------- CONTROLLER: alur, event, logika ---------- */
  controller: {
    async init(){
      const cfg = app.model.cfg;
      app.model.session = app.services.auth.restore();
      app.view.renderLayers(cfg);
      await Promise.all(cfg.menu.map(async m => {
        try { app.model.data[m.key] = await app.services.load(m); }
        catch (err){ console.error(err); app.model.data[m.key] = []; }
      }));
      app.controller.bind();
      app.controller.route();
      /* Gerbang login: tanpa sesi tersimpan, modal login tampil dulu. */
      if (!app.model.session) app.view.showLogin();
    },
    route(){
      const key = location.hash.slice(1);
      app.model.active = app.model.menuOf(key) ? key : app.model.cfg.menu[0].key;
      app.model.resetSearch();   // saringan tidak dibawa antar menu
      app.view.renderPage();
    },

    /* Handler per jenis drawer (pasangan dari view.DRAWERS). */
    drawerHandlers: {
      row:    { submit: e => app.controller.save(e),        aux: () => app.controller.remove() },
      search: { submit: e => app.controller.applySearch(e), aux: () => app.controller.clearSearch() }
    },

    bind(){
      const $ = app.view.$, c = app.controller;
      window.addEventListener('hashchange', c.route);
      document.addEventListener('keydown', e => { if (e.key === 'Escape') app.view.closeDrawer(); });
      $('menuToggle').addEventListener('click', () => app.view.toggleSidebar(!$('sidebar').classList.contains('open')));
      $('scrim').addEventListener('click', () => app.view.toggleSidebar(false));
      $('menuList').addEventListener('click', e => {
        const b = e.target.closest('button[data-key]');
        if (!b) return;
        location.hash = '#' + b.dataset.key;
        app.view.toggleSidebar(false);
      });

      // Konten: semua tombol membuka drawer, tidak ada form inline.
      $('searchBtn').addEventListener('click', () => app.view.openDrawer('search'));
      $('clearSearchBtn').addEventListener('click', c.clearSearch);
      $('addBtn').addEventListener('click', () => app.view.openDrawer('row', { mode: 'create', row: {} }));
      $('resetBtn').addEventListener('click', c.reset);
      const open = e => {
        const tr = e.target.closest('tr[data-index]');
        if (!tr || (e.type === 'keydown' && e.key !== 'Enter')) return;
        const index = Number(tr.dataset.index);
        app.view.openDrawer('row', { mode: 'edit', index, row: app.model.rows()[index] });
      };
      $('tableBody').addEventListener('click', open);
      $('tableBody').addEventListener('keydown', open);

      // Drawer generik: submit & aksi tambahan didelegasikan per jenis.
      $('drawerForm').addEventListener('submit', c.submitDrawer);
      $('drawerAux').addEventListener('click', () => c.drawerHandlers[app.model.drawer.kind].aux());
      ['drawerCancel', 'drawerClose', 'drawerScrim'].forEach(id => $(id).addEventListener('click', app.view.closeDrawer));

      // Modal login + sesi.
      $('authForm').addEventListener('submit', c.login);
      $('sessionInfo').addEventListener('click', c.onSessionClick);
    },
    submitDrawer(e){
      e.preventDefault();
      return app.controller.drawerHandlers[app.model.drawer.kind].submit(e);
    },

    /* ---- Pencarian (drawer) ---- */
    applySearch(e){
      const form = new FormData(e.target);
      app.model.term = String(form.get('term') || '');
      app.model.field = String(form.get('field') || '');
      app.view.renderTable();
      app.view.closeDrawer();
    },
    clearSearch(){
      app.model.resetSearch();
      app.view.renderTable();
      app.view.closeDrawer();
    },

    /* ---- Auth (modal) ---- */
    async login(e){
      e.preventDefault();
      const $ = app.view.$;
      if (!app.model.checkCaptcha($('authCaptcha').value)){
        app.view.showAuthError('Jawaban captcha salah, silakan coba lagi.');
        app.view.refreshCaptcha();
        return;
      }
      try {
        const session = await app.services.auth.login($('authUsername').value.trim().toLowerCase(), $('authPassword').value);
        app.model.session = session;
        app.services.auth.persist(session);
        app.view.renderSession();
        app.view.hideLogin();
      } catch (err){
        app.view.showAuthError(err.message);
        $('authPassword').value = '';
        app.view.refreshCaptcha();
      }
    },
    onSessionClick(e){
      if (!e.target.closest('a[data-action="logout"]')) return;
      e.preventDefault();
      app.model.session = null;
      app.services.auth.clear();
      app.view.closeDrawer();
      app.view.renderSession();
      app.view.showLogin();
    },

    /* ---- CRUD (drawer) ---- */
    async commit(rows){
      app.model.data[app.model.active] = rows;
      await app.services.save(app.model.active, rows);
      app.view.renderTable();
    },
    async save(e){
      const { mode, index } = app.model.drawer, rows = app.model.rows();
      let row = app.model.coerce(new FormData(e.target));
      if (mode === 'edit') row = { ...rows[index], ...row };
      const err = app.model.validate(row, mode === 'edit' ? index : -1);
      if (err) return app.view.showFormError(err);
      await app.controller.commit(mode === 'edit' ? rows.map((r, i) => i === index ? row : r) : [...rows, row]);
      app.view.closeDrawer();
    },
    async remove(){
      const { index } = app.model.drawer, m = app.model.current();
      const ok = await app.view.confirm({ title: 'Hapus data?', text: `Data ke-${index + 1} pada ${m.label} akan dihapus.`, yes: 'Hapus' });
      if (!ok) return;
      await app.controller.commit(app.model.rows().filter((_, i) => i !== index));
      app.view.closeDrawer();
    },
    async reset(){
      const m = app.model.current();
      const ok = await app.view.confirm({ title: 'Muat ulang dari JSON?', text: `Perubahan lokal pada ${m.label} akan diganti isi ${m.source}.`, yes: 'Muat ulang' });
      if (!ok) return;
      await app.services.reset(m.key);
      app.model.data[m.key] = await app.services.load(m);
      app.view.renderTable();
    }
  },

  /* ---------- SERVICES: koneksi JSON, IndexedDB, API gateway ---------- */
  services: {
    /* Mengembalikan array (daftar data) atau objek (mis. sesi login). */
    unwrap(j){
      if (Array.isArray(j)) return j;
      if (j && j.ok === false) throw new Error((j.error && j.error.message) || 'Permintaan gagal');
      if (j && j.data !== undefined && j.data !== null) return j.data;
      throw new Error('Format JSON tidak dikenali');
    },
    async getJson(url, opt){
      const res = await fetch(url, opt);
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      return app.services.unwrap(await res.json());
    },
    _db: null,
    db(){
      return app.services._db ||= new Promise((resolve, reject) => {
        const req = indexedDB.open(app.model.cfg.dbName, 1);
        req.onupgradeneeded = () => req.result.createObjectStore('datasets');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },
    async idb(mode, fn){
      const db = await app.services.db();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('datasets', mode), req = fn(tx.objectStore('datasets'));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
      });
    },

    /* Dua adapter dengan antarmuka sama: list / save / reset / login */
    adapters: {
      offline: {
        async list(m){
          try {
            const saved = await app.services.idb('readonly', s => s.get(m.key));
            if (saved) return saved;
          } catch (err){ console.warn('IndexedDB tidak tersedia:', err.message); }
          const rows = await app.services.getJson(m.source);
          await app.services.adapters.offline.save(m.key, rows);
          return rows;
        },
        async save(key, rows){
          try { await app.services.idb('readwrite', s => s.put(rows, key)); }
          catch (err){ console.warn('Gagal menyimpan ke IndexedDB:', err.message); }
        },
        async reset(key){
          try { await app.services.idb('readwrite', s => s.delete(key)); } catch (err){ /* abaikan */ }
        },
        /* DEMO SAJA: password tidak disimpan di data. Aturan demo: password =
           username + "123", dan akun harus berstatus aktif. Di mode online
           verifikasi (hash, sesi) sepenuhnya dilakukan server. */
        async login(username, password){
          const a = app.model.cfg.auth;
          const user = (app.model.data[a.source] || []).find(r => String(r[a.usernameKey]).toLowerCase() === username);
          if (!user || user[a.statusKey] !== a.activeValue || password !== `${username}123`){
            throw new Error('Username atau password salah.');
          }
          return { username, nama: user[a.nameKey], grup: user[a.groupKey] };
        }
      },
      online: {
        list:  m => app.services.getJson(`${app.model.cfg.apiBase}/${m.key}`),
        save:  (key, rows) => app.services.getJson(`${app.model.cfg.apiBase}/${key}`,
                 { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows) }),
        reset: async () => {},
        login: (username, password) => app.services.getJson(`${app.model.cfg.apiBase}/auth/login`,
                 { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
      }
    },
    gateway(){ return app.services.adapters[app.model.cfg.mode]; },
    load(m){ return app.services.gateway().list(m); },
    save(key, rows){ return app.services.gateway().save(key, rows); },
    reset(key){ return app.services.gateway().reset(key); },

    /* Sesi login: hanya profil non-rahasia yang disimpan di localStorage. */
    auth: {
      key: () => app.model.cfg.auth.sessionKey,
      login: (username, password) => app.services.gateway().login(username, password),
      restore(){
        try { return JSON.parse(localStorage.getItem(app.services.auth.key())); } catch (err){ return null; }
      },
      persist(session){
        try { localStorage.setItem(app.services.auth.key(), JSON.stringify(session)); } catch (err){ /* abaikan */ }
      },
      clear(){
        try { localStorage.removeItem(app.services.auth.key()); } catch (err){ /* abaikan */ }
      }
    }
  }
};

app.controller.init();
