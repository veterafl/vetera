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

  // 4. FAKE DOOR — measures paid demand before the paid report exists. The click
  // is the signal (intent_report); the reveal is an honest "coming soon + notify
  // me", never a dead-end paywall (keeps Vetera's facts-only trust intact).
  var full = document.getElementById('rp-full-btn');
  var panel = document.getElementById('rp-full-panel');
  if (full && panel) {
    full.addEventListener('click', function () {
      vaEvent('intent_report', { slug: slug });
      panel.hidden = false;
      full.setAttribute('aria-expanded', 'true');
    });
  }

  function flash(btn, msg) {
    var o = btn.textContent;
    btn.textContent = msg;
    setTimeout(function () { btn.textContent = o; }, 2500);
  }
})();
