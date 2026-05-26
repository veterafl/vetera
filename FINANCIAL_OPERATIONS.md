# Financial Operations & Transaction Flow

Money architecture for **Lemne pentru Părinți** — how cash moves from diaspora customer to wood supplier, in what currencies, through which accounts, with which margins.

Companion to `STRATEGY.md`.

---

## TL;DR

- **Customer pays in EUR/USD** via Stripe → lands in US-domiciled business account
- **Convert to RON** via Wise Business at near-mid-market rate (saves ~3% vs banks)
- **Pay RO suppliers and staff in RON** from Romanian SRL account or Wise Multi-Currency
- **Margin per €500 order ≈ €180–280** after all fees, FX, taxes
- **Optimal structure:** US LLC takes customer payments + holds the IP; Romanian micro-SRL operates physically in RO. Funds flow via Wise transfers.
- **Cash-flow positive from day one** — customer prepays in July, supplier paid in September

---

## Currency & Money Flow Diagram

```
DIASPORA CUSTOMER (Italy / Germany / US / UK / Spain)
            │
            │  Pays €500 (EUR) or $550 (USD) via Stripe Checkout
            ▼
US BUSINESS BANK (Mercury / Wise USD account / Stripe balance)
            │
            │  Periodic transfer (weekly batch)
            │  Wise Business: EUR/USD → RON at ~mid-market rate
            ▼
ROMANIAN OPERATIONAL ACCOUNT (BCR / ING / Revolut Business RON)
            │
            ├──► Supplier payment (wood): ~1,000–1,250 RON / order
            ├──► Stacker payment (labor): ~200 RON / order (cash)
            ├──► Supervisor monthly salary: ~4,000–6,000 RON/mo
            ├──► Romanian taxes (CASS, CAS, profit tax)
            └──► Operating expenses (fuel, phone, insurance)
```

---

## Pricing Structure

### Core Packages (sold to diaspora)

| Package | Wood quantity | Price (EUR) | Price (USD) | Target customer |
|---|---|---|---|---|
| **Esențial** | 3 ster (≈ 4.2m³) | €350 | $390 | Small house, one elderly person |
| **Standard** | 5 ster (≈ 7m³) | €550 | $605 | Typical rural household |
| **Comfort** | 7 ster (≈ 9.8m³) | €750 | $825 | Larger house, harsh winter |
| **Liniște** | 10 ster + monthly check-in (Nov–Mar) | €1,200 | $1,320 | Premium peace of mind |

### Add-ons (sold à la carte at order time)

| Add-on | Price | Margin |
|---|---|---|
| Premium stacking (covered, in dedicated shelter) | +€60 | +€35 |
| Chimney sweep (autumn, before first fire) | +€80 | +€40 |
| Wood splitter visit (split into stove-size pieces) | +€50 | +€25 |
| Photo report with full inventory + location map | +€20 | +€18 (mostly pure margin) |
| Surprise gift package for parent (sweets, magazine, small gift) | +€30 | +€10 |
| Priority delivery (before Sep 15) | +€50 | +€45 |

### Pricing Rationale
- **All prices in EUR** (primary), with USD shown for US-based customers
- Reference comparison: a hot-water heat pump = €5,000+, a winter of failed delivery = mom freezing
- Diaspora willingness to pay tested informally: €400–800 range is comfortable
- Premium ("Liniște") priced at €1,200 to anchor — and to capture the segment that wants ongoing peace of mind

### Pricing Decisions to Make
- [ ] Should pricing vary by county? (Maramureș vs. Suceava have ~10% wood cost variance)
- [ ] Annual subscription discount? (Pay for 2 years upfront → €1,000 instead of €1,100)
- [ ] Referral discount? (€50 off next order for each new customer referred)

---

## Customer Payment Flow

### What the customer sees

1. **Lands on website** (`vatraromania.com` or `lemnepentruparinti.com` — TBD)
2. **Selects package** + parent's county + add-ons
3. **Fills form:** their name, email, phone, parent's full address, parent's phone, special instructions (gate code, dog, preferred delivery window)
4. **Clicks "Confirmă comanda" / "Confirm Order"**
5. **Stripe Checkout** opens — accepts:
   - Credit / debit card (Visa, Mastercard, Amex)
   - Apple Pay / Google Pay
   - SEPA Direct Debit (EU customers)
   - Klarna / Afterpay (split into 3–4 payments)
   - Bancontact (Belgium), iDEAL (Netherlands), Sofort (Germany)
