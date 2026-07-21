#!/usr/bin/env python3
"""
Auto-draft a Vetera "public records package" for ONE provider, from data we
already have offline — no live scraping needed.

Usage:
  python3 scripts/gen_report.py "Joel Berley"      # search by name
  python3 scripts/gen_report.py --lic 19218        # exact license number

It pulls:
  - License status / # / city / expiration  -> from the FL DOH license file (dentists.json)
  - Federal OIG exclusion check             -> from oig-fl-exclusions.json
  - Any curated disciplinary lead           -> from fl-board-discipline.json (FOR YOUR REVIEW ONLY)
and leaves clear slots + official links for the parts that must be done by hand
(the FL DOH order PDF, SAM.gov, NPI). Writes report-drafts/<slug>.html —
open it, review, add the manual bits, then Print -> Save as PDF and email.

Facts only. The customer-facing report LINKS to the official records; it never
pastes an unverified summary. The yellow boxes (for you) don't print.
"""
import json, os, re, sys, html, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DENTISTS = os.path.join(ROOT, "site", "data", "dentists.json")
OIG      = os.path.join(ROOT, "site", "data", "oig-fl-exclusions.json")
DISC     = os.path.join(ROOT, "site", "data", "fl-board-discipline.json")
OUTDIR   = os.path.join(ROOT, "report-drafts")

DOH_LICENSE = "https://mqa-internet.doh.state.fl.us/mqasearchservices/home"
DOH_ENFORCE = "https://mqa-internet.doh.state.fl.us/MQASearchServices/EnforcementActionsPractitioner"
OIG_URL     = "https://exclusions.oig.hhs.gov/"
SAM_URL     = "https://sam.gov/search/"
NPI_URL     = "https://npiregistry.cms.gov/search"


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def find_list(o):
    """Return the first list-of-dicts found in a JSON blob."""
    if isinstance(o, list):
        return o
    if isinstance(o, dict):
        for v in o.values():
            r = find_list(v)
            if r:
                return r
    return []


def title_case(s):
    return re.sub(r"\b[a-z]", lambda m: m.group().upper(), (s or "").lower())


def slugify(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"-+", "-", re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower())


def e(s):
    return html.escape(str(s if s is not None else ""), quote=True)


def digits(s):
    return "".join(c for c in str(s) if c.isdigit())


# ---- match the provider in the FL DOH license file -------------------------
def match_dentists(dents, query, lic=None):
    if lic:
        want = digits(lic).lstrip("0")
        return [d for d in dents if digits(d.get("lic")).lstrip("0") == want]
    toks = [t for t in re.split(r"[^a-z0-9]+", query.lower()) if t]
    if not toks:
        return []
    def rec_toks(d):
        return set(re.split(r"[^a-z0-9]+",
                   (f"{d.get('f','')} {d.get('n','')} {d.get('l','')}").lower())) - {""}
    def last_toks(d):
        return set(re.split(r"[^a-z0-9]+", (d.get("l") or "").lower())) - {""}
    out = []
    for d in dents:
        rt = rec_toks(d)
        if all(t in rt for t in toks) and any(t in last_toks(d) for t in toks):
            out.append(d)
    return out


# ---- federal OIG exclusion check (present matches; caller verifies) --------
def oig_matches(oig, first, last):
    fl, ll = (first or "").lower(), (last or "").lower()
    hits = []
    for r in oig:
        rl = (r.get("last") or "").lower()
        rf = (r.get("first") or "").lower()
        if rl == ll and (rf == fl or (fl and rf and rf[0] == fl[0])):
            hits.append(r)
    return hits


# ---- curated disciplinary lead (FOR REVIEW ONLY, not customer-facing) ------
def disc_leads(disc_records, first, last, lic):
    fl, ll = (first or "").lower(), (last or "").lower()
    want = digits(lic).lstrip("0")
    hits = []
    for r in disc_records:
        rl = (r.get("last") or "").lower()
        rf = (r.get("first") or "").lower()
        rlic = digits(r.get("license")).lstrip("0")
        if (rl == ll and (not fl or not rf or rf[0] == fl[0])) or (want and rlic == want):
            hits.append(r)
    return hits


