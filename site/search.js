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
    return oig.filter(function (e) {
      if (normName(e.last) !== l) return false;
      return namesMatch(firstName, e.first);
    });
  }

  function findFlBoardMatches(flBoard, firstName, lastName) {
    const l = normName(lastName);
    if (!l) return [];
    return (flBoard.cases || []).filter(function (c) {
      // Check primary name
      if (normName(c.last) === l && namesMatch(firstName, c.first)) {
        return true;
      }
      // Check aliases (e.g., a provider who advertises under a different name)
      if (Array.isArray(c.aliases)) {
        for (let i = 0; i < c.aliases.length; i++) {
          const a = c.aliases[i];
          if (normName(a.last) === l && namesMatch(firstName, a.first)) {
            return true;
          }
        }
      }
      return false;
    });
  }

  function findRetiredMatches(retired, firstName, lastName, city) {
    const l = normName(lastName);
    if (!l) return [];
    const providers = (retired && retired.providers) || [];
    return providers.filter(function (p) {
      if (normName(p.last) !== l) return false;
      if (!namesMatch(firstName, p.first)) return false;
      // Optional city match to disambiguate when provided
      if (city && p.city && normName(p.city) !== normName(city.split(',')[0])) {
        // Allow match if city is empty — be lenient
      }
      return true;
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

  async function runSearch(raw, profession) {
    resultsEl.innerHTML =
      '<p class="results-status">Looking up Florida providers...</p>';

    // Kick off local dataset loads in parallel with the NPI search
    const oigPromise = loadOig();
    const flBoardPromise = loadFlBoard();
    const retiredPromise = loadRetired();

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
    renderResults(raw, providers, profession, oig, flBoard, retired);
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
      '<p class="tab-tip">💡 External searches open in a <strong>new tab</strong>. To come back to these findings, just close that tab or click this Vetera tab.</p>' +
      '</div>' +
      '<div class="provider-list">' +
      cards +
      '</div>' +
      '<p class="back-to-findings"><a href="#findings">↑ Back to top of findings</a></p>';
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
    const retiredPill = isRetired
      ? '<span class="retired-pill" title="Provider is retired per our records">RETIRED</span> '
      : '';
    const nameDecoration = (hasSevere
      ? '<span class="severe-pill" title="Board disciplinary finding on record">FL Board Finding</span> '
      : hasFindings
      ? '<span class="flag-pill" title="Disciplinary entry on record">Finding on record</span> '
      : '') + retiredPill;

    return (
      '<div class="' + cardClass + '">' +
      '<h4>' +
      nameDecoration +
      escapeHtml(displayName) +
      '</h4>' +
      '<p class="provider-summary">' +
      escapeHtml(specialty) +
      (cityState ? ' &middot; ' + escapeHtml(cityState) : '') +
      ' &middot; NPI ' +
      escapeHtml(npi) +
      '</p>' +
      retiredBanner +
      findingsBanner +
      // License & Discipline
      '<details class="topic">' +
      '<summary>Is their license valid? Any past problems?<span class="topic-sub">License status &amp; disciplinary history (FL Board)</span></summary>' +
      '<div class="topic-body">' +
      (license
        ? '<p><strong>License #:</strong> ' +
          escapeHtml(license) +
          (licenseState ? ' (' + escapeHtml(licenseState) + ')' : '') +
          '</p>'
        : '<p>No license number returned by the federal registry.</p>') +
      '<p><strong>To check active status &amp; disciplinary history on the FL Board portal:</strong></p>' +
      '<p>One click below — we copy the name to your clipboard and open the state portal. Paste into the Last Name field, then Search.</p>' +
      '<p>' +
      '<button type="button" class="flboard-btn" ' +
      'data-flboard ' +
      'data-last="' + escapeHtml(lastName) + '" ' +
      'data-first="' + escapeHtml(firstName) + '" ' +
      'data-url="' + flDohUrl + '">' +
      'Copy name &amp; open FL Board search (new tab)' +
      '</button>' +
      '</p>' +
      '<div class="result-guide">' +
      '<p><strong>What you\'ll see on the FL Board portal:</strong></p>' +
      '<p class="guide-ok"><span class="guide-icon">✓</span> Click the practitioner\'s name → check that <strong>"License Status"</strong> shows <em>Clear/Active</em>. Then scroll down to <strong>"Discipline"</strong>.</p>' +
      '<p class="guide-ok"><span class="guide-icon">✓</span> <strong>"None"</strong> under Discipline means <em>the state board has not formally acted</em> against this provider. It does <strong>not</strong> mean no incidents occurred — many serious harms, including patient deaths, end in private civil settlements that never reach the board.</p>' +
      '<p class="guide-warn"><span class="guide-icon">⚠</span> If any entries appear under Discipline, click each one — these are state fines, restrictions, or sanctions. Take note of dates and severity.</p>' +
      '</div>' +
      '</div>' +
      '</details>' +
      // Federal Profile (NPI Registry)
      '<details class="topic">' +
      '<summary>Who are they? Where do they practice?<span class="topic-sub">Federal provider profile (NPI Registry)</span></summary>' +
      '<div class="topic-body">' +
      '<p><strong>NPI:</strong> ' + escapeHtml(npi) + '</p>' +
      '<p><strong>Specialty:</strong> ' + escapeHtml(specialty) + '</p>' +
      (addrLine
        ? '<p><strong>Practice address:</strong> ' + escapeHtml(addrLine) + '</p>'
        : '') +
      '<p>Live data from the federal NPPES NPI Registry.</p>' +
      '<p><a href="' +
      npiSearchUrl +
      '" target="_blank" rel="noopener" class="topic-link">View full NPI profile &rarr;</a></p>' +
      '</div>' +
      '</details>' +
      // OIG LEIE Sanctions
      '<details class="topic">' +
      '<summary>Banned from Medicare or Medicaid?<span class="topic-sub">Federal sanctions list (OIG LEIE)</span></summary>' +
      '<div class="topic-body">' +
      '<p>The OIG LEIE lists individuals and entities excluded from federal healthcare programs. A listing here is a serious red flag.</p>' +
      '<p>One click below — we copy the name to your clipboard and open the LEIE search.</p>' +
      '<p>' +
      '<button type="button" class="flboard-btn" ' +
      'data-flboard ' +
      'data-last="' + escapeHtml(lastName) + '" ' +
      'data-first="' + escapeHtml(firstName) + '" ' +
      'data-url="' + leieUrl + '">' +
      'Copy name &amp; open OIG LEIE search (new tab)' +
      '</button>' +
      '</p>' +
      '<div class="result-guide">' +
      '<p><strong>What you\'ll see after pasting &amp; clicking Search:</strong></p>' +
      '<p class="guide-ok"><span class="guide-icon">✓</span> <strong>"No Records Found"</strong> — the provider is <em>not</em> on the federal sanctions list. This is the normal outcome for most providers, but it does <strong>not</strong> mean no incidents have occurred. Federal exclusion is reserved for fraud and severe offenses; most malpractice never reaches this list.</p>' +
      '<p class="guide-warn"><span class="guide-icon">⚠</span> <strong>Any records returned</strong> — serious red flag. Click a row to see the exclusion date, reason, and address. Confirm the address/birthdate matches your provider (similar names happen).</p>' +
      '</div>' +
      '</div>' +
      '</details>' +
      // SAM.gov Exclusions
      '<details class="topic">' +
      '<summary>Banned from federal contracts or programs?<span class="topic-sub">Federal exclusions list (SAM.gov)</span></summary>' +
      '<div class="topic-body">' +
      '<p>SAM.gov lists federal contracting and grant exclusions. An entry here means the federal government has barred this person from contracts or programs.</p>' +
      '<p>One click below — we copy the name to your clipboard and open SAM.gov.</p>' +
      '<p>' +
      '<button type="button" class="flboard-btn" ' +
      'data-flboard ' +
      'data-last="' + escapeHtml(fullName) + '" ' +
      'data-first="" ' +
      'data-url="' + samUrl + '">' +
      'Copy name &amp; open SAM.gov search (new tab)' +
      '</button>' +
      '</p>' +
      '<div class="result-guide">' +
      '<p><strong>What to do on SAM.gov:</strong></p>' +
      '<p class="guide-ok"><span class="guide-icon">1</span> Paste the name into the <strong>"Keyword Search"</strong> field at the top.</p>' +
      '<p class="guide-ok"><span class="guide-icon">2</span> Press Enter or click the magnifying glass.</p>' +
      '<p class="guide-ok"><span class="guide-icon">✓</span> <strong>"No results found"</strong> — provider is not on the federal exclusions list. SAM.gov only covers federal contracting and grant bans; absence here is expected for clinicians and says nothing about clinical safety.</p>' +
      '<p class="guide-warn"><span class="guide-icon">⚠</span> Any results = serious red flag. Click to see the exclusion details.</p>' +
      '</div>' +
      '</div>' +
      '</details>' +
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
      return (
        '<div class="findings-banner findings-unverified">' +
        '<strong>No matches in the two databases we automatically check</strong> ' +
        '(OIG federal exclusions list and our curated FL Board discipline file). ' +
        '<p class="unverified-warning"><strong>This is not a clean bill of health.</strong> A patient can be seriously harmed — or die — under a provider\'s care without any record appearing in the sources above.</p>' +
        '<p class="unverified-label">What we have <em>not</em> checked automatically:</p>' +
        '<ul class="unverified-list">' +
        '<li>Civil court records — malpractice suits and wrongful-death cases. Many settle privately and never reach the state board.</li>' +
        '<li>Pending or unresolved board complaints (only closed actions appear in our file).</li>' +
        '<li>News reports, obituaries, and local media coverage of incidents.</li>' +
        '<li>National Practitioner Data Bank (NPDB) — not publicly accessible.</li>' +
        '<li>Hospital privilege revocations and peer-review actions.</li>' +
        '</ul>' +
        '<p class="unverified-cta">For a deeper search across civil court filings and public news archives, request the <a href="request.html">full background report</a>.</p>' +
        '</div>'
      );
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
        'Florida Board of Dentistry — Disciplinary Finding' +
        (mostSevere.action.date
          ? ' (' + escapeHtml(mostSevere.action.date) + ')'
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
      '<strong>Additional public-record entries</strong>';

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
