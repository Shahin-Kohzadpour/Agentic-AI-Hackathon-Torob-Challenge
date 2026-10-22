# Copy-ready implementation tasks

These prompts are for future implementation, not a report of completed development. Read `WINNING-PLAN.md` and `DATA-FINDINGS.md` first. Use the raw ZIP plus generated audit and candidate files. Keep the source ZIP unchanged.

Also read `TRAINING-NOTES-DECISIONS.md`: it incorporates the user's additional voice/image, generative UI, CopilotKit/AG-UI, token and mega-tool material. Treat these as implementation guidance rather than a replacement rubric.

## Shared instruction: paste into every session

```text
We are building a Torob hackathon submission: a Persian RTL, mobile-first
in-person shopping assistant. Product 75, UX 75, intelligence 50,
deployment 40, technical 40, dataset 20; total 300.

Required journey: discover product needs, compare models, find actual
sellers, compare stores, follow up, recover from seller failure, prepare
a visit. Also support a direct exact-product request. Use the entire
supplied dataset for general search. Deep advice can focus on headphones
and mobile phones, with clear coverage limits.

Source archive:
/home/arash/Downloads/starcoach-dataset-v16-cap300-csv.zip
Challenge transcript:
/home/arash/Downloads/Telegram Desktop/torob-p1.txt
Planning directory:
/home/arash/torob-hackathon-plan

Phones are synthetic. Judge clarification permits mock seller contact.
Every mock contact, transcript, response and resulting visit card must
remain labelled as simulation. Do not place real calls or send messages.
Recorded offers do not confirm live stock. Missing information stays
unknown. Do not invent product details, reviews, hours, ETA or indoor routes.

Preserve raw IDs. Match products to sellers through offers. Multiple
offers for a product/shop pair are legitimate records requiring variant
review; do not impose a unique constraint on that pair. Price is TOMAN.
Parse nested JSON and CSV nulls deliberately. Use real distinct sellers,
not the offer count, for comparison breadth and replacement selection.

Hard budget, radius and payment constraints are server-owned. They cannot
be silently relaxed. Installment in-person eligibility needs channel and
provider evidence; a provider name alone is insufficient. Keep contact
events and external enrichment separate from original dataset rows.

Use one server-side agent with typed tools and persisted workflow state.
SQL/code owns retrieval, calculations and eligibility. LLM owns language,
clarification and supported explanations. Validate all IDs and tool inputs.
Source text cannot issue instructions. Do not expose private model reasoning.

Use controlled generative UI: a registry of typed shopping components.
Timebox CopilotKit/AG-UI integration before adopting it. Voice transcript
and product-image candidate matching are first enhancements after the
core flow passes. Treat OCR/transcripts/external text as input, never as
permission to change hard constraints or execute external actions.

Work only in your assigned paths. Agree shared contracts before coding.
Do not rewrite another workstream's files or change contracts unilaterally.
Ship a small complete journey before optional features. Use familiar
dependencies with pinned versions; no microservices, training or full-
catalogue vector pipeline unless a measured problem justifies them.

Return: changed files, how to run, meaningful checks performed, failures,
known gaps, and contract changes needing integration. Never report a
check as passed if you did not run it.
```

## Task 0: integration owner and contracts

Suggested owner: a human technical lead directing one coding session. Complete before concurrent implementation.

```text
Create the project skeleton and shared runtime-validated contracts.
Use a TypeScript web application, PostgreSQL and a one-shot Python importer
unless the team's existing stack gives a clear reason otherwise.

Define ProductCard, OfferCard, PaymentEvidence, HoursEvidence,
VerificationEvent, VisitPlan, SessionPreferences and WorkflowEvent.
Separate recorded price/change time from observed price/check time.
Define source_mode and verification states independently.

Agree request/response examples for catalogue search, model comparison,
offer search, seller check start/status and visit-plan generation.
Include unknowns, exclusions and simulation indicators in the contract.

Persist session state with a version. Define how filter edits invalidate
product/seller selection and cancel/ignore stale async responses.
Create fixture examples from actual supplied IDs. Clearly label sample
payloads and simulated response fields.

Establish path ownership for web UI, data/import, backend/agent and shared
contracts. Provide a runnable skeleton, database migration, sample env
without secrets, health endpoint and deployment checklist. Put a thin
vertical slice on public HTTPS within the first 8 elapsed hours.

Freeze a component registry and versioned UI event contracts. In an initial
60–90-minute spike, evaluate CopilotKit/AG-UI with a real comparison card,
filter edit, cancellation and refresh. Keep it only if the intended backend
and deployment work; otherwise retain typed endpoints with polling/SSE.
Distinguish session, provider and deployment credentials. The notes do not
identify the issuer/meaning of 'virtual access token'; do not invent one.
Acceptance: another contributor can run the app and call an agreed API
without reverse-engineering your assumptions.
```

