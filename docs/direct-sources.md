# Direct institution sources

Reviewed 5 October 2026. The public-rate migration register has **zero pending entries and zero unreconciled legacy products**. All 112 implemented adapters have passed live checks. Production deployment and D1 publication are separate from the read-only verification recorded here.

Rate values come only from institution websites, public feeds used by those websites, and their currently linked disclosures. The interest.co.nz client and parsers have been removed. Failed collection cannot fall back to an aggregator, saved fixture or previous rate.

## Coverage and scope

The register preserves all 84 provider identities from the existing API and adds Bank of India, Christian Savings and Gold Band Finance: **87 reviewed identities, 66 with active adapters**. This covers the reviewed public offers in the four API categories. It is not a claim that every registered financial business, privately negotiated loan or member-only offer in New Zealand has a public rate.

| Dataset | Active institutions | Pending | Reviewed exclusions | Adapters |
| --- | --: | --: | --: | --: |
| Mortgages | 36 | 0 | 2 | 36 |
| Personal loans | 34 | 0 | 8 | 34 |
| Vehicle loans | 26 | 0 | 8 | 26 |
| Credit cards | 15 | 0 | 11 | 16 |

The machine-readable source of truth is [`institutions.json`](../apps/api/bin/direct/institutions.json). Every excluded category has a reason, evidence URL and review date. Every renamed or removed legacy product has an explicit decision. Exclusions remain visible; they are not counted as successful rate extraction.

The [live source audit](direct-source-audit.json) records source-level outcomes and observation counts; [browser diagnostics](browser-source-audit.json) distinguish failed local access from a successful cloud retry. Test fixtures are independent of runtime collection.

### Resolved access and extraction issues

- **TSB:** local HTTP and Chromium return 403, while Browser Use Cloud retrieves the home-loan, personal-loan, overdraft and formal card disclosures. TSB's exact blocking rule is not exposed. A local 403 does not mean the bank's public website is unavailable.
- **ASB and BNZ:** browser rendering waits for their public rate feeds and populated cells. ASB Gold uses the exact JSON response from its public feed through the browser when runner HTTP access is blocked. ASB card readiness matches its actual twelve API-populated cells; the separate introductory-rate cell is not an API placeholder.
- **Kiwibank, Finance Now and Gilrose:** GitHub-hosted HTTP requests timed out or were refused although local HTTP succeeded. Kiwibank pages and its JSON feed, Finance Now cards and Gilrose loan disclosures therefore use the same browser transport and cloud fallback. Feed responses must be valid JSON before the source parser checks identifiers, enabled flags and field values.
- **Westpac and Q Card:** affected pages use browser transport. Product names identify card rates, avoiding positional row mismatches.
- **Bank of India:** the cloud host's default context completes its security interstitial. The collector waits for a successful same-origin document response before accepting the table. The home-loan page still labels its schedule effective 1 March 2023; this is preserved in the condition, not presented as a newly changed rate. Its separate current interest-rate page contains deposits, which are not substituted for lending rates.
- **Bank of China:** repeated GitHub verification exposed an intermittent HTTP connection failure. Both the index and its latest linked mortgage disclosure use browser transport with cloud fallback. Index readiness requires the named mortgage link; the discovered disclosure must pass the same origin checks and populate its rate table before parsing.
- **Other lenders:** current canonical domains, linked PDFs, rate ranges, fixed-term ranges and tiered tables now have deterministic adapters and coverage decisions. Table shape changes fail collection instead of silently moving values to another product.

### Scope decisions that do not produce rates

