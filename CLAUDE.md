# Buisness

Working directory for business-related projects.

## Founder context

- Romanian, lives in the US.
- Has Virginia Medicaid; no medical/professional background should be assumed.
- Bandwidth: 5–20 hours/week for the side business.
- Target company shape: **1–3 person, very niche, very small**. Not VC-scale, not a freelancing setup. Monopoly = dominating a *tiny* niche.
- Distribution must be **online / word-of-mouth / community-driven** — no local business network to rely on.

## Active project: Vetera (working name)

**One-liner:** Vetera turns the public record on Florida healthcare providers into a clear, sourced report you can read in five minutes — so you walk into your appointment knowing what's on file.

**Vetera** is a website that lets people check the public-record background of **Florida dentists and oral surgeons** (license status, disciplinary actions, sedation permits, malpractice, federal sanctions) before they undergo a procedure.

- **Niche (locked):** Florida dentists and oral surgeons. Will expand to other FL specialties (oral/cosmetic/bariatric) after the first 50 paying customers.
- **Positioning:** Independent. No advertising from providers. Public-record facts only — no opinions, ratings, or recommendations.
- **Pricing:**
  - Free Quick Check (search box opens the FL DOH license & discipline portal in a new tab, pre-filled with the typed name).
  - Standard Report — **$10 launch pricing** for the first 10 customers; $25 thereafter.
  - Rush Report — $75 (24 hours, phone consult included).
- **Strategic moat:** independence-as-business-model — Healthgrades/DocInfo/etc. can't copy because they'd lose ad revenue from providers. Pairs with Henderson's "structural differentiation" lens.
- **Working name only.** Don't agonize over the final name now — naming is a post-validation task.

## Project files

```
site/
├── index.html          Google-style minimal landing + Quick Check search
├── search.js           Renders source-button panel (no API calls)
├── styles.css
├── pricing.html        Three tiers — Quick Check / Standard / Rush
├── sample-report.html  Mock report (fictional Dr. Jane Sample)
├── methodology.html    Sources + process + limits
├── faq.html            Objection handling
├── request.html        "Ask first" form (mailto-based, placeholder email)
└── thank-you.html      Post-Stripe redirect; collects provider details
```

## Tech state

- Pure static HTML / CSS / vanilla JS. No build step. No framework.
- Quick Check: search box opens the FL DOH portal in a new tab (no inline data lookup).
- FL DOH MQA portal has **no public API** and is blocked by CORS — cannot connect directly from browser.
- Planned next: download FL DOH bulk data files from [data-download.mqa.flhealthsource.gov](https://data-download.mqa.flhealthsource.gov/), process into local JSON, ship with site. This gives real FL license + discipline data inline without a backend.
- `request.html` and `thank-you.html` both use `mailto:` to placeholder `hello@vetera.example` — must be replaced with founder's real email before sharing the site.
- `pricing.html` has two **Stripe Payment Link placeholders** (`REPLACE_WITH_STRIPE_STANDARD_LINK`, `REPLACE_WITH_STRIPE_RUSH_LINK`) that must be swapped with real Stripe-hosted URLs before taking real payments. Setup steps are inline in the HTML comments.
- Stripe Payment Link redirect URLs should append `?type=standard` or `?type=rush` so `thank-you.html` can show the right SLA copy.

## Current state / next steps

1. Replace placeholder email in `request.html` and `thank-you.html` before sharing.
2. Create Stripe account → set up two Products ($10 Standard, $75 Rush) → generate Payment Links → set redirects to `thank-you.html?type=standard|rush` → paste URLs into `pricing.html`.
3. Build FL DOH bulk-data downloader/parser → local `providers.json`.
4. Buy domain + free host on Cloudflare Pages or Netlify.
5. First validation: send site URL to 5–10 people; see if anyone orders a $10 report.

## Conventions

- Keep it simple — minimal pages, no frameworks, no premature abstraction.
- All claims in reports must cite a public source URL.
- Never publish opinions, ratings, recommendations, or clinical interpretations — facts only.
- Working with public records exclusively; legal disclaimer on every page.

## Commands

- Open the site locally: `open site/index.html`
- That's the whole build process for now.

## Notes for Claude

- Be as brief as possible in responses to the user.
- When discussing business strategy, blend three lenses:
  - **Peter Thiel:** favor monopoly over competition, hunt for secrets, first principles, definite optimism, "what important truth do very few people agree with you on?", 10x over incremental, vertical progress over horizontal.
  - **Jensen Huang (Nvidia):** long time horizons, build platforms not products, ride a technology wave 10+ years early, "the more you buy, the more you save" — invest aggressively when conviction is high, embrace pain/discomfort ("greatness comes from suffering"), flat orgs and direct communication, work backward from a future market that doesn't yet exist.
  - **Bruce Henderson (BCG founder):** strategy is about relative position, not absolute effort; exploit the experience curve (cost drops predictably with cumulative volume); the growth-share matrix (stars/cash cows/question marks/dogs) — fund winners, harvest cash cows, kill dogs; competitive advantage comes from being structurally different, not better at the same thing.
- Do not propose product ideas centered on incorporating AI — that space is considered too saturated. Steer brainstorming and recommendations toward non-AI-centric opportunities.
- Do not assume founder background. She has explicitly asked to ignore her professional/educational history when giving advice.
- Niche is locked for now (FL dental + oral surgery). Resist scope creep to "all medical" — that's a future-phase decision after first 50 customers.
- Validation > polish. Push toward first paying customer before perfecting design or name.
