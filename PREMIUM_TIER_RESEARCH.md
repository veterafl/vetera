# Premium-Tier Data Recipe: Florida Dentist Malpractice & Sedation-Permit Records

*Internal build doc for the paid Vetera report. Everything below was verified against live official sites in July 2026. Facts-only: we gather and cite public records; we never interpret them.*

---

## Headline honesty (read this first)

Two things a customer would *assume* are easy turn out **not** to be, and the paid report has to be honest about it:

1. **Florida's "Practitioner Profile" does NOT cover dentists.** The profile that lists closed malpractice claims/settlements is required only for **medical doctors, osteopathic physicians, chiropractors, podiatrists, and advanced practice nurses** (per FL Statutes 456.039/456.0391). Dentists are licensed under Chapter 466 and are **not** in that system. **So there is no one-click state page listing a dentist's malpractice payouts.** Dentist malpractice has to be reconstructed from **county civil court** records, which is manual and county-by-county.
2. **There is no free public "sedation permit lookup" field.** The DOH license page does **not** show a standalone "has general-anesthesia permit: yes/no" flag. Permit info surfaces two ways: (a) indirectly, when a permit was **revoked/disciplined** (shows in enforcement records), or (b) directly, only via a **public-records request** to the Board of Dentistry.

Both are still deliverable — they're just labor, which is exactly why they belong in the *paid* tier, not the free one.

---

## PART A — Malpractice / Civil Court Records

### A0. What "malpractice record" realistically means for a FL dentist

A patient who was harmed sues the dentist in **civil court** in the county where the incident happened. So the record lives in that **county's Clerk of Court** civil case index — not in any dental-board file. There is **no free, public, statewide** civil-case search open to the general public (see A5). This is inherently **county-by-county** work.

**Reality check on volume:** dentist malpractice suits are relatively rare (state figures have run on the order of ~20 civil-court claims filed against FL dentists in a year statewide), so most reports will come back **"no civil suits found in the searched counties"** — which is itself a legitimate, sourced finding worth stating plainly.

---

### A1. Step 1 — Figure out which county(ies) to search

You search the county where the **dental practice is located** (and any prior FL practice cities). Vetera already stores each dentist's practice city, so map city → county:

| Practice city | County | Clerk portal |
|---|---|---|
| Miami, Hialeah, Coral Gables | Miami-Dade | Miami-Dade Clerk |
| Fort Lauderdale, Hollywood, Pompano | Broward | Broward Clerk |
| Orlando, Winter Park, Apopka | Orange | Orange (MyeCLERK) |
| Tampa, Brandon, Plant City | Hillsborough | Hillsborough (HOVER) |
| West Palm Beach, Boca Raton, Delray | Palm Beach | Palm Beach (eCaseView) |
| Jacksonville | Duval | Duval Clerk (CORE) |
| Sarasota, Naples, etc. | Sarasota / Collier | that county's clerk |

These five (Miami-Dade, Broward, Orange, Hillsborough, Palm Beach) cover the biggest share of FL dentists and are the ones to build the recipe around first.

---

### A2. Step 2 — Run the civil-case name search (the five big counties)

For each, search the dentist's **last name, first name** in the **Civil / Circuit Civil** case index, then also check **County Civil** (smaller-dollar claims). Malpractice is usually **Circuit Civil** (damages over $50,000).

**Miami-Dade**
- URL: `https://www.miamidadeclerk.gov/clerk/civil-court.page` (search entry) / records hub: `https://www.miamidadeclerk.gov/clerk/records.page`
- Steps: Civil/Family/Probate case search → search by party name → filter to Circuit Civil.
- **Free** for Civil/Family/Probate case *records*. (Note: *Official Records* — a separate deeds/liens database — charges $1.00 per search "unit"; you do **not** need that for malpractice case lookups.)
- Time: ~3–5 min per name.

**Broward**
- URL: `https://www.browardclerk.org/Web2`
- Steps: Case Search → "Party Name" tab → enter last/first → review Circuit Civil results → open the docket. Free public access to non-confidential case dockets.
- Gotcha: if searching by **case number** the format is strict (prefix + 2-digit year + 6–7 digit sequence, no dashes/spaces) — but for our use, **search by party name**, which avoids that.
- Time: ~3–5 min.

