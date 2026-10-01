/* Distillpedia Club — community comments widget.
   Works with a Google Apps Script Web App endpoint (see API_URL below).
   Markup contract: <section class="comments-widget" data-page-id="..." data-page-title="...">
   Security notes: rendering uses textContent only (no innerHTML for user data) => XSS-safe;
   honeypot field + submission timestamp are forwarded to the backend for spam filtering. */
(function () {
  // Backend: Google Apps Script Web App (deployed "Anyone" access).
  // GET  ?page=<id> -> {ok:true, comments:[{name,date,text}]}
  // POST JSON       -> {ok:true} | {ok:false, message}
  // doGet is served from script.googleusercontent.com after a 302 redirect, while doPost
  // only answers on the original script.google.com URL (the redirect turns POST into GET).
  const API_URL   = 'https://script.google.com/macros/s/AKfycbws1zGiiC1KW3xvD-zqdoYCit2bfv7pOoXjwJ5olbGc6FpJvc5DnyQUlcdBzEu76kmQcA/exec';

  document.querySelectorAll('.comments-widget').forEach(function (widget) {
    const pageId    = (widget.dataset.pageId || location.pathname).trim();
    const pageTitle = (widget.dataset.pageTitle || document.title).trim();
    const list   = widget.querySelector('.cw-list');
    const form   = widget.querySelector('.cw-form');
    const status = widget.querySelector('.cw-status');
    let openedAt = Date.now();

    if (!form || !list) return;                       // markup guard
    loadComments();

    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      const fd = new FormData(form);
      const payload = {
        pageId: pageId,
        pageTitle: pageTitle,
        name: fd.get('name'),
        email: fd.get('email'),
        text: fd.get('text'),
        website: fd.get('website'),   // honeypot
        ts: openedAt                  // время открытия формы
      };
      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      status.textContent = 'Отправка…';
      try {
        // Same-origin-ish simple request: no custom Content-Type => no CORS preflight,
        // which Apps Script Web Apps (external users) do not answer reliably.
        const res = await fetch(API_URL, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const txt = await res.text();
        let out;
        try { out = JSON.parse(txt); }
        catch (e) { throw new Error('bad response from server'); }
        if (out.ok) {
          form.reset();
          openedAt = Date.now();
          status.textContent = '✅ Комментарий отправлен! Появится после модерации.';
        } else {
          status.textContent = '⚠️ Ошибка: ' + (out.message || 'сервер отклонил комментарий');
        }
      } catch (e) {
        status.textContent = '⚠️ Не удалось отправить. Попробуйте позже.';
      } finally {
        if (btn) btn.disabled = false;
      }
    });

    async function loadComments() {
      list.textContent = 'Загрузка комментариев…';
      let out;
      try {
        const res = await fetch(API_URL + '?page=' + encodeURIComponent(pageId),
                                { redirect: 'follow' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        out = await res.json();
      } catch (e) {
        // Most likely a CORS/network failure: give the user a working fallback link.
        list.innerHTML = '';
        const p = document.createElement('p');
        p.className = 'cw-text';
        p.textContent = 'Не удалось загрузить комментарии. ';
        const a = document.createElement('a');
        a.href = API_URL + '?page=' + encodeURIComponent(pageId);
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = 'Открыть данные';
        p.append(a);
        list.append(p);
        return;
      }
      render(out.comments || []);
    }

    function render(comments) {
      list.innerHTML = '';
      if (!comments.length) {
        list.textContent = 'Комментариев пока нет — будьте первым!';
        return;
      }
      comments.forEach(function (c) {
        const art  = document.createElement('article');
        art.className = 'cw-comment';

        const head = document.createElement('p');
        head.className = 'cw-head';
        const b = document.createElement('strong');
        b.textContent = c.name;
        const time = document.createElement('span');
        time.textContent = ' • ' + new Date(c.date).toLocaleDateString('ru-RU',
          { day: 'numeric', month: 'long', year: 'numeric' });
        head.append(b, time);

        const body = document.createElement('p');
        body.className = 'cw-text';
        body.textContent = c.text;   // textContent = защита от XSS

        art.append(head, body);
        list.append(art);
      });
    }
  });
})();