STYLE = """
* { box-sizing: border-box; }
body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
       color: #1a1a1a; background: #f4f5f7; margin: 0; padding: 24px; line-height: 1.55; }
.doc { max-width: 720px; margin: 0 auto 40px; background: #fff; padding: 44px 48px;
       box-shadow: 0 1px 8px rgba(0,0,0,.09); }
h1 { font-size: 24px; margin: 0 0 2px; } .meta { color: #666; font-size: 13.5px; margin: 0 0 22px; }
.provider { background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 18px; margin: 0 0 22px; }
.provider b { display: inline-block; min-width: 130px; color: #555; font-weight: 600; }
.intro { font-size: 14px; color: #333; border-left: 3px solid #2563eb; padding: 4px 0 4px 14px; margin: 0 0 26px; }
.rec { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 18px; margin: 0 0 14px; }
.rec h2 { font-size: 16px; margin: 0 0 6px; } .rec .found { font-weight: 600; margin: 0 0 8px; }
.rec .src { font-size: 13.5px; color: #444; margin: 0; } .rec .src a { color: #2563eb; word-break: break-word; }
.steps { font-size: 13px; color: #555; margin: 6px 0 0; padding-left: 18px; }
.ok { color: #15803d; } .flag { color: #b45309; } .bad { color: #b91c1c; }
.foot { font-size: 12.5px; color: #666; border-top: 1px solid #eee; padding-top: 16px; margin-top: 26px; }
.fill { background: #fff3cd; color: #7a5b00; padding: 0 3px; border-radius: 3px; font-weight: 600; }
.review { border: 2px dashed #d97706; background: #fffbeb; border-radius: 10px; padding: 12px 16px;
          margin: 8px 0 0; font-size: 13px; }
.review b { color: #92400e; }
@media print { .review { display: none !important; } .fill { background: none; color: inherit; }
               body { background: #fff; padding: 0; } .doc { box-shadow: none; margin: 0; } }
"""


def render(d, oig_hits, leads):
    name = title_case(" ".join(p for p in [d.get("f"), d.get("n"), d.get("l")] if p).strip())
    lic = d.get("lic") or ""
    city = title_case(d.get("c") or "")
    status = d.get("s") or "Status unknown"
    active = "active" if d.get("a") == 1 else "not active"
    exp = d.get("e") or ""
    dd = d.get("d") or 0

    # disciplinary finding (facts only; link to the official order for details)
    if dd == 2:
        disc_found = ('<p class="found flag">A state disciplinary action is on record for this license '
                      '(per the FL DOH license file). Read the official order at the source below.</p>')
    elif dd == 1:
        disc_found = ('<p class="found flag">A complaint is on file (a complaint is not proof of wrongdoing). '
                      'See the official record below.</p>')
    else:
        disc_found = ('<p class="found ok">No state disciplinary action is recorded in the FL DOH license file. '
                      '(Double-check via the enforcement database below.)</p>')

    # OIG finding
    if oig_hits:
        rows = "; ".join(f"{title_case(h.get('first',''))} {title_case(h.get('last',''))}"
                         f" ({h.get('city','')}, excl {h.get('excl_date','')})" for h in oig_hits)
        oig_found = (f'<p class="found flag">Possible OIG match(es) found — VERIFY it is the same person '
                     f'before including: {e(rows)}</p>')
    else:
        oig_found = '<p class="found ok">Not found on the OIG Florida exclusion list.</p>'

    # curated discipline lead — YOUR-EYES-ONLY review box (never prints)
    review_box = ""
    if leads:
        parts = []
        for L in leads:
            for a in (L.get("actions") or []):
                parts.append(
                    f"<b>{e(a.get('date','?'))} — {e(a.get('type','action'))}</b> "
                    f"(source status: {e((a.get('verification') or {}).get('status','?'))})<br>"
                    f"Penalty note: {e(a.get('penalty','—'))}<br>"
                    f"Lead source: {e(', '.join(s.get('url','') for s in (a.get('sources') or [])))}")
        review_box = (
            '<div class="review"><b>⚠ FOR YOUR REVIEW ONLY (won\'t print, not for the customer):</b> '
            'a curated/press lead exists for this provider. Do NOT paste it into the report. '
            'Open the official FL DOH order (link above), confirm it, then just LINK the order.<br><br>'
            + "<br><br>".join(parts) + '</div>')

    return f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Vetera — Public Records Package · {e(name)}</title><style>{STYLE}</style></head><body>