6. **Charges full amount immediately** (no holds, no installments unless via Klarna)
7. **Confirmation email** in their language (RO / IT / ES / EN / DE)
8. **WhatsApp follow-up** within 24 hours from a human

### Why immediate full payment
- Validates intent (no flaky orders)
- Cash-flow positive before any wood is purchased
- Reduces ops complexity (no invoicing, no chasing)
- Standard for similar trust-services (e.g., funeral home pre-arrangements)

### Why NOT a subscription billing
- Wood is annual, not monthly
- Subscription billing has high failure rate (cards expire, churn)
- One-time charges convert better for episodic services
- Renewal handled manually via email + WhatsApp ("Pentru toamna asta, trimitem aceeași comandă?") — much higher retention than auto-renew

---

## Refund & Guarantee Policy (Customer-facing)

This is the trust mechanism that closes sales. Print it on the website prominently.

### "Garanția Vatra"

> **If we don't deliver what we promised, you don't pay.**
>
> 1. **Quantity guarantee.** Every delivery is measured in front of your parent and photographed. If the load is short by more than 5%, we top it up at our cost.
> 2. **Quality guarantee.** Wood is hardwood (fag/stejar/carpen), dried minimum 12 months, moisture below 25%. If it isn't, we replace it within 7 days.
> 3. **Delivery guarantee.** If wood isn't delivered by October 15, you get a full refund — and we still deliver the wood at our cost.
> 4. **Cancellation.** You can cancel up to 14 days before scheduled delivery for a full refund. After that, 50% refund.
> 5. **Force majeure.** If we cannot deliver due to weather, road closures, or other extraordinary events, we coordinate alternative dates with you — full refund available if no date works.

### Refund Mechanics
- Refunds processed via Stripe (back to original payment method)
- Maximum refund window: 90 days post-payment (Stripe limit)
- Partial refunds (e.g., short-quantity top-up failed) at supervisor's discretion, you approve
- Refund rate target: under 3% of orders (industry-realistic for first-year trust businesses)

---

## Stripe Configuration

### Stripe Account
- **Entity:** US LLC (or single-member LLC)
- **Currency settings:** Accept EUR, USD, GBP as primary; auto-convert all to USD in Stripe balance
- **Stripe fees:**
  - EU cards: 1.5% + €0.25
  - Non-EU cards: 2.9% + €0.25
  - Currency conversion (Stripe): 1% (avoid if possible — use Wise instead)
- **Payout schedule:** Weekly batch to Mercury / Wise USD
- **Fraud rules:** Stripe Radar default + custom rule blocking non-EU/US/UK cards (90% of fraud)

### Per-transaction Stripe cost (€500 order, EU card)
| Item | Amount |
|---|---|
| Order value | €500.00 |
| Stripe processing fee | −€7.75 (1.5% + €0.25) |
| Net to Stripe balance | €492.25 |

### Per-transaction Stripe cost (€550 order, US card paid in USD)
| Item | Amount |
|---|---|
| Order value | $605.00 |
| Stripe processing fee | −$17.80 (2.9% + $0.30) |
| Net to Stripe balance | $587.20 |

---

## Currency Conversion (EUR/USD → RON)

### Tool: Wise Business Multi-Currency Account

**Why Wise over banks:**
- ~0.4% conversion fee vs. 2–4% at traditional banks
- Real mid-market exchange rate
- Holds balances in 40+ currencies including RON
- Can pay Romanian suppliers via bank transfer in RON from EUR/USD balance
- API for automation if needed later

### Per-transaction FX cost (€500 order)
| Item | Amount |
|---|---|
| Stripe net | €492.25 |
| Wise conversion EUR → RON (≈ 4.97 RON/EUR May 2026, 0.4% fee) | −€1.97 |
| Net RON delivered | ≈ 2,438 RON |

### Alternative: Revolut Business
- Similar fees to Wise
- Better app/UX for some users
- Currency rates can be slightly worse on RON
- Free transfers between Revolut accounts (useful if supervisor also on Revolut)

