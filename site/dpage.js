// Behaviour for the per-dentist pages (site/d/*.html). Loaded once, shared by
// all ~30k pages so they stay tiny. Three jobs, all analytics-safe (no-op if
// Vercel Web Analytics is disabled), and none of them ever block the page.
(function () {
  function vaEvent(name, props) {
    try {
      if (typeof window.va === 'function') {
        window.va('event', Object.assign({ name: name }, props || {}));
      }
    } catch (e) { /* analytics must never break the page */ }
  }

  // Slug identifies which dentist drove the event (no personal data — it's the
  // public page URL) so we can see which records pull interest.
  var slug = (location.pathname.split('/d/')[1] || '').replace(/\.html$/, '');

  // 1. Count this as a per-dentist page view (distinct from a homepage view).
  vaEvent('profile_view', { slug: slug });

  // 2. Log clicks through to the official state record (the intended verify step).
  var verify = document.querySelector('.rp-verify');
  if (verify) {
    verify.addEventListener('click', function () { vaEvent('open_state_record', { slug: slug }); });
  }

  // 3. Share this record — native share sheet, clipboard fallback.
  var share = document.getElementById('rp-share');
  if (share) {
    share.addEventListener('click', function () {
      vaEvent('share_click', { slug: slug });
      var url = location.href;
      if (navigator.share) {
        navigator.share({ title: document.title, url: url }).catch(function () {});
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { flash(share, '✓ Link copied'); })
          .catch(function () {});
      } else {
        flash(share, url);
      }
    });
  }

  // 4. REQUEST THE FULL REPORT. Opening the form = intent (intent_report). The form
  // submits reliably to Web3Forms (no mailto — works for everyone, even with no mail
  // app) and emails the request to veterareports@gmail.com. Completed submit fires
  // request_submitted. Free during beta; payment added later once demand shows.
  var full = document.getElementById('rp-full-btn');
  var panel = document.getElementById('rp-full-panel');
  if (full && panel) {
    full.addEventListener('click', function () {
      vaEvent('intent_report', { slug: slug });
      panel.hidden = false;
      full.setAttribute('aria-expanded', 'true');
    });
  }

  var reqForm = document.getElementById('rp-request-form');
  var reqDone = document.getElementById('rp-request-done');
  if (reqForm) {
    reqForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var btn = reqForm.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(reqForm)
      }).then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.success) {
            reqForm.hidden = true;
            if (reqDone) reqDone.hidden = false;
            vaEvent('request_submitted', { slug: slug });
          } else { requestFailed(btn); }
        }).catch(function () { requestFailed(btn); });
    });
  }

  function requestFailed(btn) {
    if (btn) { btn.disabled = false; btn.textContent = 'Send my request'; }
    alert('Sorry — that didn\'t go through. Please email veterareports@gmail.com directly and we\'ll help.');
  }

  function flash(btn, msg) {
    var o = btn.textContent;
    btn.textContent = msg;
    setTimeout(function () { btn.textContent = o; }, 2500);
  }
})();
