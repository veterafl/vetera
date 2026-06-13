// Vetera Quick Check — searches the official Florida dentist license file
// (data/dentists.json, built from the FL DOH "License Status" public download)
// and shows a plain-language result inline. No backend, no tracking.
//
// Two questions a patient actually has, answered in plain words:
//   1. Is this dentist licensed and active in Florida right now?
//   2. Has the state ever taken action against them?

(function () {
  const form = document.getElementById('searchForm');
  const input = document.getElementById('providerName');
  const resultsEl = document.getElementById('searchResults');
  if (!form || !input || !resultsEl) return;

  const FL_DOH_URL = 'https://mqa-internet.doh.state.fl.us/mqasearchservices/home';
  const MAX_RESULTS = 50;

  // ---- Data loading (fetched once, then cached) -------------------------
  let dataPromise = null;
  let indexByLast = null; // Map: UPPERCASE last name -> [records]

  function loadDentists() {
    if (dataPromise) return dataPromise;
    dataPromise = fetch('data/dentists.json')
      .then(function (r) {
        if (!r.ok) throw new Error('load failed');
        return r.json();
      })
      .then(function (records) {
        indexByLast = new Map();
        for (let i = 0; i < records.length; i++) {
          const rec = records[i];
          const key = normName(rec.l);
          let bucket = indexByLast.get(key);
          if (!bucket) {
            bucket = [];
            indexByLast.set(key, bucket);
          }
          bucket.push(rec);
        }
        return records;
      });
    return dataPromise;
  }

  function normName(s) {
    return (s || '').toString().trim().toUpperCase();
  }

  // Strict matching so we never blame the wrong person:
  // last name must match exactly; first name (if given) must match, or match by
  // initial only when the user themselves typed a single-letter initial.
  function namesMatch(inputFirst, recordFirst) {
    const f = normName(inputFirst);
    const r = normName(recordFirst);
    if (!f) return true;
    if (f === r) return true;
    if (f.length === 1 && r && r[0] === f) return true;
    return false;
  }

  function parseName(raw) {
    const stripped = raw.replace(/^(dr\.?|doctor)\s+/i, '').trim();
    const parts = stripped.split(/\s+/);
    if (parts.length === 1) return { first: '', last: parts[0] };
    return { first: parts[0], last: parts[parts.length - 1] };
  }

  // Find matching dentists. If the user gave one word, match it as a last name
  // OR a first name (people search either way).
  function findMatches(first, last) {
    const lastKey = normName(last);
    const oneName = !first;
    const out = [];
    const seen = new Set();

    function consider(rec, ok) {
      if (!ok) return;
      const id = rec.lic + '|' + rec.l + '|' + rec.f;
      if (seen.has(id)) return;
      seen.add(id);
      out.push(rec);
    }

    // Primary: last-name bucket
    const bucket = indexByLast.get(lastKey) || [];
    bucket.forEach(function (rec) {
      consider(rec, oneName ? true : namesMatch(first, rec.f));
    });

    // If one word, also try it as a first name across all records
    if (oneName) {
      indexByLast.forEach(function (recs) {
        recs.forEach(function (rec) {
          consider(rec, normName(rec.f) === lastKey);
        });
      });
    }
    return out;
  }

  // ---- Search flow ------------------------------------------------------
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const raw = input.value.trim();
    if (!raw) return;
    document.body.classList.add('has-results');
    runSearch(raw);
  });

  // Optional clickable example on the home page
  const exampleLink = document.getElementById('exampleSearch');
  if (exampleLink) {
    exampleLink.addEventListener('click', function (e) {
      e.preventDefault();
      const name = exampleLink.getAttribute('data-name') || '';
      input.value = name;
      document.body.classList.add('has-results');
      runSearch(name);
    });
  }

  function returnToHome() {
    document.body.classList.remove('has-results');
    input.value = '';
    resultsEl.innerHTML = '';
    input.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const logoEl = document.querySelector('.home-logo');
  if (logoEl) {
    logoEl.style.cursor = 'pointer';
    logoEl.setAttribute('role', 'button');
    logoEl.setAttribute('aria-label', 'Return to home');
    logoEl.addEventListener('click', returnToHome);
  }
  const newSearchBtn = document.getElementById('newSearchBtn');
  if (newSearchBtn) newSearchBtn.addEventListener('click', returnToHome);

  async function runSearch(raw) {
    resultsEl.innerHTML = '<p class="results-status">Looking up Florida dentists…</p>';
    try {
      await loadDentists();
    } catch (err) {
      resultsEl.innerHTML =
        '<p class="results-status">Sorry — the dentist records could not load. ' +
        'Please refresh the page and try again.</p>';
      return;
    }

    const { first, last } = parseName(raw);
    let matches = findMatches(first, last);

    // Show dentists with a state action first (most important), then active
    matches.sort(function (a, b) {
      if (b.d !== a.d) return b.d - a.d;
      if (b.a !== a.a) return b.a - a.a;
      return a.l.localeCompare(b.l);
    });

    renderResults(raw, matches);
  }

  // ---- Rendering --------------------------------------------------------
  function renderResults(raw, matches) {
    if (!matches.length) {
      renderNoResults(raw);
      return;
    }

    const capped = matches.slice(0, MAX_RESULTS);
    const cards = capped.map(renderCard).join('');

    const flagged = matches.filter(function (m) { return m.d === 1; }).length;
    const flagNote = flagged
      ? ' <span class="heading-warn">— <strong>' + flagged +
        '</strong> with a state action on record</span>'
      : '';

    const moreNote = matches.length > MAX_RESULTS
      ? '<p class="results-note">Showing the first ' + MAX_RESULTS + ' of ' +
        matches.length + '. Add a first name to narrow it down.</p>'
      : '';

    resultsEl.innerHTML =
      '<p class="results-heading">' +
      matches.length + ' Florida dentist' + (matches.length === 1 ? '' : 's') +
      ' named <strong>' + escapeHtml(raw) + '</strong>' + flagNote + '</p>' +
      moreNote +
      '<div class="provider-list">' + cards + '</div>' +
      '<p class="results-disclaimer">More than one dentist can share the same name. ' +
      'Always open the official state record to make sure it is the right person. ' +
      'Vetera shows public records only — no opinions or ratings.</p>';
  }

  function renderCard(rec) {
    const name = titleCase((rec.f + ' ' + (rec.n ? rec.n + ' ' : '') + rec.l).trim());

    // License line
    let licIcon, licText;
    if (rec.a === 1) {
      licIcon = 'good';
      licText = 'Licensed and active as a dentist in Florida right now.' +
        (rec.e ? ' License good until ' + escapeHtml(rec.e) + '.' : '');
    } else {
      licIcon = 'gray';
      licText = 'Not active right now: ' + escapeHtml((rec.s || 'status unknown').toLowerCase()) + '.';
    }

    // Discipline line
    let discIcon, discText;
    if (rec.d === 1) {
      discIcon = 'warn';
      discText = 'The state has a record of action against this dentist. ' +
        'See the official record to learn what happened.';
    } else {
      discIcon = 'good';
      discText = 'No state action on record.';
    }

    const cardClass = 'provider-card' + (rec.d === 1 ? ' provider-card-flag' : '');

    return (
      '<div class="' + cardClass + '">' +
      '<h4>' + dot(rec.d === 1 ? 'yellow' : (rec.a === 1 ? 'green' : 'gray')) +
      escapeHtml(name) + '</h4>' +
      '<p class="fact-line">' + mark(licIcon) + escapeHtml(licText) + '</p>' +
      '<p class="fact-line">' + mark(discIcon) + discText + '</p>' +
      '<div class="provider-actions">' +
      '<button type="button" class="action-btn action-btn-primary" data-flboard ' +
      'data-last="' + escapeHtml(rec.l) + '" data-first="' + escapeHtml(rec.f) + '" ' +
      'data-url="' + FL_DOH_URL + '">' +
      'See the official Florida state record ↗</button>' +
      '</div>' +
      '</div>'
    );
  }

  function renderNoResults(raw) {
    const { first, last } = parseName(raw);
    resultsEl.innerHTML =
      '<p class="results-heading">We did not find a Florida dentist named ' +
      '<strong>' + escapeHtml(raw) + '</strong>.</p>' +
      '<div class="no-results-help">' +
      '<p><strong>This can happen if:</strong></p>' +
      '<ul>' +
      '<li>The name is spelled a little differently — try just the last name.</li>' +
      '<li>They are a dental hygienist or assistant, not a dentist.</li>' +
      '<li>They are licensed in another state, not Florida.</li>' +
      '</ul>' +
      '<p>You can also check the official Florida state site yourself:</p>' +
      '<p><button type="button" class="flboard-btn" data-flboard ' +
      'data-last="' + escapeHtml(last) + '" data-first="' + escapeHtml(first) + '" ' +
      'data-url="' + FL_DOH_URL + '">' +
      'Copy the name &amp; open the Florida state search (new tab)</button></p>' +
      '</div>';
  }

  function dot(color) {
    return '<span class="status-dot dot-' + color + '" aria-hidden="true">●</span>';
  }
  function mark(kind) {
    if (kind === 'good') return '<span class="fact-mark fact-good" aria-hidden="true">✓</span> ';
    if (kind === 'warn') return '<span class="fact-mark fact-warn" aria-hidden="true">⚠</span> ';
    return '<span class="fact-mark fact-gray" aria-hidden="true">•</span> ';
  }

  function titleCase(s) {
    return (s || '').toLowerCase().replace(/\b([a-z])/g, function (m, c) {
      return c.toUpperCase();
    });
  }

  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---- "Open the official state record" buttons -------------------------
  // Copies the name to the clipboard, then opens the FL DOH portal in a new
  // tab so the user can paste and see the full official record.
  resultsEl.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-flboard]');
    if (!btn) return;
    e.preventDefault();
    const last = btn.getAttribute('data-last') || '';
    const first = btn.getAttribute('data-first') || '';
    const url = btn.getAttribute('data-url') || '';
    const toCopy = last + (first ? ', ' + first : '');

    function openPortal() {
      window.open(url, '_blank', 'noopener,noreferrer');
      flashCopied(btn, toCopy);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(toCopy).then(openPortal).catch(openPortal);
    } else {
      openPortal();
    }
  });

  function flashCopied(btn, copiedText) {
    const original = btn.innerHTML;
    btn.innerHTML = '✓ Copied "<em>' + escapeHtml(copiedText) +
      '</em>" — paste it into the state search box.';
    btn.classList.add('flboard-btn-copied');
    setTimeout(function () {
      btn.innerHTML = original;
      btn.classList.remove('flboard-btn-copied');
    }, 8000);
  }
})();