### Recommended setup
- **Primary:** Wise Business (USD + EUR + RON balances)
- **Secondary:** Revolut Business (RO account, for paying RO staff faster)
- **Tertiary:** A real Romanian bank account (BCR or ING) — needed for SRL setup and for paying ANAF (Romanian tax authority)

---

## Operational Expenses (RO Side)

### Per-Order Cost Stack (Standard package, €550 sell price)

| Cost item | Amount (RON) | Amount (EUR equiv) |
|---|---|---|
| Wood (5 ster, dry hardwood, wholesale) | 1,100 | €221 |
| Transport (if not bundled with supplier) | 150 | €30 |
| Stacker labor (4 hours @ 50 RON/hr) | 200 | €40 |
| Supervisor verification (per-order allocation) | 100 | €20 |
| Fuel / mileage allocation | 50 | €10 |
| SUMAL paperwork / admin | 25 | €5 |
| **Total per-order direct cost** | **1,625 RON** | **€326** |

### Fixed Monthly Costs (per county operation)

| Item | Cost (RON/mo) | Cost (EUR/mo) |
|---|---|---|
| Supervisor salary (part-time, 60 hrs/mo) | 5,000 | €1,005 |
| Phone + data for supervisor | 100 | €20 |
| Local insurance (liability + supervisor accident) | 400 | €80 |
| SRL accounting (contabil) | 500 | €100 |
| Bank fees, miscellaneous | 100 | €20 |
| **Total fixed monthly** | **6,100 RON** | **€1,225** |

### Founder-Side US Costs

| Item | Cost (USD/mo) |
|---|---|
| Website hosting (Carrd / Framer) | $20 |
| Email (Google Workspace) | $7 |
| Stripe (no monthly fee, per-tx only) | $0 |
| Wise Business (no monthly fee) | $0 |
| Mercury bank account | $0 |
| WhatsApp Business | $0 |
| US LLC annual fee (Delaware / Wyoming) | $25/mo amortized |
| US tax prep / bookkeeping | $50/mo amortized |
| **Total fixed US monthly** | **~$100/mo** |

---

## Per-Order P&L (Worked Example)

**Customer:** Diaspora daughter in Milan, orders Standard package + premium stacking for her mother in Maramureș.

| Line item | EUR | RON |
|---|---|---|
| **Revenue: Standard (€550) + Premium stacking (€60)** | **€610** | (incoming) |
| Stripe fee (EU card) | −€9.40 | |
| Stripe → Wise USD → Wise EUR holding | (no further fee) | |
| Wise EUR → RON conversion (0.4%) | −€2.40 | |
| **Net to RON account** | | **≈ 2,962 RON** |
| Wood (5 ster) | | −1,100 |
| Transport | | −150 |
| Stacker (premium: 6 hrs instead of 4) | | −300 |
| Supervisor allocation | | −100 |
| Fuel/admin | | −75 |
| **Direct cost (RON)** | | **−1,725** |
| **Direct margin (RON)** | | **+1,237** |
| **Direct margin (EUR)** | **≈ €249** | |

### Annual contribution margin scenarios (one county)

| Orders/year | Direct margin/order | Total direct margin | Less fixed monthly (12 × €1,225 + 12 × $100) | Net profit |
|---|---|---|---|---|
| 50 | €220 | €11,000 | −€15,900 | **−€4,900 (loss)** |
| 100 | €220 | €22,000 | −€15,900 | **+€6,100** |
| 200 | €220 | €44,000 | −€15,900 | **+€28,100** |
| 500 | €220 | €110,000 | −€15,900 | **+€94,100** |
| 1,000 | €220 | €220,000 | −€15,900 | **+€204,100** |

**Break-even:** approximately **73 orders/year** in one county.

This means: **year 1 likely break-even or small loss. Year 2 onward should be solidly profitable** if you cross 100 orders.

---

## Cash Flow by Month (Conservative Year 1 — 100 orders)

