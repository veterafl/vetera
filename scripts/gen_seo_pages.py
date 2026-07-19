#!/usr/bin/env python3
"""
Generate one Google-findable static page per Florida dentist, plus an A-Z
directory, a sitemap, and robots.txt.

Why this exists
---------------
Vetera's home page is a single search box that no one Googles. But patients DO
google their dentist by name ("Dr. Jane Smith Tampa dentist"). This script turns
site/data/dentists.json into ~30k standalone HTML pages -- one per dentist -- so
that those name searches land on Vetera. Facts only, sourced to the FL DOH, same
plain-language status wording the live search uses (ported from search.js).

Run:  python3 scripts/gen_seo_pages.py
Output (all under site/, served as-is by Vercel):
  site/d/<slug>.html           one page per dentist
  site/dentists/index.html     A-Z hub
  site/dentists/<letter>.html  list of dentists by last-name initial
  site/sitemap.xml             every URL, for Google
  site/robots.txt              allow crawl + point to sitemap

No backend, no build step required at deploy time -- these are plain files.
"""

import json
import os
import re
import shutil
import html
import unicodedata

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
# Canonical public origin. Change this ONE line if/when a custom domain is added
# (e.g. "https://vetera.com"), then re-run to refresh canonical tags + sitemap.
BASE = "https://vetera-six.vercel.app"

FL_DOH_URL = "https://mqa-internet.doh.state.fl.us/mqasearchservices/home"

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "site")
DATA = os.path.join(SITE, "data", "dentists.json")
D_DIR = os.path.join(SITE, "d")
DIR_DIR = os.path.join(SITE, "dentists")

# Static public pages to also list in the sitemap (clean URLs).
STATIC_PATHS = ["/", "/methodology", "/faq", "/sample-report", "/privacy", "/terms"]

# ---------------------------------------------------------------------------
# Status wording  (ported verbatim from site/search.js so pages match search)
# ---------------------------------------------------------------------------
STATUS_SHORT = {
    'licensed and in good standing': 'License active',
    'license no longer valid': 'License no longer valid',
    'deceased': 'Deceased',
    'retired': 'Retired',
    'license lapsed (delinquent)': 'License lapsed',
    'voluntarily gave up license': 'License surrendered',
    'licensed (military active status)': 'Licensed, active military',
    'gave up license during a state action': 'License surrendered during action',
    'license revoked by the state': 'License revoked',
    'licensed, has outstanding obligations': 'Licensed, has open obligations',
    'application expired': 'Application expired',
    'licensed, but on probation': 'Licensed, but on probation',
    'license suspended by the state': 'License suspended',
    'licensed with conditions': 'With conditions',
    'renewal denied': 'Renewal denied',
}

SEVERE_MARKERS = ('revoked', 'suspended', 'probation', 'renewal denied',
                  'gave up license during a state action')


def status_info(rec):
    """Return (tier, plain_text). Mirrors statusInfo() in search.js."""
    s = (rec.get('s') or '').lower()
    if any(m in s for m in SEVERE_MARKERS):
        tier = 'severe'
    elif 'outstanding obligations' in s:
        tier = 'caution'
    elif rec.get('a') == 1:
        tier = 'good'
    else:
        tier = 'neutral'
    text = STATUS_SHORT.get(s) or (rec.get('s') or 'Status unknown')

    d = rec.get('d') or 0
    if tier == 'good' and d:
        tier = 'caution'
        text = ('Licensed — past disciplinary action on record'
                if d == 2 else 'Licensed — a complaint is on file')
    return tier, text


TIER_CLASS = {'severe': 'sev', 'caution': 'cau', 'good': 'good', 'neutral': 'neu'}


def dot_color(tier, active):
    if tier == 'severe':
        return 'red'
    if tier == 'caution':
        return 'yellow'
    return 'green' if active == 1 else 'gray'


# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------
def title_case(s):
    return re.sub(r'\b[a-z]', lambda m: m.group().upper(), (s or '').lower())