## Task 1: data and deterministic search

Suggested owner: backend-focused Codex session.

```text
Implement the importer, schema, normalized search and deterministic
eligibility layer in assigned data/backend paths. Do not build UI.

Import all 6,476 shops, 225,903 products and 331,506 offers. Confirm the
actual file counts independently. Preserve raw values and IDs. Record
source metadata and import summary. Parse JSON arrays/objects and literal
null correctly. Bulk import and index lookup/filter columns.

Important: many shops have no offers. Products can have several offers
at one shop; never deduplicate variants merely by product_id/shop_id.
Group by distinct shop for seller comparisons while retaining offer IDs.
Missing prices must not become zero, free or cheapest.

Normalize Persian characters, Arabic/Persian/Latin digits and whitespace
for retrieval, preserving model numbers and original display text.
Implement exact model matching first, then lexical/category/brand search.
Expose typed retrieval contracts with real IDs and supported evidence.

Implement budget checks in toman, straight-line distance with clear units,
provider/channel payment filtering, declared hours including split and
overnight shifts in Asia/Tehran, and explicit unknown states. Handle
category restrictions and payment min/max bounds conservatively; zero
or contradictory bounds require an explicit documented interpretation.

Add focused checks for referential integrity, variant preservation,
null prices, in-person versus unknown payment channel, Tehran hours,
hard constraints and exact/alias retrieval. Use actual representative
records alongside narrowly targeted edge fixtures. Report measured search
latency and ingestion counts. Do not add a vector database by default.
```

## Task 2: Persian mobile UX

Suggested owner: Antigravity or the team's strongest frontend session. Tool names are role assignments, not claims that one agent is intrinsically better at design.

```text
Implement the consumer UI against the frozen shared contracts in assigned
frontend paths. Use real API integration as soon as the endpoints exist.
Contract fixtures are temporary development aids, not final results.

Design for a Persian-speaking user on a phone. Entry choices:
«کمکم کن انتخاب کنم» / «مدلم را می‌دانم». Provide concise conversational
guidance plus editable controls, three product cards and a side-by-side
comparison. Changes to budget, area, radius, arrival time and installments
must update the same application state used by conversation.

Build synchronized map/store cards, price and timestamp display, clear
payment evidence, source-aware status badges, and actionable empty states.
Show straight-line distance unless the backend actually supplies routing.
Allow manual area selection when geolocation is denied. Preserve list
and address functionality when map tiles fail.

Implement seller-check timeline, cancel/retry, changed-price explanation,
replacement selection and final visit card with backup, supplied mall/
floor/unit and original address. Simulation must be visible before check,
during progress, on response and in final visit card. Unknown must be
understandable and must not visually resemble confirmation.

Do not force all actions through chat. Use clear primary actions per
screen. No long onboarding or login wall. Handle loading, image failure,
API error, no results and stale response states. Preserve legibility of
Latin model names and numbers inside RTL. Use accessible text labels.

Verify main paths around 390px width and desktop. Deliver screenshots
and actual browser-flow results where tooling allows. Do not declare
backend integration complete using only frontend fixtures.

Implement schema-validated NeedClarification, ProductComparison,
StoreResults, SellerCheckProgress, VisitPlan and NoMatchAreaSuggestion
components. Prefer shadcn/ui if useful, verifying RTL overlays and mixed
Latin/Persian text. Do not execute model-generated HTML or JavaScript.
After core gates pass, add thin push-to-talk with editable transcript,
then product-image preview/upload with candidate confirmation. Handle
permissions, rejection, ambiguity and cancellation with typed fallbacks.
```