| Month | Inflows (EUR) | Outflows (EUR) | Cumulative cash |
|---|---|---|---|
| May | €0 | −€2,000 (setup) | −€2,000 |
| June | €0 | −€1,225 (fixed) | −€3,225 |
| July | €5,500 (10 early orders) | −€1,225 | +€1,050 |
| August | €27,500 (50 orders) | −€1,225 | +€27,325 |
| September | €22,000 (40 orders) | −€16,225 (50 deliveries × ~€326 + fixed) | +€33,100 |
| October | €0 | −€13,225 (40 deliveries + fixed) | +€19,875 |
| November | €0 | −€1,225 | +€18,650 |
| December | €0 | −€1,225 | +€17,425 |
| Jan–Apr 2027 | €0 | −€4,900 (4 × €1,225) | **+€12,525** |

**Year 1 net result: ≈ +€12,500** (assuming 100 orders, conservative).

**Note:** This assumes zero salary draw for founder. A real launch year is often slightly negative or breakeven, with year 2 hitting €20–40k net.

---

## Legal & Tax Structure

### Option A: US LLC only (simplest)
- Founder runs everything through a US LLC (Delaware or Wyoming, ~$300 to set up)
- Pays Romanian supervisor as 1099 contractor (or via PFA on the RO side)
- Pays suppliers via Wise direct transfer
- **Pros:** simplest, single jurisdiction, pass-through taxation in US
- **Cons:** no Romanian legal presence, harder to do business with some RO suppliers, no Romanian VAT registration (may be required if RO revenue exceeds ~88,500 RON threshold)

### Option B: Romanian SRL only
- Set up Romanian micro-SRL (~€500 to register)
- All revenue and expenses flow through Romanian company
- Pays Romanian taxes (1–3% on turnover for micro-SRL, plus dividend tax 8% on distributions)
- **Pros:** clean Romanian legal presence, simpler for RO operations
- **Cons:** worse for collecting EUR/USD via Stripe (Stripe Romania less mature than Stripe US), founder has to repatriate dividends to US and pay US tax too (double taxation, partially offset by treaty)

### Option C: Both (recommended for scale)
- **US LLC** owns the brand, IP, website, contracts with diaspora customers, holds Stripe
- **Romanian SRL** is contracted by US LLC to handle physical operations in RO
- US LLC pays SRL a monthly operating fee (margin transfer)
- **Pros:** optimal for cross-border legal/tax, separates customer-facing from physical ops, easier to scale to multiple counties
- **Cons:** more setup complexity (~€1,500 total), need a Romanian contabil from day one

### Recommended Path
- **Year 1 (under 100 orders):** Start with **US LLC only**. Pay supervisor as 1099 contractor.
- **Year 2 (100+ orders):** Add **Romanian micro-SRL** as operational arm.
- **Year 3+ (multi-county):** Refine to Option C structure if growing.

---

## Taxes — Practical Map

### US Side
- US LLC = pass-through (single-member) or partnership
- Founder reports income on Schedule C or K-1
- US federal tax + state tax (varies)
- Foreign earned income exclusion does NOT apply (you live in US)
- Foreign tax credit applies if you paid Romanian tax (avoids double tax)

### Romanian Side (if SRL exists)
- **Micro-SRL:** 1% tax on turnover if revenue < €60,000/yr; 3% if €60,000–€500,000
- **VAT:** Required if turnover > 300,000 RON (~€60,000). Adds 19% VAT to invoices. Most diaspora customers won't care, but adds bookkeeping.
- **Dividend tax:** 8% on distributions to shareholders
- **Supervisor payroll:** If hired as employee, ~42% combined employer + employee social charges. If hired as PFA contractor, simpler.
- **Profit tax:** 16% on profits if not under micro regime

### Sales Tax / VAT for Customers
- **EU customers:** B2C services typically taxed at customer's country VAT rate. Below €10,000/year EU sales, you can apply your home country rate. Above, use OSS (One-Stop Shop) registration.
- **US customers:** No sales tax on services (in most states)
- **Recommendation:** Stay under €10,000 EU sales in year 1 if possible to defer VAT complexity. Above that, register for VAT OSS.

### Pro tip
Hire a Romanian contabil ($100/mo) from month one. Tax mistakes are expensive; the cost of a contabil pays itself in the first audit avoided.

---

## Bookkeeping & Tools

### Tools Stack