def slugify(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode()
    s = re.sub(r'[^A-Za-z0-9]+', '-', s).strip('-').lower()
    return re.sub(r'-+', '-', s)


def full_name(rec):
    parts = [rec.get('f'), rec.get('n'), rec.get('l')]
    return title_case(' '.join(p for p in parts if p).strip())


def short_name(rec):
    parts = [rec.get('f'), rec.get('l')]
    return title_case(' '.join(p for p in parts if p).strip())


def e(s):
    return html.escape(str(s if s is not None else ''), quote=True)


# ---------------------------------------------------------------------------
# Page template
# ---------------------------------------------------------------------------
FOOTER = (
    '<footer class="home-footer">'
    '<div>'
    '<a href="/">Search</a> <a href="/dentists">All dentists</a> '
    '<a href="/methodology">Methodology</a> <a href="/faq">FAQ</a> '
    '<a href="/terms">Terms</a> <a href="/privacy">Privacy</a> '
    '<a href="mailto:veterareports@gmail.com">Provider Corrections</a>'
    '</div>'
    '<p class="footer-disclaimer">'
    '&copy; 2026 Vetera &middot; Information sourced from U.S. federal and Florida '
    'public records &middot; Vetera is independent and not affiliated with any '
    'government agency &middot; Not medical or legal advice</p>'
    '</footer>'
)


def head(title, desc, canonical, extra=""):
    return (
        '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
        f'<title>{e(title)}</title>'
        f'<meta name="description" content="{e(desc)}">'
        f'<link rel="canonical" href="{e(canonical)}">'
        '<meta name="robots" content="index,follow">'
        f'<meta property="og:title" content="{e(title)}">'
        f'<meta property="og:description" content="{e(desc)}">'
        f'<meta property="og:url" content="{e(canonical)}">'
        '<meta property="og:type" content="profile">'
        '<meta name="twitter:card" content="summary">'
        '<link rel="icon" type="image/svg+xml" href="/favicon.svg">'
        '<link rel="stylesheet" href="/styles.css">'
        '<link rel="stylesheet" href="/report.css">'
        f'{extra}</head><body class="home">'
    )


def safe_jsonld(obj):
    """json.dumps then escape <, >, & so a name can never break out of the
    <script type="application/ld+json"> block (hardening for the future
    auto-ingesting FL DOH pipeline; no current record contains these chars)."""
    return (json.dumps(obj, ensure_ascii=False)
            .replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026'))


def framing(rec, text):
    """Status-aware wording. A page must NOT assert present-tense 'a Florida-
    licensed dentist' for someone deceased, revoked, retired, or never licensed.
    Three cases keyed on rec['a'] (active) and whether it's an application record:
      active    -> currently licensed: full 'Dr. ... dentist' framing
      applicant -> never licensed (application expired): 'license application
                   record', no 'Dr.'/'dentist'/jobTitle/address
      former    -> held a license, now inactive: neutral 'license record' framing,
                   no present-tense practice claim
    """
    s = (rec.get('s') or '').lower()
    active = rec.get('a') == 1
    applicant = 'application' in s
    name = full_name(rec)
    sname = short_name(rec)
    lic = rec.get('lic') or ''
    city = (rec.get('c') or '').strip()
    ctitle = title_case(city)
    where = f"in {ctitle}, FL" if city else "in Florida"

    if applicant:
        kind = 'applicant'
        title = f"{sname} — Florida Dental License Application Record | Vetera"
        h1 = name
        desc = (f"Florida dental license application record for {name}. "
                f"Status: {text}. This record does not show an active Florida "
                f"dental license. See the official state record. Facts only — no ratings.")
        cityline = ("Florida dental license application on file"
                    + (f" — {ctitle}, FL" if city else ""))
    elif active:
        kind = 'active'
        title = f"Dr. {sname}, Dentist {where} — License & Record | Vetera"
        h1 = f"Dr. {name}"
        desc = (f"Public record for {name}, a Florida-licensed dentist {where}. "
                f"State license #{lic}. Status: {text}. See the official Florida "
                f"record. Facts only — no ratings.")
        cityline = (f"Dentist in {ctitle}, Florida" if city
                    else "Florida-licensed dentist")
    else:
        kind = 'former'
        title = f"{sname} — Florida Dental License Record ({text}) | Vetera"
        h1 = name
        desc = (f"Florida dental license record for {name}. Current status: {text}. "
                f"State license #{lic}"
                + (f", practice city on file {ctitle}, FL" if city else "")
                + ". See the official Florida record. Facts only — no ratings.")
        cityline = ("Florida dental license record on file"
                    + (f" — practice city {ctitle}, FL" if city else ""))

    return dict(kind=kind, title=title, h1=h1, desc=desc, cityline=cityline,
                name=name, lic=lic, city=city, ctitle=ctitle)


def discipline_note(rec):
    s = (rec.get('s') or '').lower()
    d = rec.get('d') or 0
    if 'gave up license during a state action' in s:
        return ('<p class="rp-sub">This license was given up while a state action '
                'was open. Giving up a license is not itself a finding of wrongdoing '
                '— open the official record for the details.</p>')
    if d == 2:
        return ('<p class="rp-sub">The state has taken a disciplinary action on '
                'this license at some point. Open the official record for the details.</p>')
    if d == 1:
        return ('<p class="rp-sub">A complaint is on file. A complaint is not proof '
                'of wrongdoing — open the official record for the details.</p>')
    return ''


def dentist_page(rec, slug):
    lic = rec.get('lic') or ''
    exp = rec.get('e') or ''
    tier, text = status_info(rec)
    tclass = TIER_CLASS[tier]
    color = dot_color(tier, rec.get('a'))
    canonical = f"{BASE}/d/{slug}"
    fr = framing(rec, text)
    name, city, ctitle = fr['name'], fr['city'], fr['ctitle']

    # JSON-LD: only an ACTIVE licensee is described as a practicing Dentist with a
    # current address. Non-active / applicant records get name + identifier only.
    person = {"@type": "Person", "name": name}
    if fr['kind'] == 'active':
        person["jobTitle"] = "Dentist"
        if city:
            person["address"] = {"@type": "PostalAddress", "addressLocality": ctitle,
                                 "addressRegion": "FL", "addressCountry": "US"}
    id_label = ("Florida dental license application number"
                if fr['kind'] == 'applicant' else "Florida dental license number")
    person["identifier"] = {"@type": "PropertyValue", "propertyID": id_label,
                            "value": str(lic)}
    jsonld = {"@context": "https://schema.org", "@type": "ProfilePage",
              "url": canonical, "mainEntity": person}
    ld = ('<script type="application/ld+json">' + safe_jsonld(jsonld) + '</script>')

    lic_label = "Florida application #" if fr['kind'] == 'applicant' else "Florida license #"
    status_label = "Record status" if fr['kind'] == 'applicant' else "State record status"
    city_label = "City on file" if fr['kind'] == 'applicant' else "Practice city on file"
    facts = ['<ul class="rp-facts">']
    facts.append(f'<li><b>{lic_label}</b>{e(lic)}</li>')
    facts.append(f'<li><b>{status_label}</b>{e(text)}</li>')
    if city:
        facts.append(f'<li><b>{city_label}</b>{e(ctitle)}, FL</li>')
    if exp and fr['kind'] != 'applicant':
        facts.append(f'<li><b>License expiration</b>{e(exp)}</li>')
    facts.append('</ul>')

    sub = discipline_note(rec)
    copy_hint = e(f"{rec.get('l','')}, {rec.get('f','')}".strip(', '))

    body = (
        head(fr['title'], fr['desc'], canonical, ld)
        + '<main class="rp-wrap">'
        + '<div class="rp-top"><a class="rp-home" href="/">Vetera</a>'
          '<a class="rp-back" href="/dentists">← All Florida dentists</a></div>'
        + f'<h1 class="rp-h1">{e(fr["h1"])}</h1>'
        + f'<p class="rp-city">{e(fr["cityline"])}</p>'
        + f'<div class="rp-status {tclass}">'
          f'<p class="rp-line"><span class="rp-dot {color}"></span>{e(text)}</p>{sub}</div>'
        + ''.join(facts)
        + f'<a class="rp-verify" href="{FL_DOH_URL}" target="_blank" '
          'rel="noopener noreferrer">See the official Florida state record ↗</a>'
        + f'<p class="rp-verify-note">On the state site, search the name: '
          f'<strong>{copy_hint}</strong>. Vetera is independent and shows public '
          'records only — always confirm on the official record that it is the '
          'right person.</p>'
        + '<p class="rp-note">More than one person can share the same name. This '
          'page reflects Florida Department of Health public license data and shows '
          'facts only — no opinions, ratings, or recommendations. Think this is '
          'wrong or out of date? <a href="mailto:veterareports@gmail.com">Tell us</a>.'
          '</p>'
        + '</main>' + FOOTER
        + '<script defer src="/analytics.js"></script></body></html>'
    )
    return body


# ---------------------------------------------------------------------------
# Directory (A-Z)
# ---------------------------------------------------------------------------
def letter_of(rec):
    l = (rec.get('l') or '').strip().upper()
    for ch in l:
        if 'A' <= ch <= 'Z':
            return ch
    return '#'


def directory_index(letters):
    title = "All Florida Dentists A–Z — License & Record Lookup | Vetera"
    desc = ("Browse every Florida-licensed dentist by last name. Free public-record "
            "lookup: license status and state disciplinary history. Facts only.")
    links = ''.join(f'<a href="/dentists/{("num" if L=="#" else L.lower())}">'
                    f'{("0-9" if L=="#" else L)}</a>' for L in letters)
    return (
        head(title, desc, f"{BASE}/dentists")
        + '<main class="rp-wrap">'
        + '<div class="rp-top"><a class="rp-home" href="/">Vetera</a>'
          '<a class="rp-back" href="/">← Search by name</a></div>'
        + '<h1 class="rp-h1">All Florida dentists, A to Z</h1>'
        + '<p class="rp-city">Pick a last-name letter to browse every '
          'Florida-licensed dentist. Each page shows license status and any state '
          'disciplinary action — public records only.</p>'
        + f'<div class="rp-letters">{links}</div>'
        + '<p class="rp-note">Looking for one person? '
          '<a href="/">Search by name instead</a>. Facts only — no opinions or ratings.</p>'
        + '</main>' + FOOTER
        + '<script defer src="/analytics.js"></script></body></html>'
    )


def letter_page(letter, recs):
    disp = "0–9" if letter == '#' else letter
    fname = 'num' if letter == '#' else letter.lower()
    title = f"Florida Dentists — Last Name {disp} | License & Record | Vetera"
    desc = (f"Florida-licensed dentists with last names starting with {disp}. "
            "Free public-record lookup: license status and disciplinary history.")
    items = []
    for rec, slug in recs:
        name = full_name(rec)
        city = (rec.get('c') or '').strip()
        loc = f' <span class="c">— {e(title_case(city))}, FL</span>' if city else ''
        items.append(f'<li><a href="/d/{slug}">{e(name)}</a>{loc}</li>')
    return (
        head(title, desc, f"{BASE}/dentists/{fname}")
        + '<main class="rp-wrap">'
        + '<div class="rp-top"><a class="rp-home" href="/">Vetera</a>'
          '<a class="rp-back" href="/dentists">← All letters</a></div>'
        + f'<h1 class="rp-h1">Florida dentists — last name {disp}</h1>'
        + f'<p class="rp-city">{len(recs)} dentists. Each links to a public-record '
          'page with license status and any state disciplinary action.</p>'
        + '<ul class="rp-list">' + ''.join(items) + '</ul>'
        + '<p class="rp-note">Facts only — Florida Department of Health public '
          'records. <a href="/">Search by name</a>.</p>'
        + '</main>' + FOOTER
        + '<script defer src="/analytics.js"></script></body></html>'
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    with open(DATA, encoding='utf-8') as f:
        records = json.load(f)

    # Fresh output dirs
    for d in (D_DIR, DIR_DIR):
        if os.path.isdir(d):
            shutil.rmtree(d)
        os.makedirs(d, exist_ok=True)

    seen = set()
    slugs = []          # (rec, slug)
    for i, rec in enumerate(records):
        base = slugify(f"{rec.get('f','')}-{rec.get('l','')}-{rec.get('lic','')}")
        slug = base or f"dentist-{i}"
        if slug in seen:                       # impossible given unique lic, but safe
            slug = f"{slug}-{i}"
        seen.add(slug)
        slugs.append((rec, slug))

    # Per-dentist pages
    for rec, slug in slugs:
        with open(os.path.join(D_DIR, slug + '.html'), 'w', encoding='utf-8') as f:
            f.write(dentist_page(rec, slug))

    # Directory buckets by last-name initial
    buckets = {}
    for rec, slug in slugs:
        buckets.setdefault(letter_of(rec), []).append((rec, slug))
    for L in buckets:
        buckets[L].sort(key=lambda rs: (rs[0].get('l') or '', rs[0].get('f') or ''))

    letters = [c for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ" if c in buckets]
    if '#' in buckets:
        letters.append('#')

    with open(os.path.join(DIR_DIR, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(directory_index(letters))
    for L in letters:
        fname = 'num' if L == '#' else L.lower()
        with open(os.path.join(DIR_DIR, fname + '.html'), 'w', encoding='utf-8') as f:
            f.write(letter_page(L, buckets[L]))

    # Sitemap
    urls = list(STATIC_PATHS)
    urls.append('/dentists')
    urls += [f"/dentists/{'num' if L=='#' else L.lower()}" for L in letters]
    urls += [f"/d/{slug}" for _, slug in slugs]
    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u in urls:
        sm.append(f'<url><loc>{BASE}{u}</loc></url>')
    sm.append('</urlset>')
    with open(os.path.join(SITE, 'sitemap.xml'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(sm))

    # robots.txt
    with open(os.path.join(SITE, 'robots.txt'), 'w', encoding='utf-8') as f:
        f.write("User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n" % BASE)

    print(f"dentist pages : {len(slugs)}")
    print(f"letter pages  : {len(letters)} ({''.join(letters)})")
    print(f"sitemap URLs  : {len(urls)}")
    print("done.")


if __name__ == '__main__':
    main()