**Orange (Orlando)**
- URL: `https://myeclerk.myorangeclerk.com/`
- Steps: MyeCLERK → Court Records / Case Search → search by name → Circuit Civil. Free, no subscription. Online **documents** available ~2009–present; older cases show in the index but images may need a records request.
- Time: ~3–5 min.

**Hillsborough (Tampa) — "HOVER"**
- URL: `https://hover.hillsclerk.com/`
- Steps: HOVER (Hillsborough On-line Viewing of Electronic Records) → search case index by party name → view dockets/images. Free, no-subscription, no login for public non-confidential records.
- Time: ~3–5 min.

**Palm Beach — "eCaseView"**
- URL: `https://appsgp.mypalmbeachclerk.com/ecaseview/`
- Steps: eCaseView → search civil cases by name → view/print case documents. Free.
- Time: ~3–5 min.

**What you get from each:** case number, party names, filing date, case type (e.g., "Professional Malpractice / Negligence"), the **docket**, and often **filed documents** (complaint, judgment, dismissal, settlement notices). 

**Report only the facts you can cite:** case number, county, filing date, case-type label, and disposition (dismissed / judgment / settled / pending). **Never** infer guilt or summarize the allegations as if true — a filed suit is not proof of wrongdoing, and many are dismissed.

---

### A3. Gotchas that will bite you

- **Name collisions.** Common surnames return many people. Confirm identity with a second data point — middle initial, or cross-check the case's address against the DOH address of record. If you can't confirm it's the same person, **don't include it.**
- **A lawsuit ≠ malpractice payout.** Anyone can file. Disposition is what matters (dismissed, defense verdict, settlement, judgment). State the disposition verbatim.
- **Confidential/sealed cases** won't appear — that's by law, not an error.
- **Wrong county.** Suits are filed where the harm occurred, which may be a prior practice city, not the current one. Check every FL city the dentist has practiced in.
- **Coverage gaps.** Online document images often start ~2009. Older cases may show only in the index; full docs need a manual clerk request (slow — see A5).
- **Business-entity suits.** Some claims name the **practice LLC/PA**, not the dentist personally. Worth a second search on the practice's business name if known.

**Speed summary:** the five big-county name searches are **quick** (~15–25 min total for a dentist in one metro). It gets **slow** only when (a) the dentist practiced across several counties, (b) you need pre-2009 document images, or (c) you must disambiguate a common name.

---

### A4. Does FL DOH list dentist malpractice anywhere? (Honest answer: essentially no)

- **Practitioner Profile:** ❌ does not cover dentists (Chapter 466). Confirmed — the profile search only offers Medicine, Osteopathic, Chiropractic, Podiatry, Nursing.
- **DOH License Verification page** (`https://mqa-internet.doh.state.fl.us/MQASearchServices/...`): shows license status, discipline-on-file flag, public-complaint flag, and enforcement alerts. It does **not** list civil malpractice suits or settlement dollar amounts. It *will* show **board discipline** that arose from a malpractice incident (a related but different thing — a board action, not a court case). **We already surface this in the free report**, so the premium add is the **court** layer, not the board layer.
- **NPDB (National Practitioner Data Bank):** where paid claims are reported — but it is **not public**. Consumers cannot query an individual. Don't promise it.

**So the paid malpractice section = county civil-court search, full stop.** Position it accurately: "We searched the civil-court records of the county(ies) where Dr. X practices for malpractice/negligence suits."

---

### A5. Statewide options — and why they don't help (for now)

- **CCIS (`https://www.flccis.com/`)** is a real statewide, single-search civil-case system — but access is **restricted to the judiciary, law enforcement, and government agencies**. **Not open to the public.** Don't rely on it.
- **FL Courts E-Filing Portal** is for *filing*, not public case-index searching.
- **Third-party aggregators** (UniCourt, etc.) span counties but are **paid** and not an official source — usable only as a *lead* to then confirm on the official county clerk site. **Never cite an aggregator as the source**; always cite the clerk.
- **Manual clerk records request** (mail/in-person) can retrieve old/offline docs but is **slow** (days to weeks) — reserve for Rush reports only.