| Tool | Purpose | Cost |
|---|---|---|
| **Stripe Dashboard** | Customer payments, refunds, payouts | Free |
| **Wise Business** | FX, multi-currency, supplier payments | Per-tx fee only |
| **Mercury (US bank)** | USD operating account, holds founder draws | Free |
| **Romanian SRL bank** (BCR or ING) | RON operating, supplier payments, taxes | ~€5–20/mo |
| **Google Sheets** | Customer order log, delivery tracking | Free |
| **Wave or QuickBooks Self-Employed** | US bookkeeping | $0–25/mo |
| **Romanian contabil** | RO bookkeeping + tax filings | ~€100/mo |
| **HelloSign / DocuSign** | Customer contracts (if needed) | $15/mo |
| **Notion** | Internal SOPs, supplier list, supervisor handbook | Free–$10/mo |

### Records to keep (legally + practically)

- Every customer order: name, email, payment confirmation, delivery date, photo proof, signed delivery confirmation from parent
- Every supplier invoice with SUMAL number (legal requirement — wood provenance traceability)
- Every supervisor payment with receipt
- Every stacker payment (cash + signed receipt for tax records)
- Monthly P&L spreadsheet
- Bank statements from all accounts, monthly

### Reconciliation cadence
- **Daily** during peak season (Aug–Oct): match orders to payments
- **Weekly:** Wise/Stripe reconciliation, supplier payment batches
- **Monthly:** P&L review, tax set-aside (set aside ~25% of profit for taxes)
- **Quarterly:** Tax filings (US estimated taxes, RO VAT if applicable)
- **Annually:** Full tax return both jurisdictions

---

## Risk Management (Financial)

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Stripe holds payouts for fraud review | Medium | High (cash flow) | Submit business documentation upfront; keep 2-month operating buffer |
| Card chargebacks from disappointed customers | Low–Medium | Medium | Photo proof at delivery; strong refund policy; respond fast |
| FX rates move against you between sale & spend | Low | Low (5–10% swings) | Convert to RON in small batches, weekly |
| Supplier price spikes mid-season | Medium | Medium | Lock supplier pricing in May–June contracts |
| Supervisor embezzlement | Low | High | Two-person rule for >€500 cash; bank transfers preferred; insurance |
| Romanian tax audit | Low first year | Medium | Hire contabil from day one; keep clean SUMAL paperwork |
| US tax filing missed | Medium | Medium | Bookkeeper or QuickBooks from day one; calendar reminders |
| Customer disputes "didn't authorize" charge | Low | Low–Medium | Stripe Radar; require billing address match; collect IP address |

---

## Next Decisions (Financial)

- [ ] **Choose Stripe account jurisdiction:** US (default) vs. UK vs. EU. **Recommend: US.**
- [ ] **Choose currency exchange tool:** Wise Business vs. Revolut Business. **Recommend: Wise.**
- [ ] **Choose primary RO bank:** BCR / ING / Banca Transilvania / Revolut RON only. **Recommend: ING or Banca Transilvania for low fees + modern app.**
- [ ] **Choose legal structure for Year 1:** US LLC only vs. SRL only vs. both. **Recommend: US LLC only for year 1, add SRL in year 2.**
- [ ] **Hire Romanian contabil:** When? **Recommend: by July 2026, before first orders.**
- [ ] **Pricing currency display:** EUR only vs. EUR + USD + GBP. **Recommend: auto-detect by visitor IP, show one default but allow toggle.**
- [ ] **Cancellation window:** 14 days (current proposal) vs. 7 days vs. 30 days. **Recommend: 14 days.**
- [ ] **Acceptance of installments (Klarna):** Yes or no. **Recommend: yes — converts higher.**

---

## Summary: One-Page Economics

- **Average order:** €550 gross
- **Total fees + FX:** ~€12 (~2.2%)
- **Net to RON account:** €538 (~2,675 RON)
- **Direct cost in Romania:** ~€326 (1,625 RON)
- **Direct margin:** ~€212–249 per order
- **Fixed monthly burden:** ~€1,325 (€1,225 RO + $100 US)
- **Break-even:** ~73 orders/year
- **Realistic Year 1:** 100 orders → ~€6k profit
- **Realistic Year 2:** 250 orders → ~€38k profit
- **Realistic Year 3:** 600 orders → ~€115k profit (still one county, with upsells starting)

Cash-flow positive from day one because customers prepay months before suppliers are paid. The riskiest financial moment is Q1–Q2 (off-season cash burn before summer orders start). Keep €5–8k operating buffer to survive that gap comfortably.
