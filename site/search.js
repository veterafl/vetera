// Vetera Quick Check: queries the federal NPI Registry (CORS-friendly public
// API) and shows the data inline. Also checks our local OIG FL exclusions JSON
// and curated FL Board discipline JSON so verified findings appear in the
// summary. For sources without API access (FL Board portal, OIG LEIE search,
// SAM.gov), provides one-click copy-and-open helpers.

(function () {
  const form = document.getElementById('searchForm');
  const input = document.getElementById('providerName');
  const professionEl = document.getElementById('professionFilter');
  const resultsEl = document.getElementById('searchResults');
  if (!form || !input || !resultsEl) return;

  // Data loaded via <script> tags into window globals — works on file:// too,
  // unlike fetch() which most browsers block for local files.
  function loadOig() {
    return Promise.resolve(window.VETERA_OIG || []);
  }

  function loadFlBoard() {
    return Promise.resolve(window.VETERA_FL_BOARD || { cases: [] });
  }

  function normName(s) {
    return (s || '').toString().trim().toUpperCase();
  }

  // Name match logic — strict to avoid false positives that wrongly attribute
  // findings to similarly-named providers (a serious legal/ethical concern).
  // - Last name must match exactly.
  // - First name (if provided by user) must match exactly, OR match by initial
  //   only when the user provided a single-letter initial themselves.
  function namesMatch(inputFirst, recordFirst) {
    const f = normName(inputFirst);
    const r = normName(recordFirst);
    if (!f) return true; // user gave only a last name — no first-name filter
    if (f === r) return true; // exact match
    // Allow initial-only match only when the USER typed a single-letter initial
    if (f.length === 1 && r && r[0] === f) return true;
    return false;
  }

  function findOigMatches(oig, firstName, lastName) {
    const l = normName(lastName);
    if (!l) return [];
    // When only one name term is given, accept it as either first OR last
    const oneName = !!l && !firstName;
    return oig.filter(function (e) {
      if (normName(e.last) === l) {
        if (oneName) return true;
        return namesMatch(firstName, e.first);
      }
      if (oneName && normName(e.first) === l) return true;
      return false;
    });
  }

  function findFlBoardMatches(flBoard, firstName, lastName) {
    const l = normName(lastName);
    if (!l) return [];
    const oneName = !!l && !firstName;
    return (flBoard.cases || []).filter(function (c) {
      // Primary name match
      if (normName(c.last) === l) {
        if (oneName) return true;
        if (namesMatch(firstName, c.first)) return true;
      }
      if (oneName && normName(c.first) === l) return true;
      // Aliases
      if (Array.isArray(c.aliases)) {
        for (let i = 0; i < c.aliases.length; i++) {
          const a = c.aliases[i];
          if (normName(a.last) === l) {
            if (oneName) return true;
            if (namesMatch(firstName, a.first)) return true;
          }
          if (oneName && normName(a.first) === l) return true;
        }
      }
      return false;
    });
  }

  // Only show retirees verified within the last 6 months.
  // Older retirements are dropped to keep the list relevant.
  function isWithin6Months(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    return d >= cutoff;
  }

  function findRetiredMatches(retired, firstName, lastName, city) {
    const l = normName(lastName);
    if (!l) return [];
    const oneName = !!l && !firstName;
    const providers = (retired && retired.providers) || [];
    return providers.filter(function (p) {
      if (!isWithin6Months(p.verified_date)) return false;
      if (normName(p.last) === l) {
        if (oneName) return true;
        return namesMatch(firstName, p.first);
      }
      if (oneName && normName(p.first) === l) return true;
      return false;
    });
  }

  function allRecentRetired(retired) {
    return ((retired && retired.providers) || []).filter(function (p) {
      return isWithin6Months(p.verified_date);
    });
  }

  function loadRetired() {
    return Promise.resolve(window.VETERA_FL_RETIRED || { providers: [] });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const raw = input.value.trim();
    if (!raw) return;
    document.body.classList.add('has-results');
    const profession = professionEl ? professionEl.value : '';
    runSearch(raw, profession);
  });

  // Clickable example search on home page
  const exampleLink = document.getElementById('exampleSearch');
  if (exampleLink) {
    exampleLink.addEventListener('click', function (e) {
      e.preventDefault();
      const name = exampleLink.getAttribute('data-name') || '';
      input.value = name;
      document.body.classList.add('has-results');
      runSearch(name, '');
    });
  }

  // Return to home view: triggered by clicking the logo OR the "New search" button
  function returnToHome() {
    document.body.classList.remove('has-results');
    input.value = '';
    if (professionEl) professionEl.value = '';
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
  if (newSearchBtn) {
    newSearchBtn.addEventListener('click', returnToHome);
  }

  function parseName(raw) {
    const stripped = raw.replace(/^(dr\.?|doctor)\s+/i, '').trim();
    const parts = stripped.split(/\s+/);
    if (parts.length === 1) return { first: '', last: parts[0] };
    return { first: parts[0], last: parts[parts.length - 1] };
  }

  // Recognise keyword/category searches like "retired", "findings", "death"
  function detectCategory(raw) {
    const q = (raw || '').toLowerCase().trim();
    if (!q) return null;
    if (/^(retired|retired providers?)$/.test(q)) return 'retired';
    if (/^(findings?|discipline|disciplined|disciplinary|flagged|problems?)$/.test(q)) return 'findings';
    if (/(patient death|death|died)/.test(q)) return 'death';
    if (/(fraud|criminal|theft|medicaid fraud)/.test(q)) return 'fraud';
    if (q === 'oig' || q === 'sanctions') return 'oig';
    return null;
  }

  async function runSearch(raw, profession) {
    resultsEl.innerHTML =
      '<p class="results-status">Looking up Florida providers...</p>';

    // Kick off local dataset loads in parallel with the NPI search
    const oigPromise = loadOig();
    const flBoardPromise = loadFlBoard();
    const retiredPromise = loadRetired();

    // Keyword search short-circuits the NPI lookup
    const category = detectCategory(raw);
    if (category) {
      const [oig, flBoard, retired] = await Promise.all([
        oigPromise,
        flBoardPromise,
        retiredPromise,
      ]);
      const providers = buildCategoryProviders(category, flBoard, retired, oig);
      renderResults(raw, providers, profession, oig, flBoard, retired);
      return;
    }


    const params = new URLSearchParams({
      terms: raw,
      maxList: '40',
      ef: 'licenses,addresses',
    });

    let providers = [];
    try {
      const res = await fetch(
        'https://clinicaltables.nlm.nih.gov/api/npi_idv/v3/search?' +
          params.toString()
      );
      if (res.ok) {
        const data = await res.json();
        providers = parseClinicalTablesResponse(data);

        // Filter to Florida (provider has at least one FL license OR FL address)
        providers = providers.filter((p) => {
          const flLicense = (p.licenses || []).some(
            (l) => (l.lic_state || '').toUpperCase() === 'FL'
          );
          const flAddress = (p.addresses || []).some(
            (a) =>
              ((a.adr_state || a.state || '') + '').toUpperCase() === 'FL'
          );
          // Display row may contain "FL" in the address string fallback
          const rowHasFL = (p.displayRow[3] || '').toUpperCase().includes(' FL ') ||
                          (p.displayRow[3] || '').toUpperCase().endsWith(' FL') ||
                          (p.displayRow[3] || '').toUpperCase().includes(', FL ');
          return flLicense || flAddress || rowHasFL;
        });

        // Filter by profession if specified
        if (profession) {
          const needle = profession.toLowerCase();
          providers = providers.filter((p) => {
            return (p.licenses || []).some((lic) => {
              const cls = ((lic.taxonomy && lic.taxonomy.classification) || '')
                .toLowerCase();
              const grp = ((lic.taxonomy && lic.taxonomy.grouping) || '')
                .toLowerCase();
              return (
                cls.includes(needle) ||
                needle.includes(cls) ||
                grp.includes(needle)
              );
            });
          });
        }
      }
    } catch (err) {
      providers = [];
    }

    const [oig, flBoard, retired] = await Promise.all([
      oigPromise,
      flBoardPromise,
      retiredPromise,
    ]);

    // Add any retired providers matching the search that NPI didn't return.
    // (Retired providers sometimes have deactivated NPIs and won't appear via
    // the federal API, but we still want them surfaced from our local list.)
    const { first: searchFirst, last: searchLast } = parseName(raw);

    // Helper: check if a name already exists in the results
    function alreadyInResults(last, first) {
      return providers.some(function (p) {
        const row = p.displayRow || [];
        const parts = (row[0] || '').split(',').map((s) => s.trim());
        return (
          normName(parts[0]) === normName(last) &&
          (!first || normName(parts[1]) === normName(first))
        );
      });
    }

    // Add retired providers not already in NPI results
    findRetiredMatches(retired, searchFirst, searchLast, '').forEach(function (r) {
      if (alreadyInResults(r.last, r.first)) return;
      providers.push({
        npi: '',
        displayRow: [
          (r.last || '').toUpperCase() + ', ' + (r.first || '').toUpperCase(),
          '',
          r.specialty || '',
          (r.city || '') + ', FL',
        ],
        licenses: [],
        addresses: [],
        _syntheticRetired: true,
      });
    });

    // Add FL Board disciplined providers not already in NPI results.
    // This handles aliases (Sebastiani searched as "Franco") and any provider
    // whose NPI didn't show up in the federal search.
    findFlBoardMatches(flBoard, searchFirst, searchLast).forEach(function (c) {
      if (alreadyInResults(c.last, c.first)) return;
      // Also skip if any alias is already in results
      if (Array.isArray(c.aliases) && c.aliases.some(function (a) {
        return alreadyInResults(a.last, a.first);
      })) return;
      providers.push({
        npi: '',
        displayRow: [
          (c.last || '').toUpperCase() + ', ' + (c.first || '').toUpperCase(),
          '',
          c.specialty || '',
          (c.city || '') + ', FL',
        ],
        licenses: c.license
          ? [{
              taxonomy: { classification: c.specialty || '' },
              lic_number: c.license,
              lic_state: c.license_state || 'FL',
              is_primary_taxonomy: 'Y',
            }]
          : [],
        addresses: [],
        _syntheticFlBoard: true,
      });
    });

    renderResults(raw, providers, profession, oig, flBoard, retired);
  }

  // Build synthetic provider entries from local data for category searches.
  function buildCategoryProviders(category, flBoard, retired, oig) {
    const out = [];

    function syntheticFromBoard(c) {
      return {
        npi: '',
        displayRow: [
          (c.last || '').toUpperCase() + ', ' + (c.first || '').toUpperCase(),
          '',
          c.specialty || '',
          (c.city || '') + ', FL',
        ],
        licenses: c.license
          ? [{
              taxonomy: { classification: c.specialty || '' },
              lic_number: c.license,
              lic_state: c.license_state || 'FL',
              is_primary_taxonomy: 'Y',
            }]
          : [],
        addresses: [],
        _syntheticCategory: category,
      };
    }

    function syntheticFromRetired(r) {
      return {
        npi: '',
        displayRow: [
          (r.last || '').toUpperCase() + ', ' + (r.first || '').toUpperCase(),
          '',
          r.specialty || '',
          (r.city || '') + ', FL',
        ],
        licenses: [],
        addresses: [],
        _syntheticRetired: true,
      };
    }

    function syntheticFromOig(e) {
      return {
        npi: e.npi || '',
        displayRow: [
          (e.last || '').toUpperCase() + ', ' + (e.first || '').toUpperCase(),
          e.npi || '',
          e.specialty || '',
          (e.city || '') + ', FL',
        ],
        licenses: [],
        addresses: [],
        _syntheticCategory: 'oig',
      };
    }

    if (category === 'retired') {
      allRecentRetired(retired).forEach(function (r) {
        out.push(syntheticFromRetired(r));
      });
    } else if (category === 'findings' || category === 'discipline') {
      ((flBoard && flBoard.cases) || []).forEach(function (c) {
        out.push(syntheticFromBoard(c));
      });
    } else if (category === 'death') {
      ((flBoard && flBoard.cases) || []).forEach(function (c) {
        const hasDeath = (c.actions || []).some(function (a) {
          const t = ((a.summary || '') + ' ' + (a.type || '')).toLowerCase();
          return t.includes('death') || t.includes('died');
        });
        if (hasDeath) out.push(syntheticFromBoard(c));
      });
    } else if (category === 'fraud') {
      ((flBoard && flBoard.cases) || []).forEach(function (c) {
        const hasFraud = (c.actions || []).some(function (a) {
          const t = ((a.summary || '') + ' ' + (a.type || '')).toLowerCase();
          return t.includes('fraud') || t.includes('theft') || t.includes('racketeering') || t.includes('criminal');
        });
        if (hasFraud) out.push(syntheticFromBoard(c));
      });
    } else if (category === 'oig') {
      // Cap at 50 — the full list is 9k entries
      (oig || []).slice(0, 50).forEach(function (e) {
        out.push(syntheticFromOig(e));
      });
    }

    return out;
  }

  function parseClinicalTablesResponse(data) {
    // NIH Clinical Tables returns: [total, [npis], {ef arrays}, [[displayCols]]]
    if (!Array.isArray(data) || data.length < 4) return [];
    const npis = data[1] || [];
    const extra = data[2] || {};
    const rows = data[3] || [];
    const licensesArr = extra.licenses || [];
    const addressesArr = extra.addresses || [];
    return npis.map(function (npi, i) {
      return {
        npi: npi,
        displayRow: rows[i] || [],
        licenses: licensesArr[i] || [],
        addresses: addressesArr[i] || [],
      };
    });
  }

  function renderResults(raw, providers, profession, oig, flBoard, retired) {
    const professionLabel = profession
      ? ' (' + escapeHtml(profession) + ')'
      : '';

    if (!providers.length) {
      const { first, last } = parseName(raw);
      const flDohUrl = 'https://mqa-internet.doh.state.fl.us/mqasearchservices/home';
      const toCopy = last + (first ? ', ' + first : '');
      resultsEl.innerHTML =
        '<p class="results-heading">No federal NPI Registry record matching <strong>' +
        escapeHtml(raw) +
        '</strong>' +
        professionLabel +
        ' in Florida.</p>' +
        '<div class="no-results-help">' +
        '<p><strong>This is common for:</strong></p>' +
        '<ul>' +
        '<li><strong>Dental hygienists and dental assistants</strong> — often not in the federal NPI Registry because they bill under their employer dentist\'s NPI</li>' +
        '<li><strong>Retired providers</strong> who deactivated their NPI</li>' +
        '<li><strong>Typos or different spellings</strong> in the name</li>' +
        '</ul>' +
        '<p>The Florida Department of Health licenses all dentists, hygienists, and assistants — search the state database directly:</p>' +
        '<p>' +
        '<button type="button" class="flboard-btn" ' +
        'data-flboard ' +
        'data-last="' + escapeHtml(last) + '" ' +
        'data-first="' + escapeHtml(first) + '" ' +
        'data-url="' + flDohUrl + '">' +
        'Copy name &amp; open FL DOH license search (new tab)' +
        '</button>' +
        '</p>' +
        '</div>' +
        renderGenericSourcesPanel(raw);
      return;
    }

    // Count providers with findings for the heading
    const providersWithFindings = providers.filter(function (p) {
      const row = p.displayRow || [];
      const nameRaw = row[0] || '';
      const nameParts = nameRaw.split(',').map((s) => s.trim());
      const last = nameParts[0] || '';
      const first = nameParts[1] || '';
      return (
        findFlBoardMatches(flBoard, first, last).length > 0 ||
        findOigMatches(oig, first, last).length > 0
      );
    }).length;

    // Sort providers with findings to the top
    providers.sort(function (a, b) {
      const aHas = (function () {
        const row = a.displayRow || [];
        const nameParts = (row[0] || '').split(',').map((s) => s.trim());
        return (
          findFlBoardMatches(flBoard, nameParts[1] || '', nameParts[0] || '').length +
          findOigMatches(oig, nameParts[1] || '', nameParts[0] || '').length
        );
      })();
      const bHas = (function () {
        const row = b.displayRow || [];
        const nameParts = (row[0] || '').split(',').map((s) => s.trim());
        return (
          findFlBoardMatches(flBoard, nameParts[1] || '', nameParts[0] || '').length +
          findOigMatches(oig, nameParts[1] || '', nameParts[0] || '').length
        );
      })();
      return bHas - aHas;
    });

    const cards = providers
      .map((p) => renderProviderCard(p, raw, oig, flBoard, retired))
      .join('');

    const headingExtra = providersWithFindings > 0
      ? ' <span class="heading-warn">— <strong>' +
        providersWithFindings +
        '</strong> with public-record entries</span>'
      : '';

    resultsEl.innerHTML =
      '<div class="findings-anchor" id="findings">' +
      '<p class="results-heading">' +
      providers.length +
      ' Florida provider' +
      (providers.length === 1 ? '' : 's') +
      ' matching <strong>' +
      escapeHtml(raw) +
      '</strong>' +
      professionLabel +
      headingExtra +
      '. Click any topic to see details.</p>' +
      '</div>' +
      '<div class="provider-list">' +
      cards +
      '</div>';
  }

  function renderProviderCard(provider, raw, oig, flBoard, retired) {
    // Display row: ["LASTNAME, FIRSTNAME","NPI","Medicare specialty","ADDRESS"]
    const row = provider.displayRow || [];
    const nameRaw = row[0] || '';
    const nameParts = nameRaw.split(',').map((s) => s.trim());
    const lastName = nameParts[0] || '';
    const firstName = nameParts[1] || '';
    const fullName = (firstName + ' ' + lastName).trim() || nameRaw || 'Unknown';
    const displayName = fullName;

    const npi = provider.npi || row[1] || '';
    const medicareSpecialty = row[2] || '';
    const addressFallback = row[3] || '';

    // Pull license/specialty info, preferring Florida primary
    const licenses = provider.licenses || [];
    const flLicense = licenses.find(
      (l) =>
        (l.lic_state || '').toUpperCase() === 'FL' &&
        l.is_primary_taxonomy === 'Y'
    ) ||
      licenses.find((l) => (l.lic_state || '').toUpperCase() === 'FL') ||
      licenses.find((l) => l.is_primary_taxonomy === 'Y') ||
      licenses[0] ||
      {};

    const specialty =
      (flLicense.taxonomy && flLicense.taxonomy.classification) ||
      medicareSpecialty ||
      '—';
    const license = flLicense.lic_number || '';
    const licenseState = flLicense.lic_state || '';

    const addrLine = addressFallback;
    const cityStateMatch = addressFallback.match(/,\s*([A-Za-z .'-]+),\s*([A-Z]{2})\b/);
    const cityState = cityStateMatch
      ? cityStateMatch[1].trim() + ', ' + cityStateMatch[2]
      : '';

    const flDohUrl =
      'https://mqa-internet.doh.state.fl.us/mqasearchservices/home';
    const npiSearchUrl =
      'https://npiregistry.cms.hhs.gov/provider-view/' + encodeURIComponent(npi);
    const leieUrl = 'https://exclusions.oig.hhs.gov/';
    const samUrl = 'https://sam.gov/search/?index=ex';

    const flBoardHits = findFlBoardMatches(flBoard, firstName, lastName);
    const oigHits = findOigMatches(oig, firstName, lastName);
    const retiredHits = findRetiredMatches(retired, firstName, lastName, cityState);
    const findingsBanner = renderFindingsBanner(flBoardHits, oigHits);
    const retiredBanner = renderRetiredBanner(retiredHits);

    // Determine severity for visual treatment
    const hasFindings = flBoardHits.length > 0 || oigHits.length > 0;
    const hasSevere = flBoardHits.some(function (c) {
      return (c.actions || []).some(function (a) {
        const s = (a.severity || '').toLowerCase();
        const text = ((a.summary || '') + ' ' + (a.type || '')).toLowerCase();
        return s === 'serious' || s === 'severe' || text.includes('death') || text.includes('died');
      });
    });

    const cardClass =
      'provider-card' +
      (hasSevere ? ' provider-card-severe' : '') +
      (hasFindings && !hasSevere ? ' provider-card-flag' : '');

    const isRetired = retiredHits.length > 0;

    // Traffic-light status dot + one-line plain-English verdict
    let statusDot, verdictText;
    if (hasSevere) {
      statusDot = '<span class="status-dot dot-red" aria-label="serious finding">●</span>';
      const sev = (flBoardHits[0] && flBoardHits[0].actions && flBoardHits[0].actions[0]) || {};
      const date = sev.date ? ' (' + escapeHtml(sev.date) + ')' : '';
      verdictText = 'Serious problem on record' + date;
    } else if (hasFindings) {
      statusDot = '<span class="status-dot dot-yellow" aria-label="finding on record">●</span>';
      verdictText = 'Past issue on record';
    } else if (isRetired) {
      statusDot = '<span class="status-dot dot-gray" aria-label="retired">●</span>';
      verdictText = 'Retired — no longer seeing patients';
    } else {
      statusDot = '<span class="status-dot dot-green" aria-label="nothing found">●</span>';
      verdictText = 'No red flags';
    }

    return (
      '<div class="' + cardClass + '">' +
      '<h4>' +
      statusDot +
      escapeHtml(displayName) +
      '</h4>' +
      '<p class="verdict-line">' + verdictText + '</p>' +
      '<p class="provider-summary">' +
      escapeHtml(specialty) +
      (cityState ? ' &middot; ' + escapeHtml(cityState) : '') +
      '</p>' +
      retiredBanner +
      findingsBanner +
      // Inline facts (license + address)
      (license || addrLine
        ? '<dl class="provider-facts">' +
          (license
            ? '<dt>License</dt><dd>' + escapeHtml(license) +
              (licenseState ? ' (' + escapeHtml(licenseState) + ')' : '') +
              '</dd>'
            : '') +
          (addrLine
            ? '<dt>Address</dt><dd>' + escapeHtml(addrLine) + '</dd>'
            : '') +
          '</dl>'
        : '') +
      // One primary action — verify on FL Board
      '<div class="provider-actions">' +
      '<button type="button" class="action-btn action-btn-primary" ' +
      'data-flboard ' +
      'data-last="' + escapeHtml(lastName) + '" ' +
      'data-first="' + escapeHtml(firstName) + '" ' +
      'data-url="' + flDohUrl + '">' +
      'See full record on Florida state site ↗' +
      '</button>' +
      '</div>' +
      '</div>'
    );
  }

  // Render source links — supports either a single `source_url`/`source_label`
  // pair (legacy) or an array of `sources: [{url, label}]` (preferred).
  // If verification.primary_source_url is set, it's listed first as the primary.
  function renderSources(action) {
    const list = [];
    const v = action.verification || {};
    if (v.primary_source_url) {
      list.push({
        url: v.primary_source_url,
        label: v.primary_source_label || 'Primary record (FL DOH)',
        primary: true,
      });
    }
    if (Array.isArray(action.sources)) {
      action.sources.forEach(function (s) {
        if (s && s.url) list.push(s);
      });
    }
    if (action.source_url) {
      list.push({ url: action.source_url, label: action.source_label || 'Source' });
    }
    if (!list.length) return '';
    return (
      '<p><strong>Public-record source' +
      (list.length > 1 ? 's' : '') +
      ':</strong> ' +
      list
        .map(function (s) {
          return (
            '<a href="' +
            s.url +
            '" target="_blank" rel="noopener">' +
            (s.primary ? '<strong>' : '') +
            escapeHtml(s.label || 'source') +
            (s.primary ? '</strong>' : '') +
            ' ↗</a>'
          );
        })
        .join(' &middot; ') +
      '</p>'
    );
  }

  // Render a caution sub-banner when the primary FL DOH PDF isn't linked yet.
  // Legally important: if we present press paraphrase as "what the Board said"
  // without the official order linked, we lose fair-report privilege.
  function renderVerificationNotice(action) {
    const v = action.verification || {};
    const status = v.status || (action.sources || action.source_url ? 'press_only' : 'press_only');
    if (status === 'verified_primary') return '';
    const label =
      status === 'pending'
        ? 'Case still pending at the regulator'
        : 'Primary source (official FL DOH document) not yet linked';
    const body =
      status === 'pending'
        ? 'This action has not been finalized. Findings shown are allegations or interim filings, not a concluded Board decision.'
        : 'The summary below is drawn from press coverage of the FL Board / FL DOH document, not from the order itself. Wording may not match the official record verbatim. Treat as a pointer to the underlying public record — verify the details by clicking the source link.';
    return (
      '<div class="verification-notice">' +
      '<strong>⚠ ' + escapeHtml(label) + '.</strong> ' +
      escapeHtml(body) +
      '</div>'
    );
  }

  function renderRetiredBanner(retiredHits) {
    if (!retiredHits.length) return '';
    const r = retiredHits[0];
    return (
      '<div class="retired-banner">' +
      '<strong>Retired provider.</strong> Per our records, this provider has retired from clinical practice' +
      (r.verified_date ? ' (verified ' + escapeHtml(r.verified_date) + ')' : '') +
      '. ' +
      (r.note ? escapeHtml(r.note) + ' ' : '') +
      'Their license entry may remain visible in registries even though they are no longer seeing patients. ' +
      'If you believe this is incorrect, please <a href="terms.html">submit a correction</a>.' +
      '</div>'
    );
  }

  function renderFindingsBanner(flBoardHits, oigHits) {
    if (!flBoardHits.length && !oigHits.length) {
      return '';
    }

    // Detect the most severe finding for top-level treatment
    let mostSevere = null;
    flBoardHits.forEach(function (c) {
      (c.actions || []).forEach(function (a) {
        const text = ((a.summary || '') + ' ' + (a.type || '')).toLowerCase();
        const sev = (a.severity || '').toLowerCase();
        const isPatientDeath = text.includes('death') || text.includes('died');
        const isSerious = sev === 'serious' || sev === 'severe';
        if (isPatientDeath || isSerious) {
          if (!mostSevere || isPatientDeath) {
            mostSevere = { case: c, action: a, isDeath: isPatientDeath };
          }
        }
      });
    });

    let html = '';

    if (mostSevere) {
      html +=
        '<div class="severe-banner">' +
        '<div class="severe-banner-header">' +
        '⚠ Past problem on record' +
        (mostSevere.action.date
          ? ' — ' + escapeHtml(mostSevere.action.date)
          : '') +
        '</div>' +
        '<div class="severe-banner-body">' +
        renderVerificationNotice(mostSevere.action) +
        '<p><strong>Action:</strong> ' +
        escapeHtml(mostSevere.action.type || 'Disciplinary action') +
        '</p>' +
        '<p><strong>Summary of public record:</strong> ' +
        escapeHtml(mostSevere.action.summary || '') +
        '</p>' +
        (mostSevere.action.penalty
          ? '<p><strong>Penalty imposed:</strong> ' +
            escapeHtml(mostSevere.action.penalty) +
            '</p>'
          : '') +
        (mostSevere.action.restriction
          ? '<p><strong>Restriction in effect:</strong> ' +
            escapeHtml(mostSevere.action.restriction) +
            '</p>'
          : '') +
        renderSources(mostSevere.action) +
        '<p class="severe-action-note">This entry reports a public regulatory finding by the Florida Board of Dentistry. Vetera does not interpret, rate, or recommend action — we present the record as filed by the regulator. Identity verification (date of birth, address, license number) is the user\'s responsibility. Providers may submit corrections via <a href="terms.html">our process</a>.</p>' +
        '</div>' +
        '</div>';
    }

    html +=
      '<div class="findings-banner findings-alert">' +
      '<strong>More on record</strong>';

    flBoardHits.forEach(function (c) {
      (c.actions || []).forEach(function (a) {
        // Skip the action we already showed in the severe banner
        if (mostSevere && mostSevere.action === a) return;
        html +=
          '<div class="finding-item">' +
          '<p><strong>Florida Board of Dentistry — ' +
          escapeHtml(a.type || 'Disciplinary action') +
          (a.date ? ' (' + escapeHtml(a.date) + ')' : '') +
          '</strong></p>' +
          renderVerificationNotice(a) +
          '<p><strong>Summary of public record:</strong> ' +
          escapeHtml(a.summary || '') +
          '</p>' +
          (a.penalty ? '<p><strong>Penalty:</strong> ' + escapeHtml(a.penalty) + '</p>' : '') +
          (a.restriction
            ? '<p><strong>Restriction:</strong> ' + escapeHtml(a.restriction) + '</p>'
            : '') +
          renderSources(a) +
          '</div>';
      });
    });

    oigHits.forEach(function (e) {
      html +=
        '<div class="finding-item">' +
        '<p><strong>OIG Federal Exclusion (LEIE)' +
        (e.excl_date ? ' — excluded ' + formatDate(e.excl_date) : '') +
        '</strong></p>' +
        '<p>' +
        escapeHtml(e.first || '') +
        ' ' +
        escapeHtml(e.last || '') +
        (e.city ? ', ' + escapeHtml(e.city) + ', FL' : '') +
        (e.specialty ? ' — ' + escapeHtml(e.specialty) : '') +
        '</p>' +
        '<p><strong>Exclusion type:</strong> ' +
        escapeHtml(e.excl_type || 'Unknown') +
        '. <em>Confirm identity by birthdate/address before relying on this match — similar names occur.</em></p>' +
        '</div>';
    });

    html += '</div>';
    // If only the severe banner had content, the additional-findings block may
    // be empty besides the heading. Trim it.
    if (mostSevere && flBoardHits.length <= 1 && oigHits.length === 0) {
      html = html.replace(
        '<div class="findings-banner findings-alert"><strong>Additional findings on record</strong></div>',
        ''
      );
    }
    return html;
  }

  function formatDate(yyyymmdd) {
    if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd;
    return (
      yyyymmdd.substring(0, 4) +
      '-' +
      yyyymmdd.substring(4, 6) +
      '-' +
      yyyymmdd.substring(6, 8)
    );
  }

  function renderGenericSourcesPanel(raw) {
    const { first, last } = parseName(raw);
    const npiParams = new URLSearchParams({ state: 'FL' });
    if (first) npiParams.set('firstName', first);
    if (last) npiParams.set('lastName', last);
    const npiUrl =
      'https://npiregistry.cms.hhs.gov/search?' + npiParams.toString();
    const flDohUrl =
      'https://mqa-internet.doh.state.fl.us/mqasearchservices/home';
    const leieUrl = 'https://exclusions.oig.hhs.gov/';
    const samUrl =
      'https://sam.gov/search/?index=ex&q=' + encodeURIComponent(raw);

    return (
      '<div class="source-buttons">' +
      '<a href="' + flDohUrl + '" target="_blank" rel="noopener" class="source-btn">FL Board</a>' +
      '<a href="' + npiUrl + '" target="_blank" rel="noopener" class="source-btn">NPI Registry</a>' +
      '<a href="' + leieUrl + '" target="_blank" rel="noopener" class="source-btn">OIG LEIE</a>' +
      '<a href="' + samUrl + '" target="_blank" rel="noopener" class="source-btn">SAM.gov</a>' +
      '</div>'
    );
  }

  // Delegate click handler for "Copy name & open FL Board search" buttons.
  // Buttons are rendered dynamically inside results, so we listen on the
  // results container.
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
      navigator.clipboard
        .writeText(toCopy)
        .then(openPortal)
        .catch(openPortal);
    } else {
      // Fallback: legacy execCommand
      try {
        const ta = document.createElement('textarea');
        ta.value = toCopy;
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (_) {}
      openPortal();
    }
  });

  function flashCopied(btn, copiedText) {
    const original = btn.innerHTML;
    btn.innerHTML =
      '✓ Copied "<em>' + escapeHtml(copiedText) + '</em>" — paste it into the search field. Close that tab when done to return here.';
    btn.classList.add('flboard-btn-copied');
    setTimeout(function () {
      btn.innerHTML = original;
      btn.classList.remove('flboard-btn-copied');
    }, 8000);
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
})();