---

## PART B — Sedation / Anesthesia Permit Status

### B0. The four FL dental sedation credentials

Florida (Board of Dentistry, rules 64B5-14) issues, and requires a **permit** for:
1. **General Anesthesia / Deep Sedation** permit
2. **Moderate Sedation** (adult) permit
3. **Pediatric Moderate / Conscious Sedation** permit
4. (Oral & maxillofacial surgeons typically hold the GA permit via their residency)

Permits renew **biennially**, require passing an **office inspection**, and are subject to routine (min. every 3 years) inspection.
- Board reference: `https://floridasdentistry.gov/sedation-permits-for-general-anesthesia/`

**Why this matters to a patient:** if a dentist is doing sedation/GA *without* the corresponding permit, that's a serious red flag. But — see below — you usually can't confirm the *presence* of a permit for free; you can more reliably confirm a *revoked* one.

---

### B1. What you CAN get for free (the DOH license page)

- URL: `https://mqa-internet.doh.state.fl.us/mqasearchservices/home` → **License Verification** → Profession = **Dentist** → search name/license number.
- Sections shown: profession, license number, **status**, issue/expiration dates, address of record, controlled-substance-prescriber flag, **Discipline on File (Yes/No)**, **Public Complaint (Yes/No)**, **Enforcement Alerts**, and a **Discipline/Admin Action** tab.
- **Key nuance we verified on a live record:** the page does **not** have a clean "Sedation Permit: Active" field. BUT when a permit has been **revoked or disciplined**, it shows up in the **Enforcement Alert / Discipline** section (e.g., a real record read *"anesthesia and pediatric conscious sedation permits were revoked"*).
- Time: ~2–3 min. Free.
- **Takeaway:** free sources reliably reveal a **lost/disciplined** permit, but generally do **not** confirm an **active, in-good-standing** permit.

---

### B2. What confirming an ACTIVE permit requires (public-records request)

Because active permit status isn't exposed as a public search field, the reliable route is a **Florida public-records request** to the Board of Dentistry:

- **Email:** `MQA.Dentistry@flhealth.gov` (Board of Dentistry office)
- Alternative DOH records request pages:
  - `https://www.floridahealth.gov/about-us/boards-councils-and-committees/professional-boards/license-records-request/`
  - `https://www.floridahealth.gov/about-us/boards-councils-and-committees/professional-boards/request-for-disciplinary-and-licensure-documents/`
- **What to ask:** "Under Florida's public-records law, please confirm whether [Dentist name, license # DNxxxxx] currently holds a general anesthesia/deep sedation, moderate sedation, or pediatric moderate sedation permit, and the status/issue date of each."
- **Your rights:** requests need **not** be in writing and you need **not** give a name or reason (per FL public-records law). Email is simply the practical channel.
- **Privacy note for the founder:** email addresses sent to a FL agency become public record. Use a dedicated Vetera inbox, **not** a personal address, and never the founder's name.
- **Time:** **slow / variable** — hours to several business days depending on the office's queue. This is a **Rush-tier / on-request** deliverable, not something to promise turnaround on for a $10 report.

---

### B3. Sedation gotchas

- **Absence of a disciplinary flag ≠ "has a permit."** Don't state or imply a dentist *holds* a permit unless DOH confirmed it via records request. If we only checked the free page, say exactly that: "No revoked/disciplined sedation permit found in DOH enforcement records" — nothing more.
- **Permit ≠ per-procedure guarantee.** A permit is office/practitioner-level; it doesn't tell a patient which sedation they'll personally receive.
- **No downloadable permit-holder dataset.** The FL DOH bulk **data-download** portal (`https://data-download.mqa.flhealthsource.gov/`) now requires an **account/login** (redirects to a Microsoft B2C sign-in). We haven't confirmed a sedation-permit file exists in it — don't assume one does. Treat the per-dentist records request as the source of truth for now. *(Build note: worth logging in later to inventory the available dentist files — if a permit/qualification field exists in bulk, it would let us pre-compute this for the whole state.)*
- **Old PDFs exist but are stale.** The board has historically posted point-in-time "Anesthesia Permit Holders" PDF lists (e.g., a 2013 file). These are **outdated** — cite only current DOH confirmation, never an old PDF.