- **NZ Loan:** the official [Companies Register](https://app.companiesoffice.govt.nz/co/2061561) records NZLOAN LIMITED as Removed, last updated 25 February 2014. Historic advertising identifies `nzloan.co.nz`; no current independent offer was verified. No unrelated modern company is substituted.
- **NZICA:** its [NZ member benefits](https://www.charteredaccountantsanz.com/member-services/member-benefits/business-offers-nz) require member login. The association is not a separate card issuer. This private affinity offer is outside the public catalogue; it is not asserted discontinued. Public Amex products are collected separately without inventing member discounts.
- **Bank of India personal lending:** its public Advances page publishes home-loan rates and business base rates, but no numerical consumer personal-loan offer. The linked personal download is an application form. Individual quotes are outside public-rate extraction.
- **Closed or transferred providers:** Kookmin's borrower wind-down, Advaro's transfer, HSBC's retail exit, Diners' closure, and closed retail-card brands have recorded evidence. A failed HTTP request alone is never evidence of closure. Company-register records and original closure reporting can support status decisions; they never supply numerical rates.
- **Duplicates and non-credit products:** issuer/brand duplicates, prepaid/debit cards and retired promotions are reviewed in the register. Kiwibank and SBS consumer loans point to their actual current lending providers. Current public servicing rates remain included where published, even if applications are closed.

### Institution register

A = active adapter; X = reviewed exclusion; — = not listed in this catalogue. Dataset-specific sources, conditions and decisions are in the JSON register.

| Institution | Mortgages | Personal | Vehicle | Cards | Evidence / source |
| --- | :-: | :-: | :-: | :-: | --- |
| ANZ | A | A | — | A | [Source](https://www.anz.co.nz/rates-fees-agreements/home-loans/) |
| ASB | A | A | A | A | [Source](https://www.asb.co.nz/home-loans-mortgages/interest-rates-fees.html) |
| BNZ | A | A | — | A | [Source](https://www.bnz.co.nz/personal-banking/home-loans/compare-bnz-home-loan-rates) |
| Bank of Baroda | A | A | A | — | [Source](https://www.barodanzltd.co.nz/rates-and-charges/rate-of-interest-on-loans) |
| Bank of China | A | — | — | — | [Source](https://www.bankofchina.com/nz/en/bocinfo/bi3/) |
| China Construction Bank | A | — | — | — | [Source](https://nz.ccb.com/lng/newzealand/en/service/262586.shtml) |
| Co-operative Bank | A | A | A | A | [Source](https://www.co-operativebank.co.nz/api/content/content/website/rates) |
| Heartland Bank | A | A | A | — | [Source](https://www.heartland.co.nz/home-loans) |
| ICBC | A | — | — | — | [Source](https://nz.icbc.com.cn/ICBC/%E6%B5%B7%E5%A4%96%E5%88%86%E8%A1%8C/%E5%B7%A5%E9%93%B6%E6%96%B0%E8%A5%BF%E5%85%B0%E7%BD%91%E7%AB%99/EN/RatesFees/HomeLoans/HomeLoan.htm) |
| Kiwibank | A | X | X | A | [Source](https://www.kiwibank.co.nz/personal-banking/home-loans/rates-and-fees/) |
| Kookmin | X | — | — | — | [Source](https://kbglobal.kbstar.com/commonbiz/file/comFilefiledown?name=172889241768722116998594070&path=board%2F1728892417687221169&realname=02.Specific+notice+for+Borrower.pdf) |
| SBS Bank | A | X | — | A | [Source](https://www.sbsbank.co.nz/rates) |
| TSB Bank | A | A | — | A | [Source](https://www.tsb.co.nz/rates-fees-agreements/home-loan) |
| Westpac | A | A | A | A | [Source](https://www.westpac.co.nz/home-loans-mortgages/interest-rates/) |
| Heretaunga Bldg Socy | A | — | — | — | [Source](https://www.heretaungabuildingsociety.co.nz/borrow/) |
| Nelson Bldg Society | A | A | — | — | [Source](https://www.nbs.co.nz/interest-rates-and-fees) |
| Wairarapa Bldg Society | A | — | — | — | [Source](https://wbs.net.nz/home-loans/) |
| First CU | A | A | A | — | [Source](https://www.firstcreditunion.co.nz/about/rates-and-fees/) |
| Police CU | A | A | A | — | [Source](https://www.policecu.org.nz/about-us/rates/) |
| UnityMoney | A | A | A | — | [Source](https://unitymoney.co.nz/about-us/interest-rates/) |
| Kainga Ora - HNZ | X | — | — | — | [Source](https://kaingaora.govt.nz/home-ownership/first-home-loan/) |
| Avanti Finance | A | A | A | — | [Source](https://www.avantifinance.co.nz/rates-fees/) |
| Basecorp Finance | A | — | — | — | [Source](https://www.basecorp.co.nz/home-loans/) |
| CFML Loans | A | — | — | — | [Source](https://www.conradfundsmanagement.co.nz/borrowers/) |
| First Mortgage Trust | A | — | — | — | [Source](https://fmt.co.nz/lending-criteria-and-rates/) |
| General Finance | A | — | — | — | [Source](https://generalfinance.co.nz/loans/) |
| Indi | A | — | — | — | [Source](https://indi.nz/) |
| Liberty Financial | A | — | — | — | [Source](https://www.libfin.co.nz/home-loans) |
| Midlands Mortgage Trust | A | — | — | — | [Source](https://investmidlands.co.nz/faqs/) |
| Paraloan | A | A | A | — | [Source](https://www.paraloan.org.nz/26/costs-of-borrowing) |
| Pepper Money | A | — | — | — | [Source](https://adviser.peppermoney.co.nz/home-loans) |
| Resimac | A | — | — | — | [Source](https://www.resimac.co.nz/home-loans/rates-all) |
| Simplicity | A | — | — | — | [Source](https://simplicity.kiwi/simplicity-first-home-loans) |
| Welcome | A | — | — | — | [Source](https://www.welcome.co.nz/borrow/) |
| Xceda Finance | A | — | — | — | [Source](https://www.xceda.co.nz/important-information/lending-interest-rates-fees-and-standard-terms) |
| AIA | A | — | — | — | [Source](https://www.asb.co.nz/lending/aia-interest-rates-fees.html) |
| Lending Crowd | — | A | — | — | [Source](https://lendingcrowd.co.nz/howitworks/ratesandfees) |
| AA Money | — | A | A | — | [Source](https://www.aamoney.co.nz/our-pricing/) |
| Admiral Finance | — | A | — | — | [Source](https://www.admiralfinance.co.nz/interest-rates-fees/) |
| Advaro Finance | — | X | — | — | [Source](https://www.speirs.co.nz/download/145525/161003%20Advaro.pdf) |
| Aotea Finance | — | A | — | — | [Source](https://aoteafinance.co.nz/costs-of-borrowing/) |
| Diners Club | — | X | — | X | [Source](https://www.thewarehousegroup.co.nz/application/files/8815/6935/9728/AR_2019_Full_Report-spreads.pdf) |
| Finance Direct | — | A | A | — | [Source](https://www.financedirect.co.nz/) |
| Finance Now | — | A | A | A | [Source](https://www.financenow.co.nz/personal-loans/) |
| Financial Holdings | — | A | A | — | [Source](https://www.fhlnz.co.nz/interestRates/) |
| Future Finance | — | A | — | — | [Source](https://www.futurefinance.co.nz/interest-rates) |
| Gem | — | A | A | A | [Source](https://www.gemfinance.co.nz/loans/personal-loans/) |
| Geneva Finance | — | A | A | — | [Source](https://www.genevafinance.co.nz/important-information) |
| Gilrose Finance | — | A | — | — | [Source](https://www.gilrose.co.nz/personal-loans/rates-and-fees) |
| Harmoney | — | A | A | — | [Source](https://www.harmoney.co.nz/) |
| Instant Finance | — | A | A | — | [Source](https://instantfinance.co.nz/key-information/rates-fees/) |
| MTF Finance | — | A | A | — | [Source](https://www.mtf.co.nz/important-information/interest-rates-and-fees) |
| Mutual Credit Finance | — | X | X | — | [Source](https://mcf.co.nz/lending) |
| NZ Loan | — | X | X | — | [Source](https://app.companiesoffice.govt.nz/co/2061561) |
| Nectar | — | A | — | — | [Source](https://nectar.co.nz/rate-and-terms/) |
| Nova Medical Finance | — | A | — | — | [Source](https://www.novamedical.co.nz/interest-rates-disclosure) |
| Pronto Finance | — | A | — | — | [Source](https://www.prontofinance.co.nz/) |
| Quick Cash Finance | — | A | — | — | [Source](https://quickcash.co.nz/) |
| Thorn Finance | — | X | X | — | [Source](https://www.thornfinance.co.nz/) |
| Toyota Financial Services | — | A | A | — | [Source](https://www.toyota.co.nz/toyota-finance-leasing/consumer-interest-rates-and-fees/) |
| CFS Finance | — | — | A | — | [Source](https://www.cfsfinance.co.nz/disclosure-info/interests/) |
| Go Car Finance | — | — | X | — | [Source](https://www.gocar.co.nz/) |
| John Deere Credit | — | — | X | — | [Source](https://www.deere.co.nz/en/finance/financing/faq/) |
| Kiwi Car Loans | — | — | X | — | [Source](https://www.kiwicarloans.co.nz/disclaimer) |
| MARAC | — | — | X | — | [Source](https://www.heartland.co.nz/about-us/news/heartland-launches-self-serve-online-car-loan-application-2) |
| NZ Vehicle Finance | — | — | A | — | [Source](https://www.nzvehiclefinance.co.nz/page/disclosure-information/) |
| Oxford Finance | — | — | A | — | [Source](https://www.oxfordfinance.co.nz/fees-and-charges-for-vehicle-and-personal-finance/) |
| Stadium Finance | — | — | A | — | [Source](https://stadium-finance.co.nz/) |
| UDC | — | — | A | — | [Source](https://www.udc.co.nz/for-individuals/cars) |
| Amex | — | — | — | A | [Source](https://www.americanexpress.com/nz/credit-cards/airnz-base-credit-card/) |
| Auck. Dist. Law Society | — | — | — | X | [Source](https://www.thelawassociation.nz/about-us/partnerships/) |
| HSBC | — | — | — | X | [Source](https://www.about.hsbc.co.nz/personal-banking-faqs) |
| NZ Medical Association | — | — | — | X | [Source](https://nzmj.org.nz/journal/vol-135-no-1559/nzmj-under-new-ownership) |
| NZICA | — | — | — | X | [Source](https://www.charteredaccountantsanz.com/member-services/member-benefits/business-offers-nz) |
| Arthur Barnett | — | — | — | X | [Source](https://www.odt.co.nz/news/dunedin/end-of-an-era-in-dunedins-retail-history-cxehgjvn) |
| Flight Centre | — | — | — | A | [Source](https://www.flightcentremastercard.co.nz/fees-and-charges/) |
| Ballantynes | — | — | — | A | [Source](https://www.ballantynes.co.nz/ballantynes-account-card.html) |
| Farmers Finance | — | — | — | A | [Source](https://www.farmersfinancecard.co.nz/) |
| Humm Group | — | — | — | A | [Source](https://www.qcard.co.nz/fees-and-charges/) |
| Retail Financial Services | — | — | — | X | [Source](https://www.farmersfinancecard.co.nz/wp-content/uploads/key-facts-sheet.pdf) |
| Smith & Caughey | — | — | — | X | [Source](https://www.linkedin.com/posts/matt-harray_smithandcaugheys-activity-7339868008334467073-DDKV) |
| GEM Visa | — | — | — | X | [Source](https://www.gemfinance.co.nz/credit-cards/gem-visa-card/) |
| NZ Post | — | — | — | X | [Source](https://www.prezzycard.co.nz/faq) |
| Air New Zealand | — | — | — | X | [Source](https://www.airnewzealand.co.nz/onesmart) |
| Christian Savings | A | — | — | — | [Source](https://www.christiansavings.co.nz/churches-and-charities/ministry-loans) |
| Gold Band Finance | — | A | A | — | [Source](https://goldbandfinance.nz/personal-lending/) |
| Bank of India | A | X | — | — | [Source](https://bankofindia.co.nz/advances) |

### Discovery beyond the old feed

The [RBNZ bank register](https://www.rbnz.govt.nz/regulation-and-supervision/cross-sector-oversight/registers-of-entities-we-regulate/registered-banks-in-new-zealand) and [NBDT register](https://www.rbnz.govt.nz/regulation-and-supervision/cross-sector-oversight/registers-of-entities-we-regulate/register-of-non-bank-deposit-takers-in-new-zealand) guide discovery, not rate extraction. Bank of India mortgages, Christian Savings ministry mortgages, Gold Band consumer/vehicle lending, and Baroda personal/vehicle loans were added beyond legacy category coverage. [Oxbury](https://oxbury.co.nz/what-we-offer/) offers agricultural/commercial finance rather than these consumer categories. Future discovery should also review non-deposit-taking lenders; this register does not certify exhaustive coverage of every NZ lender.

## Collection and publication

`direct/sources.ts` declares adapters and their permitted HTTPS URLs. Each adapter parses current HTML, tables, structured page content, or the public rate feed used by that institution. ANZ and Kiwibank validate feed identifiers against their current product pages, so old or unrelated feed entries are not published.

The fetcher limits concurrency to four, shares identical requests within one run, applies timeouts and limited retries, and refuses redirects outside the declared origin. Canonical URLs must be reviewed explicitly. It keeps TLS certificate validation enabled. Marked browser pages use Chromium locally, with an optional Browser Use Cloud fallback. Cloud starts with a New Zealand proxy; a connection or navigation timeout triggers one fresh session through Australia. An unresolved cloud security interstitial can also receive the single regional retry. Ordinary readiness failures and invalid rate data still fail collection.

Collection validates numbers, term mappings, range endpoints, source provenance, non-empty data, identifiers, and product coverage. The scheduler collects all four categories before publication. If any category is incomplete, **none of the rates or freshness timestamps are written**. Database reads also fail closed: an unreadable or invalid snapshot is not treated as an empty database. Successful unchanged collections update `last_checked`; successful changed collections save current data and the daily snapshot.

This protects against collection and preflight failures. The existing D1 writer still saves each category separately; a database failure during the write phase is not an atomic rollback across all four categories. The next successful run can repair this. D1 writes retain the existing limit of one snapshot per category per UTC date.

Merging to `main` starts deployment and collection automatically. Before any database access, the collector waits up to 15 minutes for a successful `Deploy to Cloudflare` run for its exact commit on `main`. Failed or missing deployment blocks publication, including hourly and manual runs, so the new mortgage terms cannot reach an older API schema. Production collection runs are serialized to prevent overlapping writers. Once deployed, updates continue hourly. The first production run must still confirm D1 publication and the public API response; read-only audits do not prove a production write.

Run the read-only audit from the repository root:

```bash
bun run --filter api sources:audit
```

It writes `apps/api/direct-source-report.json` and exits nonzero while coverage is incomplete. The report includes per-source status, fetched URLs, observation counts, blockers and a preview. `model: null` forbids publication; `preview` is only for review. The hourly workflow retains the report as a GitHub Actions artifact, including failed runs. Audit mode does not require Cloudflare credentials.

`bun run --filter api scrape:local` uses the same coverage gate and only writes a configured local D1 database after all categories pass. Individual scraper commands remain available and apply their category's gate. Publication requires the full register, product decisions and current live collection to pass. Verify from the deployment environment before cutover.

## Browser collection in GitHub Actions

The collector uses pinned Playwright 1.63.0 and tsx 4.23.15 under Node.js 24. Bun remains the package manager and test runner. Live testing found that remote CDP connections timed out under Bun but succeeded under Node.js, so the collection package scripts explicitly invoke Node.js. The v4 service can return HTTPS or WSS CDP endpoints; both secure schemes are accepted. Browser Use Cloud is an optional CDP host; rates are extracted with deterministic parsers, so no OpenAI key or LLM extraction is needed. Supported integration: [Browser Use Playwright documentation](https://browser-use.com/playwright), [v4 browser creation API](https://docs.browser-use.com/cloud/api-v4/browsers/create-browser-session), and [Playwright CI installation](https://playwright.dev/docs/ci).

- `RATES_BROWSER=auto` (default): local Chromium first; retry failed browser access through Cloud when `BROWSER_USE_API_KEY` is present.
- `RATES_BROWSER=local`: Chromium only; no paid service credentials required.
- `RATES_BROWSER=cloud`: Cloud only; fails immediately if the key is missing.

Cloud sessions start with NZ proxy routing, have a 15-minute expiry, and are explicitly stopped in cleanup. Retryable proxy/connection failures stop the failed session before one retry through Australia. Audit attempts record the host, proxy country, status and sanitised failure code; they never include API keys or CDP URLs. Pages normally use isolated contexts. Bank of India opts into the cloud default context so the host can complete its security interstitial; the page is closed afterward and the cloud session is always stopped. Browser access is serial and cached only for that run. ASB and BNZ mortgage pages must load their public rate feeds successfully and populate the required cells. Missing placeholders, unrelated percentages and failed feeds cannot produce a publishable model. Cross-origin main-frame redirects and interest.co.nz requests are rejected.

Both workflows install Node.js 24, Chromium and its Linux dependencies. The hourly scraper uses the same complete-coverage publication gate. The **Audit direct institution sources** workflow runs browser tests on pull requests. Pull requests from this repository also run the complete live read-only audit; forks do not receive the cloud key. Manual dispatch defaults to all sources, with optional host and institution inputs for diagnostics. Its collection step receives only the optional browser key, with no database credentials. It uploads sanitized access diagnostics and coverage results even when access fails. The full audit fails on either access or coverage errors. A selected-institution browser diagnostic reports coverage separately and never publishes.

To run locally:

```bash
cd apps/api
bunx playwright install chromium
RATES_BROWSER=local bun run sources:browser
# Isolate the newly implemented adapters:
RATES_BROWSER=local RATES_INSTITUTIONS=asb,bnz,westpac bun run sources:browser
# Includes actual Chromium tests against controlled page/feed fixtures:
RUN_BROWSER_TESTS=1 bun test test/browser-sources.test.ts
```

`BROWSER_USE_API_KEY` is configured as an encrypted repository Actions secret. Cloud access was verified from the local Node.js collector on 5 October 2026, including regional retry, all three TSB adapters and Bank of India. GitHub-hosted runner checks and live-audit artifacts are available on [PR #514](https://github.com/simonbetton/ratesapi.nz/pull/514). Local runs read the key from the environment; never put it in source, fixtures or reports.

### TSB source review

TSB mortgage extraction preserves special/standard deposit tiers and revolving credit (17 observations). Personal-loan rates are explicitly labelled for existing customers because TSB says it is not accepting new applications; overdraft default interest is excluded. Cards use the formal [Credit Mastercard disclosure](https://www.tsb.co.nz/rates-fees-agreements/credit-mastercard) for purchase interest, cash advances and annual fees (two cards). During review, the Platinum landing page displayed 1.9% under cash advances, while the formal disclosure and comparison page both showed 22.95%; the collector uses the formal disclosure. Optional card fields that this disclosure does not specify remain unknown.

## API compatibility

The four routes and nested institution/product/rate structures remain unchanged. Additive fields are optional so earlier snapshots keep their original shape:

- `sourceUrl`: exact institution page or feed used by a direct observation.
- `rateType`: `advertised`, `from`, or `range`. A range has `rate` as its lower endpoint and `rateMaximum` as its upper endpoint. Consumers must not describe the lower endpoint as a guaranteed quote.
- Mortgage and card `condition`: published eligibility, servicing-only limitations, promotion details or the source schedule date.
- Mortgage `term` also supports `By agreement` and `Fixed for 3–18 months`. `termInMonths` is null for these; they must not be labelled floating.

Card `primaryFeeNZD` is annualised, including half-yearly fees. The legacy `interestFreePeriodInMonths` name still means **days**. An unknown optional card field is `null`, not zero. Verified zero-rate offers remain zero. Institution IDs are retained; product and rate IDs can change when an explicitly reviewed product name or condition changes. History is not rewritten to manufacture direct provenance.

The explorer links direct rows to their source and renders published ranges and “From” rates. Charts, sorting and summary statistics use the lower endpoint; the page discloses this. Rows without `sourceUrl` retain legacy treatment and attribution.

## Adding or repairing a source

1. Confirm the institution, product category and official rate URL. Distinguish lending rates from deposit returns, default interest, examples, broker comparisons and expired promotions.
2. Add a deterministic adapter in `apps/api/bin/direct`. Declare every first-party URL it needs. Use live extraction rather than hardcoded numerical rates.
3. Capture a minimal, sanitised first-party fixture and add behaviour checks in `direct-sources.test.ts`. Include representative values and failure cases; do not update expectations just to make changed markup pass.
4. Review original products, current products, eligibility, effective dates, aliases and exclusions in `institutions.json`. A `pending` entry cannot silently disappear.
5. Run `bun run check`, the source audit, and appropriate builds. Verify from the CI environment as well as locally before enabling publication.

The committed fixtures are test input only and are never a runtime fallback. See their [capture notes](../apps/api/test/fixtures/direct/README.md).
