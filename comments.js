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
  const API_URL   = 'https://script.google.com/macros/s/AKfycby6s-iq48Aqh5oz51VoNBC8Ko_wkqaTJnAmv2orYYBqoIWTIXoeJ8DPvCVIZrDdgIzaTw/exec';

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
        // Apps Script Web Apps answer POST only on the original script.google.com URL:
        // their 302 redirect to script.googleusercontent.com turns POST into GET (=> 405),
        // and they send no CORS headers for cross-origin XHR/fetch.
        // Therefore we submit through a *no-cors* form POST: the browser sends it
        // (application/x-www-form-urlencoded is a "simple" request, no preflight),
        // and although the response is opaque, doPost() on the server does run.
        const params = new URLSearchParams();
        Object.keys(payload).forEach(function (k) {
          params.append(k, payload[k] === null || payload[k] === undefined ? '' : String(payload[k]));
        });
        await fetch(API_URL, { method: 'POST', mode: 'no-cors', body: params });
        // Opaque response => we cannot read the server answer; treat "request sent" as accepted.
        form.reset();
        openedAt = Date.now();
        status.textContent = '\u2705 \u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439 \u043e\u0442\u043f\u0440\u0430\u0432\u043b\u0435\u043d! \u041f\u043e\u044f\u0432\u0438\u0442\u0441\u044f \u043f\u043e\u0441\u043b\u0435 \u043c\u043e\u0434\u0435\u0440\u0430\u0446\u0438\u0438.';
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
