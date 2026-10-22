# Findings from the actual CSV archive

Full-table audit of `/home/arash/Downloads/starcoach-dataset-v16-cap300-csv.zip`, performed 22 October 2026. These counts come from parsing the ZIP contents, not just the challenge text. Reproduce with `python profile_dataset.py` from this directory. It writes `dataset-audit.json`, `demo-candidates.json`, and console output. It reads the archive without extracting or modifying it. The audit uses only Python's standard library.

## Coverage that affects product decisions

| Measurement | Actual count | Consequence |
|---|---:|---|
| Shops | 6,476 | Full shop catalogue is small enough to import directly |
| Products | 225,903 | Search in a database; do not send the catalogue to an LLM |
| Offers | 331,506 | Use explicit product/shop joins |
| Shops represented in offers | 3,792 | 2,684 shops have no offer rows; these cannot be claimed as sellers of a specific model |
| Products represented in offers | 225,903 | Every supplied product has at least one offer, including offers with unknown price |
| Products with ≥2 distinct sellers | 35,254 | Only about 15.6% support a multi-store comparison within this export |
| Products with ≥3 distinct sellers | 16,218 | Choose demonstration models deliberately |
| Missing offer prices | 15,083 | About 4.55%; never parse null as free/zero |
| Nonpositive present prices | 0 | Separate absence from price validity |
| Malformed nonmissing price strings | 0 | This check does not establish market plausibility |
| Additional offer rows for an existing product/shop pair | 20,315 | Offer count is not seller count; retain distinct offer IDs |
| Maximum distinct products at one shop | 300 | The advertised product cap holds |
| Maximum offer rows at one shop | 1,346 | More than 300 offer rows does not violate the distinct-product cap |
| Duplicate primary IDs | 0 in all three tables | Suitable for direct primary keys |
| Broken offer foreign keys | 0 | Joins can be checked strictly |

Do not add `UNIQUE(product_id, shop_id)`. Multiple rows may contain different seller details or variants. The audit establishes multiplicity; it does not prove the business meaning of every repeated pair. Compare seller titles, descriptions and warranty before merging anything.

## Payment and hours are sparse, and semantics matter

- 266 shops have a nonempty payment-options array, about 4.11%.
- Only **82 shops** have at least one option whose `channel` is explicitly `in_person`, about 1.27% of all shops. This is a dataset-evidence count, not the true number of Tehran shops supporting installments.
- Payment-option entries include `provider_name`, `channel`, `min_price_toman`, `max_price_toman` and `category_names`. Some channels are `unknown`; some bounds are null or zero. Count distinct shops, not provider entries.
- A TorobPay entry with unknown channel must not become confirmed in-person TorobPay acceptance. Respect any category restrictions. Zero/contradictory bounds need an explicit interpretation rather than silently filtering everything out or treating every bound as unlimited.
- 4,473 shops have a nonempty `weekly_hours` object, about 69.1%. Across day entries, the audit found 27,270 `declared`, 4,006 `closed` and 35 `unsupported` statuses. A nonempty weekly object is not a promise of seven usable days or current opening.
- One strong follow-up scenario is asking for missing hours, but its answer must stay labelled simulated in the demo.

## Product content

| Nonempty field | Products | Coverage |
|---|---:|---:|
| Category | 225,903 | 100% |
| Persian title | 225,901 | ~100% |
| Image URLs | 224,684 | ~99.5% |
| Specifications | 144,599 | ~64.0% |
| Brand | 57,634 | ~25.5% |
| Model field | 4,056 | ~1.8% |

The standalone model field is too sparse to power model search alone. Titles and seller text matter. Nonempty specs/images are not independently validated here: specs may be incomplete, and URL presence does not establish image reachability. Two products lack a Persian title; give them a transparent fallback from supported seller text or a placeholder.

The data is not predominantly phones or fashion. High-volume categories include electrical cables, CCTV, lighting and industrial products. For a general audience demo, headphones and mobile phones are easier to explain while still having enough real comparison candidates:

| Category | Products | Products with ≥2 distinct sellers | Products with ≥3 distinct sellers |
|---|---:|---:|---:|
| Headphones/headsets/earphones | 1,339 | 348 | 192 |
| Mobile phones | 814 | 341 | 191 |
| CCTV cameras | 3,467 | 747 | 427 |

Choose headphones as the initial guided journey and phones as the direct-model journey. This is a recommendation based on data and presentation clarity, not an organizer restriction.

## Location, external identity and addresses

All 6,476 shops have parseable coordinates within the broad Tehran bounding box checked by the audit. Actual coordinate ranges are approximately latitude 35.6403–35.8126, longitude 51.3053–51.5093. This bounding-box check does not validate an individual shop's location.