<div class="review"><b>📋 Auto-draft (this box won't print).</b> Filled from your local data.
To finish: open the FL DOH order (if flagged) &amp; NPI links, fill the <span class="fill">yellow</span> slots,
then File → Print → Save as PDF and email it. Facts only — link the official records, don't summarize them.</div>
<article class="doc">
  <h1>Public Records Package</h1>
  <p class="meta">Prepared by Vetera · Report ID <span class="fill">VTR-0000</span> · <span class="fill">[date]</span></p>
  <div class="provider">
    <div><b>Provider</b> {e(name)}</div>
    <div><b>Profession</b> <span class="fill">Dentist [confirm oral surgeon via NPI if relevant]</span></div>
    <div><b>FL License #</b> {e(lic)}</div>
    <div><b>Location on file</b> {e(city + ', FL') if city else '<span class="fill">[see NPI]</span>'}</div>
  </div>
  <p class="intro">This package gathers the available public records for the provider above from official
    U.S. federal and Florida state government sources. Vetera collects and organizes these records only —
    it adds no opinions, ratings, or interpretations. Open each official record using the link or steps
    provided and read the primary source yourself.</p>

  <div class="rec"><h2>1. Florida license record</h2>
    <p class="found">On file — status: <b>{e(status)}</b> ({active}{('; expires ' + e(exp)) if exp else ''}).</p>
    <p class="src">Official source: <a href="{DOH_LICENSE}">FL DOH License Verification</a></p>
    <ol class="steps"><li>Open the link → search Last "{e(d.get('l',''))}", First "{e(d.get('f',''))}".</li>
      <li>Open the record for license #{e(lic)} to see the live official status.</li></ol></div>

  <div class="rec"><h2>2. Florida disciplinary &amp; enforcement actions</h2>
    {disc_found}
    <p class="src">Official source: <a href="{DOH_ENFORCE}">FL DOH Enforcement Actions</a></p>
    <ol class="steps"><li>Open the link → Profession "Dentistry", Last "{e(d.get('l',''))}", First "{e(d.get('f',''))}".</li>
      <li>Click the case number to open the official Final Order / Settlement PDF — the full facts are in that document.</li>
      <li><i>(If downloadable, attach that PDF to this package.)</i></li></ol>
    {review_box}</div>

  <div class="rec"><h2>3. Federal exclusions — OIG (LEIE)</h2>
    {oig_found}
    <p class="src">Official source: <a href="{OIG_URL}">exclusions.oig.hhs.gov</a> — confirm by searching the name.</p></div>

  <div class="rec"><h2>4. Federal debarment — SAM.gov</h2>
    <p class="found"><span class="fill">Search to confirm (typically: not listed)</span></p>
    <p class="src">Official source: <a href="{SAM_URL}">sam.gov/search</a> — search the provider's name.</p></div>

  <div class="rec"><h2>5. Provider profile &amp; NPI — NPPES</h2>
    <p class="found">NPI: <span class="fill">[look up &amp; paste]</span></p>
    <p class="src">Official source: <a href="{NPI_URL}">npiregistry.cms.gov</a> — search "{e(name)}", State FL.</p></div>

  <p class="foot">Compiled from public U.S. federal and Florida state government records. Vetera gathers and
    links to official records only — no opinions, ratings, recommendations, or clinical/legal interpretation.
    Public records can change after delivery. Not medical or legal advice. © 2026 Vetera · Independent and
    not affiliated with any government agency.</p>
</article></body></html>"""


def main():
    args = sys.argv[1:]
    lic = None
    if "--lic" in args:
        i = args.index("--lic"); lic = args[i + 1]; del args[i:i + 2]
    query = " ".join(args).strip()
    if not query and not lic:
        print('Usage: python3 scripts/gen_report.py "First Last"   OR   --lic 19218'); return

    dents = load(DENTISTS)
    matches = match_dentists(dents, query, lic)
    if not matches:
        print(f"No FL dentist found for '{lic or query}'. Check spelling, or try the license #."); return
    if len(matches) > 1:
        print(f"{len(matches)} matches — re-run with the exact license number (--lic <num>):")
        for m in matches[:25]:
            print(f"  --lic {m.get('lic'):<8} {title_case((m.get('f','')+' '+m.get('l','')))}"
                  f"  · {m.get('s')}  · {m.get('c','')}")
        return

    d = matches[0]
    oig = find_list(load(OIG)) if os.path.exists(OIG) else []
    disc = find_list(load(DISC)) if os.path.exists(DISC) else []
    oig_hits = oig_matches(oig, d.get("f"), d.get("l"))
    leads = disc_leads(disc, d.get("f"), d.get("l"), d.get("lic"))

    os.makedirs(OUTDIR, exist_ok=True)
    slug = slugify(f"{d.get('f','')}-{d.get('l','')}-{d.get('lic','')}")
    out = os.path.join(OUTDIR, slug + ".html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(render(d, oig_hits, leads))
    print(f"✓ Draft written: {out}")
    print(f"  Provider : {title_case((d.get('f','')+' '+d.get('l','')))}  (lic {d.get('lic')}, {d.get('c','')})")
    print(f"  License  : {d.get('s')}")
    print(f"  Discipline flag: {d.get('d',0)}   OIG possible-match: {len(oig_hits)}   Curated lead: {len(leads)}")
    print(f"  Open it:  open {out}")


if __name__ == "__main__":
    main()
