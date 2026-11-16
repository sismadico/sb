/* =============================================================
   Uji prinsip -- app = { model, view, controller, services }
   Config dibaca dari index.html (window.APP_CONFIG).
   Tabel & form dirender otomatis dari struktur JSON dataset.
   ============================================================= */
const app = {

  /* ---------- MODEL: data, state, logika data murni ---------- */
  model: {
    cfg: window.APP_CONFIG,
    data: {},          // key -> rows[]
    active: null,      // key menu aktif
    term: '',          // kata kunci pencarian
    editing: null,     // { mode: 'create' | 'edit', index }

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
      const t = app.model.term.trim().toLowerCase();
      return app.model.rows()
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => !t || Object.values(row).some(v => String(v).toLowerCase().includes(t)));
    },
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
    }
  },

  /* ---------- VIEW: render komponen (template literal) & DOM ---------- */
  view: {
    escapeHtml(v){
      return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },

    LAYERS: {
      header: cfg => `
        <header class="topbar"><div class="topbar-row">
          <div style="display:flex;align-items:center;gap:10px;">
            <button class="menu-toggle" id="menuToggle" aria-label="Buka menu" aria-controls="sidebar">&#9776;</button>
            <div class="brand"><span class="brand-mark" aria-hidden="true"></span><span class="brand-name">${app.view.escapeHtml(cfg.brand)}</span></div>
          </div>
          <div class="session">Mode data: <strong>${app.view.escapeHtml(cfg.mode)}</strong></div>
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
      content: () => `
        <main class="main"><section class="panel">
          <h1 class="panel-head" id="pageTitle"></h1>
          <div class="content-body">
            <form class="search-row" id="searchForm">
              <label for="searchInput">Cari</label>
              <input type="text" id="searchInput" aria-label="Kata kunci pencarian" autocomplete="off">
              <div class="search-meta"><span id="dataCount"></span></div>
            </form>
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
      modal: () => `
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
      drawer: () => `
        <div class="drawer-scrim" id="drawerScrim"></div>
        <aside class="drawer" id="drawer" aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="drawerTitle">
          <form class="drawer-form" id="drawerForm">
            <div class="drawer-head">
              <h2 id="drawerTitle"></h2>
              <button type="button" class="drawer-close" id="drawerClose" aria-label="Tutup">&times;</button>
            </div>
            <div class="drawer-body" id="drawerBody"></div>
            <p class="auth-error" id="formError" hidden></p>
            <div class="drawer-actions">
              <button type="button" class="btn btn-danger" id="drawerDelete">Hapus</button>
              <button type="button" class="btn" id="drawerCancel">Batal</button>
              <button type="submit" class="btn btn-primary">Simpan</button>
            </div>
          </form>
        </aside>`
    },

    renderLayers(cfg){
      Object.entries(app.view.LAYERS).forEach(([id, tpl]) => { document.getElementById(id).innerHTML = tpl(cfg); });
    },
    renderPage(){
      const m = app.model.current();
      document.getElementById('pageTitle').textContent = m.label;
      document.getElementById('sourceLabel').textContent = m.source;
      document.getElementById('searchInput').value = '';
      document.querySelectorAll('#menuList button').forEach(b => b.classList.toggle('active', b.dataset.key === m.key));
      app.view.renderTable();
    },
    renderTable(){
      const cols = app.model.columns(), rows = app.model.visibleRows(), esc = app.view.escapeHtml;
      document.getElementById('tableHead').innerHTML = cols.map(c => `<th>${esc(app.model.label(c))}</th>`).join('');
      document.getElementById('tableBody').innerHTML = rows.length
        ? rows.map(({ row, index }) => `
            <tr data-index="${index}" tabindex="0">
              ${cols.map(c => `<td data-label="${esc(app.model.label(c))}">${esc(row[c])}</td>`).join('')}
            </tr>`).join('')
        : `<tr class="empty-row"><td colspan="${cols.length || 1}">Tidak ada data.</td></tr>`;
      document.getElementById('dataCount').textContent = `Jumlah Data: ${rows.length}`;
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
    openDrawer(mode, row = {}){
      const m = app.model.current();
      const seed = mode === 'create' && m.auto ? { ...row, [m.pk]: app.model.nextId() } : row;
      document.getElementById('drawerTitle').textContent = `${m.label} - ${mode === 'create' ? 'Tambah Data' : 'Ubah Data'}`;
      document.getElementById('drawerBody').innerHTML = app.model.columns().map(k => app.view.buildField(k, seed[k], mode)).join('');
      document.getElementById('drawerDelete').style.display = mode === 'create' ? 'none' : '';
      app.view.showFormError('');
      document.getElementById('drawer').classList.add('open');
      document.getElementById('drawer').setAttribute('aria-hidden', 'false');
      document.getElementById('drawerScrim').classList.add('show');
      const first = document.querySelector('#drawerBody input:not([readonly]), #drawerBody select, #drawerBody textarea');
      if (first) first.focus();
    },
    closeDrawer(){
      document.getElementById('drawer').classList.remove('open');
      document.getElementById('drawer').setAttribute('aria-hidden', 'true');
      document.getElementById('drawerScrim').classList.remove('show');
    },
    showFormError(msg){
      const p = document.getElementById('formError');
      p.textContent = msg; p.hidden = !msg;
    },
    confirm({ title, text, yes }){
      return new Promise(resolve => {
        const o = document.getElementById('confirmOverlay');
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmText').textContent = text;
        document.getElementById('confirmYes').textContent = yes;
        const done = v => { o.hidden = true; resolve(v); };
        document.getElementById('confirmYes').onclick = () => done(true);
        document.getElementById('confirmNo').onclick = () => done(false);
        o.hidden = false;
      });
    },
    toggleSidebar(open){
      document.getElementById('sidebar').classList.toggle('open', open);
      document.getElementById('scrim').classList.toggle('show', open);
    }
  },

  /* ---------- CONTROLLER: alur, event, logika ---------- */
  controller: {
    async init(){
      const cfg = app.model.cfg;
      app.view.renderLayers(cfg);
      await Promise.all(cfg.menu.map(async m => {
        try { app.model.data[m.key] = await app.services.load(m); }
        catch (err){ console.error(err); app.model.data[m.key] = []; }
      }));
      app.controller.bind();
      app.controller.route();
    },
    route(){
      const key = location.hash.slice(1);
      app.model.active = app.model.menuOf(key) ? key : app.model.cfg.menu[0].key;
      app.view.renderPage();
    },
    bind(){
      const $ = id => document.getElementById(id), c = app.controller;
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
      $('searchForm').addEventListener('submit', e => e.preventDefault());
      $('searchInput').addEventListener('input', e => { app.model.term = e.target.value; app.view.renderTable(); });
      $('addBtn').addEventListener('click', () => { app.model.editing = { mode: 'create' }; app.view.openDrawer('create'); });
      $('resetBtn').addEventListener('click', c.reset);
      const open = e => {
        const tr = e.target.closest('tr[data-index]');
        if (!tr || (e.type === 'keydown' && e.key !== 'Enter')) return;
        const index = Number(tr.dataset.index);
        app.model.editing = { mode: 'edit', index };
        app.view.openDrawer('edit', app.model.rows()[index]);
      };
      $('tableBody').addEventListener('click', open);
      $('tableBody').addEventListener('keydown', open);
      $('drawerForm').addEventListener('submit', c.save);
      $('drawerDelete').addEventListener('click', c.remove);
      ['drawerCancel', 'drawerClose', 'drawerScrim'].forEach(id => $(id).addEventListener('click', app.view.closeDrawer));
    },
    async commit(rows){
      app.model.data[app.model.active] = rows;
      await app.services.save(app.model.active, rows);
      app.view.renderTable();
    },
    async save(e){
      e.preventDefault();
      const { mode, index } = app.model.editing, rows = app.model.rows();
      let row = app.model.coerce(new FormData(e.target));
      if (mode === 'edit') row = { ...rows[index], ...row };
      const err = app.model.validate(row, mode === 'edit' ? index : -1);
      if (err) return app.view.showFormError(err);
      await app.controller.commit(mode === 'edit' ? rows.map((r, i) => i === index ? row : r) : [...rows, row]);
      app.view.closeDrawer();
    },
    async remove(){
      const { index } = app.model.editing, m = app.model.current();
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
    unwrap(j){
      if (Array.isArray(j)) return j;
      if (j && j.ok === false) throw new Error((j.error && j.error.message) || 'Permintaan gagal');
      if (j && Array.isArray(j.data)) return j.data;
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

    /* Dua adapter dengan antarmuka sama: list / save / reset */
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
        }
      },
      online: {
        list:  m => app.services.getJson(`${app.model.cfg.apiBase}/${m.key}`),
        save:  (key, rows) => app.services.getJson(`${app.model.cfg.apiBase}/${key}`,
                 { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows) }),
        reset: async () => {}
      }
    },
    gateway(){ return app.services.adapters[app.model.cfg.mode]; },
    load(m){ return app.services.gateway().list(m); },
    save(key, rows){ return app.services.gateway().save(key, rows); },
    reset(key){ return app.services.gateway().reset(key); }
  }
};

app.controller.init();