6,475 have addresses and location labels. A simple text pattern finds 3,671 addresses mentioning a mall/complex/shopping centre and 6,122 mentioning a floor, unit **or street/building number**. Those are rough pattern counts, not validated indoor-location coverage. Do not call every plaque number a unit number.

90 shops have website URLs; 22 have Instagram; 112 have either. This matches the supplied explanation of the real-name subset, but does not independently establish which business identities are real. With most names synthetic, automatically matching arbitrary shops to Google by name is unreliable. Prefer supplied URLs or carefully checked address/coordinate evidence.

The CSV export has no shop-photo, shop-description, licence or membership-history columns despite the broader conceptual brief mentioning them. `supports_fast_delivery` is nonempty for 1,601 shops, but absence is unknown and the field is low priority for an in-person assistant.

## Price timestamps

330,737 offers have `last_price_changed_at`; 769 do not. The timestamp range is **3 December 2020 to 13 October 2026**. This is consistent with an export containing historical price-change events and is not proof that the oldest prices are wrong. The ZIP entries and README identify a 14 October 2026 export.

Show the actual event semantics: «آخرین تغییر قیمت ثبت‌شده». Do not relabel that as «آخرین بررسی موجودی» or claim all records were refreshed last week. The brief's “last week” refers to the challenge's snapshot context, not a uniform per-row verification time.

## Main demonstration candidate

**Anker Soundcore R50i A3949** (`product_92ac53fa75e18e8e73f20b56`) has specifications, 44 offer rows and **30 distinct shops**. Exactly two of those shops have explicit in-person payment entries and a positive recorded price in this candidate scan.

| Attribute | Lower recorded price | Backup candidate |
|---|---|---|
| Shop ID | `shop_13336f1a0d2ec0b16bbd60aa` | `shop_60e835a590a4a652ce0ad6d9` |
| Dataset name | مهریسا نوین | آوان آران |
| Offer ID | `offer_6321f8a6d25fcac716b4fd8a` | `offer_3c1ad9b2b3081b07991d5872` |
| Recorded price | 3,150,000 toman | 3,850,000 toman |
| Price-change date | 23 September 2026 | 5 October 2026 |
| Area label | شیخ هادی | شیخ هادی |
| Explicit in-person providers | TorobPay, SnappPay, DigiPay, Tara | TorobPay |
| Hours object present | Yes | No |
| Seller title | ایرپاد انکر r50i | هدفون بلوتوثی انکر Soundcore R50i مدل A3949 |
| Recorded warranty | 18 months, مهندسی ایستا طیف گستر | 6 months, شرکتی |

A targeted reread confirmed these seller titles and warranties. The cheaper offer's title is less specific and the warranties differ, so the app must surface the difference and confirm the exact requested variant. Do not call the price difference a like-for-like saving. The cheaper shop declares Sunday–Thursday 09:30–20:30 and Friday/Saturday closed in this snapshot; retain those supplied declarations even if a schedule seems unusual. Its extra 00:00–00:00 shift entries require deliberate placeholder handling, not a claim that the shop is open 24 hours.

Suggested demonstration brief: someone near the Jomhouri/Hafez area wants earphones, has a **4.2-million-toman budget**, and requires **in-person TorobPay**. These user preferences are proposed demo inputs, not dataset facts. Confirm exact seller-title/variant comparability before finalizing the script.

Flow: clarify the need → compare supported models → choose R50i → show eligible stores → lower-price seller does not answer in the explicit simulator → retain the same model/provider/budget and propose the second shop → obtain simulated hours/stock response → produce a labelled simulated visit card. Do not claim the two shops' recorded cash prices establish their installment total price. Terms remain unknown unless explicitly covered by the simulated reply.

The backup has no supplied hours, so an “open on arrival” hard filter must initially treat it as unknown, not eligible-with-confirmed-hours. Let the user choose verification of unknown-hour options; after the labelled scenario response, show simulated visit feasibility. If all strict conditions cannot be met, explain that rather than silently weakening the filter.

Other useful candidates in `demo-candidates.json`: R50i NC A3959 (17 distinct shops but only one explicit in-person payment shop in the scan), and Samsung S25 FE 256/8 (34 distinct shops but no explicit in-person payment shop in the scan). Use the phone as a cash/direct-search scenario, not a fabricated installment example.

## Audit limitations

The audit verifies counts, joins, basic value coverage, distinct seller multiplicity, timestamp range, payment channel structure and broad coordinate bounds. It does not validate live inventory/prices, real-world store identity, every specification, hours correctness, payment eligibility, product authenticity, links, or final UX. `demo-candidates.json` is a shortlist for inspection, not a production ranking engine.