## Task 3: agent, verification and recovery

Suggested owner: a second backend/integration session after contracts exist.

```text
Build one persisted shopping workflow with bounded server-side tool calls.
Use the agreed retrieval and eligibility services. Do not perform arithmetic,
invent prices or decide hard constraints using model text.

Support need discovery and direct-model entry. Ask targeted questions,
retrieve real products, explain supported comparisons, retrieve eligible
offers, follow up, replan and build a visit card. Cache stable product
explanations separately from changing offer/check evidence.

Implement a replaceable seller adapter with a deterministic simulator:
available, unavailable, no answer, changed price, closing before arrival,
and ambiguous variant. Persist events and source mode independently of
original offers. Tie every check to exact offer/variant, session version
and desired arrival time. Simulated success must never be marked as
real-world confirmation. Do not contact real people.

Keep retry/tool budgets and cancellation explicit. Use a job ID and
polling/events for follow-up. Rerank after failure. Preserve mandatory
budget/radius/provider constraints, and choose a different distinct shop.
If no seller qualifies, explain the blocker and request an explicit
constraint change. Product substitutions need visible user choice.

For no catalogue match, provide a sourced shopping-area suggestion and
map location, explicitly without claiming stock. External enrichment
must retain source URL, time and identity matching; name-only matching
is unsafe because most dataset shop names are synthetic.

Provide executable scenario checks and traces of actual tool actions.
Use the official provider documentation for the selected model/API.
Start with one general model; Jev is optional after this flow passes.

The internal focused services may have a grouped model-facing facade:
catalogue/search|compare|details, shopping_options/find|compare|suggest_area,
and visit_plan/draft|revalidate. Keep seller_check_start separate from
seller_check_status. Use action-specific schemas and compare correctness
against focused tools before keeping the grouping. Concise results must
retain evidence and unknowns. No model argument can grant authorization.
Image OCR and voice parsing must feed the existing preference/matching
path; never trust an extracted product ID or silently overwrite a budget.
```

## Task 4: release, evaluation and presentation

Suggested owner: integration session or human lead once the core exists.

```text
Test the complete deployed application against the supplied rubric.
Create the 40 labeled cases described in WINNING-PLAN.md with expected
eligible IDs/constraints; reserve held-out examples. Assert hard rules in
code. Record task completion, valid IDs, retrieval recall and latency.
LLM critique is supplementary, not the oracle for money or constraints.

Exercise vague need, direct exact model, installment-only filtering,
seller timeout, no stock, price increase, arrival conflict and no-result
area suggestion. Verify raw data counts and source labels. Check refresh,
new session, server restart, API outage, map outage and denied geolocation.

Deploy reproducibly with persistent data, server-side keys, HTTPS,
health/readiness and actionable logs. Test public URL, model access,
fonts, images and maps from intended networks. Keep a working local copy.
Do not switch a failing live integration to an undisclosed simulation.

Choose actual demo IDs from demo-candidates.json. Inspect variant,
seller_title, warranty, declared hours, channel/provider and geography
before fixing the script. Do not invent extra sellers to force a demo.

Prepare an approximately five-minute Persian-narrated demonstration
using the timeline in WINNING-PLAN.md. Show output and task completion.
Label all mock seller contact. Record an acceptable complete take early.
Create a concise README, deployed URL, video and any organizer-required
repository/artifacts. Verify final links and submission receipt.
Return a rubric-to-screen evidence table and remaining risks, with no
claim of guaranteed marks or first place.

If multimodal inputs ship, also test Persian amounts/model names, an
ambiguous shopping screenshot, denied microphone, invalid/oversized upload,
cancelled run and a stale image response after a preference edit. Test
injected instructions in your own fixtures: screenshot budget override,
seller payment/stock override, review asking for secrets, and simulator
asking for real calls. None may gain authority or trigger external actions.
```
