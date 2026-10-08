# Direct source fixtures

Captured from institution websites and their public rate feeds on 4–5 October 2026. `responses.json` maps each requested HTTPS URL to the source content consumed by its adapter. These values are test snapshots, not a statement of today's rates.

Captures are reduced to relevant tables, paragraphs, rate feed entries, or structured page components. Styles, images, tracking scripts, transient bootstrap attributes and unrelated components are removed. Some structural navigation and surrounding prose remain where needed to preserve real selector and text boundaries. Reduction was checked against every parser: outputs and discovered document URLs are unchanged. ANZ's embedded page model retains the rate references and card-fee components; Kiwibank retains the rate placeholders and corresponding feed objects. Source text and values used in assertions are preserved. Fixtures contain no rates copied from comparison sites.

Tests check both successful extraction and rejection of missing, disabled, ambiguous, malformed or incomplete inputs. Review source meaning before changing fixtures: a deposit rate, default interest rate, comparison rate, illustrative calculator value, or expired promotion is not interchangeable with the product's advertised lending rate.

Production collectors never import this directory and never fall back to these fixtures.

ASB, BNZ and Westpac captures were taken from rendered Chromium DOM on 5 October. Public bootstrap API-key attributes, scripts and page-model attributes are stripped. Tests retain populated cells, product labels and eligibility text; runtime collection requires successful feed responses before accepting these pages.

TSB captures were taken through Browser Use Cloud on 5 October. Fixtures retain the formal mortgage, personal-loan, overdraft and Credit Mastercard tables. Default-interest rows and additional-card fees remain in the inputs to verify that they are not mistaken for ordinary lending rates or primary annual fees. Personal-loan closure text is preserved. The debit-card exclusion was checked against TSB’s own debit-card page.

Expanded captures include current linked disclosure text for Basecorp, Liberty, CFML, Xceda and Gold Band. `liberty-disclosure.pdf` is a small real PDF used to verify byte-level extraction and rejection of non-PDF responses. Bank of India fixtures retain its currently published schedule date; Christian Savings retains both minimum-deposit percentages and loan rates to guard against confusing them.

`wbs-home-loans.html` was captured from https://wbs.net.nz/home-loans/ on 8 October 2026. It preserves the five published mortgage rows, including the newly added 36-month term that invalidated the former exact four-row assumption.