---

## Premium report — what we can honestly promise

| Data point | Free & fast? | Source | Deliverable tier |
|---|---|---|---|
| Malpractice suits (big-metro dentist, 1 county) | ✅ ~15–25 min | County Clerk civil search | Standard/Premium |
| Malpractice suits (multi-county / pre-2009 docs) | ⚠️ slow | Clerk records request | Rush |
| Malpractice via state Practitioner Profile | ❌ **not available for dentists** | n/a | — (state clearly) |
| Statewide one-shot civil search | ❌ CCIS is not public | n/a | — |
| **Revoked/disciplined** sedation permit | ✅ ~2–3 min | DOH License Verification / Enforcement | Standard/Premium |
| **Active** sedation permit confirmation | ⚠️ slow, request-based | Public-records email to Board | Rush / on request |

**Bottom line for pricing/copy:** the premium report's genuine, defensible value is **"we searched the county civil courts where this dentist practices, and we checked DOH enforcement for any sedation-permit discipline."** Do **not** advertise a "malpractice score," a state malpractice database, or guaranteed active-permit verification — none of those exist for FL dentists for free. Honesty here *is* the moat.

---

## Sources
- [Florida Practitioner Profile FAQs (Board of Dentistry)](https://floridasdentistry.gov/practitioner-profile-faqs/)
- [FL DOH MQA Practitioner Profile Search (professions list — dentists absent)](https://mqa-internet.doh.state.fl.us/mqasearchservices/healthcareproviders/practitionerprofilesearch)
- [FL DOH MQA License Verification (live dentist record showing permit-revocation via enforcement)](https://mqa-internet.doh.state.fl.us/MQASearchServices/HealthCareProviders/LicenseVerification?LicInd=7138&ProCde=701)
- [FL DOH MQA Search Portal home](https://mqa-internet.doh.state.fl.us/mqasearchservices/home)
- [What to Know About the Florida Practitioner Profile (LegalClarity)](https://legalclarity.org/what-to-know-about-the-florida-practitioner-profile/)
- [FL DOH Practitioner Profile guide (which professions must maintain profiles)](https://www.floridahealth.gov/licensing-and-regulation/practitioner-profile/index.html)
- [Sedation Permits for General Anesthesia (Board of Dentistry)](https://floridasdentistry.gov/sedation-permits-for-general-anesthesia/)
- [Sedation Permit for Moderate Sedation (Board of Dentistry)](https://floridasdentistry.gov/renewals/sedation-permit-for-moderate-sedation/)
- [Fla. Admin. Code 64B5-14.007 (sedation inspection rules)](https://www.law.cornell.edu/regulations/florida/Fla-Admin-Code-Ann-R-64B5-14-007)
- [FL DOH License Records Request](https://www.floridahealth.gov/about-us/boards-councils-and-committees/professional-boards/license-records-request/)
- [FL DOH Request for Disciplinary and Licensure Documents](https://www.floridahealth.gov/about-us/boards-councils-and-committees/professional-boards/request-for-disciplinary-and-licensure-documents/)
- [Miami-Dade Clerk — Civil & Family Court](https://www.miamidadeclerk.gov/clerk/civil-court.page)
- [Miami-Dade Clerk — Records](https://www.miamidadeclerk.gov/clerk/records.page)
- [Broward County Clerk — Case Search (Public)](https://www.browardclerk.org/Web2)
- [Orange County Clerk — MyeCLERK](https://myeclerk.myorangeclerk.com/)
- [Hillsborough County Clerk — HOVER FAQ](https://hover.hillsclerk.com/html/faq.html)
- [Palm Beach County Clerk — eCaseView](https://appsgp.mypalmbeachclerk.com/ecaseview/)
- [Florida Comprehensive Case Information System (CCIS) — restricted access](https://www.flccis.com/ccis/login.xhtml)
- [FL DOH MQA Bulk Data Download (login-gated)](https://data-download.mqa.flhealthsource.gov/)