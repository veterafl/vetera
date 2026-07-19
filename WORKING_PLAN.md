# Vetera — Working Plan

_Last updated 2026-07-19. Traffic-first pilot → monetize after demand is proven._

## Where things stand (accurate as of 2026-07-19)

- **Free lookup:** working; plain-language license + discipline + city. City correctness bug FIXED — data ships only FL-county-verified cities (no more "Rome, FL"/"Chicago, FL"). `site/data/dentists.json` is clean (21,896 cities; 14,969 active-with-city).
- **Traffic engine (the money-maker):** 29,714 per-dentist pages (`site/d/`), A–Z browse (`site/dentists/`), `sitemap.xml`, `robots.txt` — all **built and committed** on the corrected data.
- **NOT deployed.** Live `vetera-six.vercel.app/sitemap.xml` → 404. Google has never seen the pages. This is the single thing capping views (~21).
- **Deploy blocked:** local `main` is 34 commits ahead of `origin/main`, and the two have **forked histories** (no common ancestor; origin was built via GitHub "Add files via upload"). A normal `git push` won't work.
- **Money layer:** not built. Plan below is fake-door validate → manual report MVP → B2B/expand.
- **Costs:** ~$50 to launch, ~$0–30/mo to run, ~$1–5/sale in fees. Capital-light.

---

## Phase 0 — Ship the corrected traffic engine  ·  ~10–15 hrs  ·  target: this week
**This is the gate on everything. No views, no money, until it's live.**

| # | Task | Owner | Est |
|---|------|-------|-----|
| 0.1 | Regenerate pages from clean data + spot-verify: `build_dentists.py` → `gen_seo_pages.py`; confirm 0 out-of-state ", FL", and non-active pages make no licensure claim | Claude | ~1h |
| 0.2 | **Resolve deploy:** consolidate to ONE project on the canonical URL; overwrite forked `origin/main` with local `main` (force-push — histories are unrelated). Destructive + outward-facing → founder green-lights, Claude preps exact commands | Founder + Claude | ~2–4h |
| 0.3 | Wire UX: result card → `/d/` page; `?q=` auto-run search; share button + red/amber/green `og:image`; **fake-door "See full record →" CTA** logging an `intent_report` event | Claude | ~4–8h |
| 0.4 | Analytics: confirm script fires on live URL (200, not 404); add `open_state_record` + `profile_view` + `intent_report` events; exclude founder's own visits | Claude + founder verify | ~1–2h |
| 0.5 | SEO activation: submit `sitemap.xml` to Google Search Console; drip-index **disciplined dentists first**, then big cities; add ~20–40 city hub pages for crawl paths | Founder (Google acct) + Claude prep | ~1–2h |

**Gate to Phase 1:** live canonical URL serving the fixed pages · analytics firing · sitemap submitted.

---

## Phase 1 — Drive & measure traffic to ~1000 uses  ·  ~2–4 hrs/wk  ·  weeks 2–10+

- **Seed where FL dental-anxious people already are** (value-first, disclose you built it, never drop raw links — 89% of first-post links get banned): r/AskDentists, FL city subreddits, Quora, Nextdoor, retiree + dental-implant Facebook groups. Point links at a high-value `/d/` page or a pre-filled `?q=` search, not the bare homepage.
- **Watch:** `search` events (found/none), `profile_view`, and especially **`intent_report` fake-door clicks** = willingness-to-pay signal.
- **The clock:** SEO indexing is weeks→months (the real ramp); community seeding is the near-term trickle.
- **Validate the consumer thesis cheaply:** measure Google Keyword Planner volume for "check florida dentist license" / "[name] complaints" (~30 min); cross-check against fake-door `intent_report` clicks. Near-zero → pivot to B2B-first.

**Gate to Phase 2:** ~1000 real uses AND fake-door clicks show demand (≈20–50 `intent_report` clicks). Don't build the paid product before this.

---

## Phase 2 — Turn on the paid report (manual MVP)  ·  ~10–15 hrs  ·  when demand signal fires

It's a **service, not software** — fulfill by hand first.

- Stripe account + 2 payment links: **Standard** ($10–25 launch) and **Rush** ($75, incl. phone consult).
- `sample-report.html` → fillable template.
- Fulfillment **checklist** (where to pull each source: full disciplinary order, malpractice/civil court, OIG/SAM/DEA, sedation permit, out-of-state discipline).
- Wire buy button + thank-you flow (mostly already built; replace placeholder email).
- Fulfill each report by hand (~2–4h). Price to cover time + fees.

**Gate to Phase 3:** ~10–50 paid reports fulfilled → real conversion + price learned.

---

## Phase 3 — Scale the money  ·  ongoing

