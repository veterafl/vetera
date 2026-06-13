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
  let DATA = null; // array of records, each with precomputed name tokens

  function loadDentists() {
    if (dataPromise) return dataPromise;
    dataPromise = fetch('data/dentists.json')
      .then(function (r) {
        if (!r.ok) throw new Error('load failed');
        return r.json();
      })
      .then(function (records) {
        // Precompute name tokens so compound surnames ("Martinez Coronel") and
        // names typed with middle names all match correctly.
        for (let i = 0; i < records.length; i++) {
          const rec = records[i];
          rec.__lt = tokenize(rec.l);                       // last-name tokens
          rec.__ft = tokenize(rec.f);                       // first-name tokens
          rec.__at = tokenize(rec.f + ' ' + (rec.n || '') + ' ' + rec.l); // all
        }
        DATA = records;
        return records;
      });
    return dataPromise;
  }

  function normName(s) {
    return (s || '').toString().trim().toUpperCase();
  }

  // Split a name into uppercase word tokens, breaking on spaces, hyphens,
  // apostrophes, periods — so "Martinez Coronel", "Al-Rashid", "O'Brien" all
  // become clean token lists.
  function tokenize(s) {
    return (s || '')
      .toString()
      .toUpperCase()
      .split(/[^A-Z0-9]+/)
      .filter(Boolean);
  }

  function parseName(raw) {
    const stripped = raw.replace(/^(dr\.?|doctor)\s+/i, '').trim();
    const parts = stripped.split(/\s+/);
    if (parts.length === 1) return { first: '', last: parts[0] };
    return { first: parts[0], last: parts[parts.length - 1] };
  }

  // Decide whether a record matches the typed query.
  // - One word: match it as a last-name token OR a first-name token.
  // - Several words: every typed word must appear somewhere in the name, AND at
  //   least one of them must be part of the last name (so we don't blame a
  //   same-first-name stranger). Handles compound surnames and middle names.
  function recordMatches(rec, q) {
    if (q.length === 1) {
      const t = q[0];
      return rec.__lt.indexOf(t) !== -1 || rec.__ft.indexOf(t) !== -1;
    }
    for (let i = 0; i < q.length; i++) {
      if (rec.__at.indexOf(q[i]) === -1) return false;
    }
    for (let i = 0; i < q.length; i++) {
      if (rec.__lt.indexOf(q[i]) !== -1) return true;
    }
    return false;
  }

  function findMatches(raw) {
    // Drop a leading honorific ("Dr.", "Doctor", "Prof.") so "Dr. Adelson"
    // matches the same as "Adelson" — patients commonly type the title.
    const cleaned = (raw || '').replace(/^\s*(dr\.?|doctor|prof\.?)\s+/i, '');
    const q = tokenize(cleaned);
    if (!q.length || !DATA) return [];
    const out = [];
    for (let i = 0; i < DATA.length; i++) {
      if (recordMatches(DATA[i], q)) out.push(DATA[i]);
    }
    return out;
  }

  // Count a "use" = one search performed. Sends NO name or personal data —
  // only that a search happened and whether it found a dentist. This is the
  // pilot's core metric (target ~1000 uses). window.va is the Vercel Web
  // Analytics queue stub from analytics.js (free on the Hobby plan, custom
  // events included); the try/catch makes tracking a no-op if it's disabled.
  function trackSearch(count) {
    try {
      if (typeof window.va === 'function') {
        window.va('event', { name: 'search', result: count > 0 ? 'found' : 'none' });
      }
    } catch (e) { /* analytics must never break search */ }
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

    let matches = findMatches(raw);

    // Rank by how serious the record is: severe first, then caution, then the
    // rest — and active before inactive within each.
    function rank(r) {
      const t = statusInfo(r).tier;
      return t === 'severe' ? 2 : (t === 'caution' ? 1 : 0);
    }
    matches.sort(function (a, b) {
      if (rank(b) !== rank(a)) return rank(b) - rank(a);
      if (b.a !== a.a) return b.a - a.a;
      return a.l.localeCompare(b.l);
    });

    trackSearch(matches.length);
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

    const severe = matches.filter(function (m) { return statusInfo(m).tier === 'severe'; }).length;
    const flagNote = severe
      ? ' <span class="heading-warn">— <strong>' + severe +
        '</strong> with a state disciplinary action</span>'
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

  // Florida's status, shortened to its plainest 1–2 word form. We do not change
  // the meaning — the full official wording stays on the state record button.
  // Tiers control how loudly it shows: 'severe' (disciplinary outcome — red),
  // 'caution' (active but owes something — amber), 'good' (licensed — green),
  // 'neutral' (simply not active — gray).
  const STATUS_SHORT = {
    'licensed and in good standing': 'License active',
    'license no longer valid': 'No longer valid',
    'deceased': 'Deceased',
    'retired': 'Retired',
    'license lapsed (delinquent)': 'License lapsed',
    'voluntarily gave up license': 'License surrendered',
    'licensed (military active status)': 'Military status',
    'gave up license during a state action': 'Surrendered during action',
    'license revoked by the state': 'License revoked',
    'licensed, has outstanding obligations': 'Outstanding obligations',
    'application expired': 'Application expired',
    'licensed, but on probation': 'On probation',
    'license suspended by the state': 'License suspended',
    'licensed with conditions': 'With conditions',
    'renewal denied': 'Renewal denied'
  };

  function statusInfo(rec) {
    const s = (rec.s || '').toLowerCase();
    let tier;
    if (s.indexOf('revoked') !== -1 || s.indexOf('suspended') !== -1 ||
        s.indexOf('probation') !== -1 || s.indexOf('renewal denied') !== -1 ||
        s.indexOf('gave up license during a state action') !== -1) {
      tier = 'severe';
    } else if (s.indexOf('outstanding obligations') !== -1) {
      tier = 'caution';
    } else if (rec.a === 1) {
      tier = 'good';
    } else {
      tier = 'neutral';
    }
    const text = STATUS_SHORT[s] || (rec.s || 'Status unknown');
    return { tier: tier, text: text };
  }

  function renderCard(rec) {
    const name = titleCase((rec.f + ' ' + (rec.n ? rec.n + ' ' : '') + rec.l).trim());

    // One color-coded status line — Florida's own status, condensed. Color does
    // the work: green = active/good, red = a disciplinary action, amber = active
    // but owes something, gray = simply not active. No opinion on the person.
    const st = statusInfo(rec);
    const stIcon = st.tier === 'severe' ? 'bad'
      : (st.tier === 'caution' ? 'warn' : (st.tier === 'good' ? 'good' : 'gray'));

    let cardClass = 'provider-card';
    if (st.tier === 'severe') cardClass += ' provider-card-severe';
    else if (st.tier === 'caution') cardClass += ' provider-card-flag';

    const headDot = st.tier === 'severe' ? 'red'
      : (st.tier === 'caution' ? 'yellow' : (rec.a === 1 ? 'green' : 'gray'));

    return (
      '<div class="' + cardClass + '">' +
      '<h4>' + dot(headDot) + escapeHtml(name) + '</h4>' +
      (rec.c ? '<p class="provider-city">' + escapeHtml(rec.c) + ', FL</p>' : '') +
      '<p class="fact-line">' + mark(stIcon) +
      '<span>' + escapeHtml(st.text) + '</span></p>' +
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
    if (kind === 'bad') return '<span class="fact-mark fact-bad" aria-hidden="true">⚠</span> ';
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
