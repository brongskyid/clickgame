/*! Game Hub SDK — satu login untuk semua game. Pakai: <script src="/hub.js"></script> lalu Hub.* */
(function (global) {
  'use strict';
  const script = document.currentScript;
  const cfg = { api: (script && script.dataset.api) || (script ? script.src.replace(/\/hub\.js.*$/, '') : '') + '/api' };
  let user = null;          // {id, username, name, guest} atau null
  let online = null;        // null = belum dicek, true/false
  const listeners = [];

  function emit() { listeners.forEach(fn => { try { fn(user); } catch (e) {} }); }

  async function call(path, body, method, extra) {
    const opts = { method: method || (body ? 'POST' : 'GET'), credentials: 'same-origin',
                   headers: { 'X-Requested-With': 'hub' }, ...(extra || {}) };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res;
    try { res = await fetch(cfg.api + '/' + path, opts); }
    catch (e) { online = false; throw new Error('offline'); }
    online = true;
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok || !data || data.ok === false) {
      const err = new Error((data && data.error) || ('HTTP ' + res.status)); err.status = res.status; throw err;
    }
    return data;
  }

  const Hub = {
    config: cfg,
    get user() { return user; },
    get online() { return online; },
    onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },

    async me() { try { const d = await call('auth.php'); user = d.user; } catch (e) { if (e.message === 'offline') user = null; } emit(); return user; },
    async login(username, password) { const d = await call('auth.php', { action: 'login', username, password }); user = d.user; emit(); return user; },
    async register(username, password, name) { const d = await call('auth.php', { action: 'register', username, password, name }); user = d.user; emit(); return user; },
    async guest(name) { const d = await call('auth.php', { action: 'guest', name }); user = d.user; emit(); return user; },
    async upgrade(username, password) { const d = await call('auth.php', { action: 'upgrade', username, password }); user = d.user; emit(); return user; },
    async rename(name) { const d = await call('auth.php', { action: 'rename', name }); user = d.user; emit(); return user; },
    async logout() { try { await call('auth.php', { action: 'logout' }); } catch (e) {} user = null; emit(); },

    async load(game) { const d = await call('save.php?game=' + encodeURIComponent(game)); return d.data ? { data: d.data, updated_at: d.updated_at } : null; },
    async save(game, data, opt) { return call('save.php', { game, data }, 'POST', opt && opt.keepalive ? { keepalive: true } : null); },
    async score(game, board, value, meta) { return call('score.php', { game, board, value, meta: meta || null }); },
    async board(game, board, limit) { const d = await call('board.php?game=' + encodeURIComponent(game) + '&board=' + encodeURIComponent(board) + '&limit=' + (limit || 10)); return d.rows; },
    async ping() { try { await call('ping.php'); return true; } catch (e) { return false; } },

    /** Modal login bawaan. Mengembalikan Promise<user|null>. */
    ui: {
      login(opts) {
        opts = opts || {};
        return new Promise(resolve => {
          const old = document.getElementById('hub-modal'); if (old) old.remove();
          const el = document.createElement('div'); el.id = 'hub-modal';
          el.innerHTML = `
<style>
#hub-modal{position:fixed;inset:0;background:#000c;display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
#hub-modal .box{background:#1a1522;border:1px solid #b8860b;border-radius:16px;padding:18px;width:100%;max-width:360px;color:#f1ecf8}
#hub-modal h3{margin:0 0 4px;font-size:18px;letter-spacing:2px;color:#f5c542}
#hub-modal p{margin:0 0 12px;font-size:12px;color:#9a90ad}
#hub-modal .tabs{display:flex;gap:6px;margin-bottom:12px}
#hub-modal .tabs button{flex:1;background:#241d30;border:1px solid #332a40;color:#9a90ad;border-radius:8px;padding:7px;font-size:12px;font-weight:700;cursor:pointer}
#hub-modal .tabs button.on{color:#f5c542;border-color:#b8860b}
#hub-modal input{width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid #332a40;background:#0e0b14;color:#f1ecf8;font-size:14px;margin-bottom:8px}
#hub-modal .go{width:100%;border:none;border-radius:10px;padding:11px;font-weight:800;font-size:14px;background:linear-gradient(180deg,#ffe08a,#b8860b);color:#1a1200;cursor:pointer;margin-top:2px}
#hub-modal .skip{width:100%;background:none;border:1px solid #332a40;color:#9a90ad;border-radius:10px;padding:8px;font-size:12px;cursor:pointer;margin-top:8px}
#hub-modal .err{color:#f87171;font-size:12px;min-height:16px;margin:2px 0 6px}
#hub-modal .hint{font-size:11px;color:#9a90ad;margin-top:6px}
</style>
<div class="box">
  <h3>${opts.title || 'GAME HUB'}</h3>
  <p>${opts.subtitle || 'Satu akun untuk semua game. Progres dan skor ikut ke mana pun kamu login.'}</p>
  <div class="tabs"><button data-t="login" class="on">Masuk</button><button data-t="register">Daftar</button><button data-t="guest">Tamu</button></div>
  <form id="hub-form" autocomplete="on">
    <div data-f="login register"><input name="username" placeholder="username (huruf kecil, angka, _)" autocapitalize="none" autocomplete="username"></div>
    <div data-f="register guest"><input name="name" placeholder="nama tampilan (max 14)" maxlength="14"></div>
    <div data-f="login register"><input name="password" type="password" placeholder="password (min 6)" autocomplete="current-password"></div>
    <div class="err" id="hub-err"></div>
    <button class="go" type="submit" id="hub-go">MASUK</button>
  </form>
  ${opts.allowSkip === false ? '' : '<button class="skip" id="hub-skip">Lanjut tanpa akun (progres hanya di perangkat ini)</button>'}
  <div class="hint">Tamu bisa diubah jadi akun penuh kapan saja tanpa kehilangan progres.</div>
</div>`;
          document.body.appendChild(el);
          let tab = 'login';
          const form = el.querySelector('#hub-form'), err = el.querySelector('#hub-err'), go = el.querySelector('#hub-go');
          const labels = { login: 'MASUK', register: 'DAFTAR', guest: 'MAIN SEBAGAI TAMU' };
          function setTab(t) {
            tab = t; err.textContent = '';
            el.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
            el.querySelectorAll('[data-f]').forEach(d => d.style.display = d.dataset.f.split(' ').includes(t) ? '' : 'none');
            go.textContent = labels[t];
          }
          setTab('login');
          el.querySelectorAll('.tabs button').forEach(b => b.onclick = () => setTab(b.dataset.t));
          const skip = el.querySelector('#hub-skip'); if (skip) skip.onclick = () => { el.remove(); resolve(null); };
          form.onsubmit = async e => {
            e.preventDefault(); err.textContent = ''; go.disabled = true;
            const f = new FormData(form);
            try {
              let u;
              if (tab === 'login') u = await Hub.login(f.get('username'), f.get('password'));
              else if (tab === 'register') u = await Hub.register(f.get('username'), f.get('password'), f.get('name') || f.get('username'));
              else u = await Hub.guest(f.get('name') || 'Tamu');
              el.remove(); resolve(u);
            } catch (ex) {
              err.textContent = ex.message === 'offline' ? 'Server tidak terjangkau. Coba lagi atau lanjut tanpa akun.' : ex.message;
            } finally { go.disabled = false; }
          };
        });
      }
    }
  };
  global.Hub = Hub;
})(window);
