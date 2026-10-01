/* Distillpedia Club — community comments widget.
   Works with a Google Apps Script Web App endpoint (see API_URL below).
   Markup contract: <section class="comments-widget" data-page-id="..." data-page-title="...">
   Security notes: rendering uses textContent only (no innerHTML for user data) => XSS-safe;
   honeypot field + submission timestamp are forwarded to the backend for spam filtering. */
(function () {
  // ⚠️ TODO: replace with your deployed Google Apps Script Web App URL, e.g.
  // https://script.google.com/macros/s/AKfycbXXXXXXXX/exec
  const API_URL = 'https://script.google.com/macros/s/AKfycbws1zGiiC1KW3xvD-zqdoYCit2bfv7pOoXjwJ5olbGc6FpJvc5DnyQUlcdBzEu76kmQcA/exec';

  document.querySelectorAll('.comments-widget').forEach(function (widget) {
    const pageId    = widget.dataset.pageId;
    const pageTitle = widget.dataset.pageTitle || document.title;
    const list   = widget.querySelector('.cw-list');
    const form   = widget.querySelector('.cw-form');
    const status = widget.querySelector('.cw-status');
    let openedAt = Date.now();

    if (!form || !list) return;                       // markup guard
    if (API_URL.indexOf('ВАШ_ID') !== -1) {           // backend not configured yet
      list.textContent = 'Комментарии временно недоступны: не настроен сервер (API_URL).';
      if (form) form.style.display = 'none';
      return;
    }

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
      status.textContent = 'Отправка…';
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        const out = await res.json();
        if (out.ok) {
          form.reset();
          openedAt = Date.now();
          status.textContent = '✅ Комментарий отправлен! Появится после модерации.';
        } else {
          status.textContent = '⚠️ Ошибка: ' + out.message;
        }
      } catch (e) {
        status.textContent = '⚠️ Не удалось отправить. Попробуйте позже.';
      }
    });

    async function loadComments() {
      try {
        const res = await fetch(API_URL + '?page=' + encodeURIComponent(pageId));
        const out = await res.json();
        render(out.comments || []);
      } catch (e) {
        list.textContent = 'Не удалось загрузить комментарии.';
      }
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