1. **Lean into the highest-ACV signal** (consumer vs B2B — informed by the revenue-comparables research).
2. **B2B:** outreach to malpractice/PI attorneys ($100–300/report, repeat); "alert me if this dentist gets disciplined" **monitoring subscription** (recurring).
3. **Automate report pulls** only after volume justifies (~40–80h; experience-curve — automate what you've already done by hand).
4. **Expand verticals** reusing the same machine: other FL specialties → other states → adjacent (roofers). Each new vertical multiplies the pie.

---

## Daily launch sprint (≈30–60 min/day) — keep momentum, one win a day

**[you] = your hands · [me] = Claude does it, you just check the result.**

**Week 1 — get live**
- **Day 1 — Decide & measure.** [you] Say "go" on Phase 0; run the Google Keyword Planner check (~30 min) and jot the top volumes for "check florida dentist license" / "[name] complaints". *Done when: you know if consumer demand is real.* [me] Regenerate pages from fixed data + start the UX wiring.
- **Day 2 — Unblock deploy.** [you] Green-light the force-push + one-Vercel-project consolidation. [me] Prep the exact commands. *Done when: path to live is clear.*
- **Day 3 — GO LIVE. 🎉** [me] Deploy. [you] Open the live URL, search 3 dentists, check it on your phone. *Done when: the real site + 29k pages are live on correct data.*
- **Day 4 — Tell Google.** [you] Submit `sitemap.xml` in Google Search Console; "Request indexing" on 5 disciplined-dentist pages. *Done when: Google knows you exist.*
- **Day 5 — Trust the numbers.** [you] Run a few live searches, confirm they show in Analytics; exclude your own visits. [me] Verify events fire. *Done when: analytics is trustworthy.*
- **Day 6 (light) — Warm up.** [you] Make/refresh Reddit + Quora accounts; read the rules of r/AskDentists + 2 FL city subs; upvote a few things. **No posting yet.** *Done when: accounts are warming.*
- **Day 7 — Rest / buffer.**

**Week 2 — first traffic**
- **Day 8 — First value post.** [you] Answer ONE real "how do I check my dentist" question (Quora or a FL subreddit) with the *method* + disclosed tool link.
- **Day 9 — Watch.** [you] Check analytics: visits? fake-door `intent_report` clicks? Write the numbers down.
- **Day 10 — Second post + reflect.** [you] One more value post in a different community; review uses-so-far vs the ~1000 goal.

## Repeating weekly rhythm (after launch, ~3–5 hrs/wk)
- **2×/week:** one value-first community post (rotate communities; never spam links).
- **1×/week:** check analytics — uses, fake-door clicks, which pages pull traffic.
- **1×/week:** "Request indexing" on another batch of pages (disciplined + big-city first).
- **Monthly:** decide — fake-door clicks showing demand? → build the paid report (Phase 2). Thin? → email 5 FL dental-injury firms (start B2B). Either way, one concrete move.

## Roles & cadence
- **Claude:** code, data, page generation, analytics wiring, deploy prep, drafting.
- **Founder (5–20 hrs/wk):** the decisions and outward actions — deploy trigger, Google/Stripe/domain accounts, community posting, legal/LLC.

## Open decisions (founder)
- Green-light the force-push + Vercel consolidation (Phase 0.2).
- Lead consumer or B2B in Phase 3 (pending revenue research).
- When to add LLC + a one-time legal consult (~$300–650, deferrable until revenue).

## Revenue expectation (tightened 2026-07-19, fact-checked comparables)

**Durable base case is B2B, not consumer.** Consumer reports validate + feed the funnel; attorney reports + a monitoring subscription are the defensible revenue.

| Horizon | Realistic | Notes |
|---|---|---|
| Year 1 | **$2–12k** | B2B-dependent; consumer-only + slow SEO could be <$2k |
| Matured yr 2–3 (FL-dental) | **$15–45k/yr** | B2B-led; consumer ~$5–15k of it |
| Ceiling (FL-dental only) | **~$60k/yr** | To exceed → expand verticals/states |

**Verified inputs:** consumer free→paid **0.5–1% of engaged searchers** (0.1–0.5% off raw pageviews; sub-1% because the free tool answers the basic question). Standard report **$20–25** (CARFAX single = $44.99, Intelius $15–30 — room to test higher). Rush $75. B2B report **$75–150** flat; monitoring sub **$500–3,000/yr/firm** (under the $110–300/mo they pay for Westlaw/Lexis); buyer pool dozens-to-low-hundreds of FL dental-injury firms (~2,120 FL med-mal attorneys). **Ads ≈ $0** (RPM $8–15, immaterial until 50k sessions/mo, breaks the independence moat).

**Decisive unknown → validate first (cheap):** the monetizable consumer query volume ("[name] complaints", "check FL dentist license") is **unmeasured, possibly near-zero**. Measure in Google Keyword Planner (~30 min, free) AND read it off the Phase-0 fake-door clicks before betting on the consumer SEO line. If thin → go B2B-first.
