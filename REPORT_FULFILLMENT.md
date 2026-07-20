# How to fulfill a Vetera report (v1) — ~20 minutes

When a customer pays, you'll get: their **email** + **which dentist**. Then do this.

## The look-up checklist (do these 4 in order)

**1. FL DOH license record** → https://mqa-internet.doh.state.fl.us/mqasearchservices/home
   - Search the dentist's last, first name. Open their record.
   - Grab: **license #, status, issue date, expiration, any restrictions**, and whether there's any **discipline** (final orders / complaints). If disciplined, download/open the order and read what happened.
   - ⏱ ~5 min (longer if disciplined).

**2. Federal exclusions (OIG)** → https://exclusions.oig.hhs.gov/
   - Search first + last name. Note **"Not listed"** or the listing details.
   - ⏱ ~2 min.

**3. Federal debarment (SAM.gov)** → https://sam.gov/search/
   - Search the name. Note **"Not listed"** or details.
   - ⏱ ~2 min.

**4. NPI / practice info** → https://npiregistry.cms.gov/search
   - Search the name (State = FL). Grab **NPI #, practice city, specialty**.
   - ⏱ ~3 min.

## Then make the PDF

**Option A — do it yourself:** open `report-template.html`, replace every yellow token with what you found, delete the ✓/⚠/✕ that don't apply, then **File → Print → Save as PDF**. Email it to the customer.

**Option B — easiest for your first few:** paste your 4 look-ups to Claude and say "fill the report template." Claude writes the finished report; you just save as PDF + email.

## Rules (keep Vetera's trust)
- **Facts only.** No opinions, no "this dentist is good/bad." Just what the records say + the source.
- **Cite every finding** (the source links are already in the template).
- If you can't verify something, say "not found in public records" — never guess.
- Keep the disclaimer (it's in the template).

## What v1 does NOT include (yet — future "Premium" tier)
- Malpractice / civil court records (needs slow county-by-county searches)
- Sedation / anesthesia permit lookup
Add these later once v1 is selling and you can charge more.

## Turnaround promise to customers
Aim to deliver within **24 hours**. Under-promise, over-deliver.
