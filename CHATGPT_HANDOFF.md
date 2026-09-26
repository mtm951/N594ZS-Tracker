# N594ZS Tracker — ChatGPT Handoff

This file exists to preserve development continuity across ChatGPT conversations.  
**Do not treat chat memory as the canonical source. Inspect the current repo and cloud state before making changes.**

## Project identity

- App: N594ZS Tracker
- Aircraft: N594ZS, Kitfox Model 4-1050 / Classic IV, serial 1442
- GitHub repo: `mtm951/N594ZS-Tracker`
- Live app: `https://mtm951.github.io/N594ZS-Tracker/`
- Main branch: `main`
- Supabase project ref: `fbjyhodrddsvuesafxce`
- Supabase workspace id: `1ead2eeb-4aeb-443f-bdf7-ad7a1c901bca`
- Canonical cloud records: `public.tracker_records`
- Cloud snapshots: `public.tracker_snapshots`
- Current release: **v5.19.33** (complete cloud pagination; PR #11 merged September 26). Confirm current main-branch Pages Actions before reporting deployment.

## v5.19.33 complete cloud pagination / false integrity alerts (September 26)

- Owner screenshot displayed v5.19.32 with **63 broken links / 75 review items** despite authoritative Supabase showing **1,040 active cloud records and ZERO actual missing purchase/part/equipment/invoice references** at time of audit. Root cause: `app-17-record-sync.js` requested `tracker_records` with an unpaginated Supabase/PostgREST select, silently capped at 1,000; browser falsely marked incomplete dataset Synced. The screenshot's earlier 384 purchases / 100 invoice count was also incomplete vs cloud 414 purchases / 109 invoices at that point. **Never advise Repair Safe Links on a truncated or out-of-sync browser dataset.**
- Before any code changes, created cloud safety snapshot `b605653a-c281-49aa-887f-5ab30655be55` containing all 1,040 active records, no production aircraft record modifications. PR #11 merge commit `b52bea26026759bd0552df03fe166531d974e46f`; branch `cloud-pagination-v5.19.33`; branch CI `36266297187` and PR CI `36266352537` success.
- In `app-17-record-sync.js`, new `cloudReadAllTrackerRecords` explicitly pages 500 records at a time, deterministic sort by record type/id, checks exact count and uniqueness, retries if the cloud data changes while loading, and FAILS CLOSED (never overwrites local DB or labels it Synced) on missing or truncated pages. Applied to initial cloud load, post-migration load, and record-version scans. `app-45-reliability.js` now uses full paged cloud reads for field-level conflict verification, including deleted records.
- `tests/cloud-record-pagination.test.mjs` executes actual production loader with 1,040 active + 4 deleted synthetic records under simulated server 1,000-row cap, verifies complete purchase/part/invoice presence, all 1,044 remote versions and conflict rows, and tests incomplete-page fail-closed behavior with zero cloud writes. Bumped version and service-worker shell to v5.19.33.
- Owner acceptance: Close Data Integrity modal, check current sync badge (should be Synced, NOT Conflict/Sync Pending), refresh to v5.19.33, allow full load to finish, reopen Data Integrity. Broken links should drop from 63 to zero if cloud remains unchanged. A residual smaller number of **review-only** warnings is expected for historical installed purchase lines without linked parts; 27 such unlinked lines were found in the canonical cloud. Do not mass-create inventory or mark stock from historical purchases without owner confirmation. Any remaining red broken links must be reviewed against current cloud data, not automatically repaired.

## v5.19.32 filtered Purchases dashboard (September 26)

- PR #10 merged at main `cbf576dcf8b6968236d364112cd36d566784c6bb`; branch `purchase-filtered-metrics-v5.19.32`. CI branch run `36264097570` and PR run `36265013635` completed success. Check main Pages deployment independently.
- User requested the Purchases headline cards **follow current vendor and other filters**. Added six live cards: line count, invoice count, vendor count, Actual Invoiced Spend, Disposition Unknown, Item Subtotal. Filters include vendor, search, disposition, system and purchase-date From/To. UI filters survive page re-renders; Show All clears them.
- Main implementation: `app-25-multivendor.js` owns `purchaseFilteredFinancialSummary`, `purchaseCurrentSummary`, filter controls and tile updates. `app-46-purchase-metric-drilldowns.js` opens scoped clickable cards and invoice/line/vendor details, preserving snapshot of current UI scope. `app-23-wb-purchases.js` aggregates part-history groups from matching rows only and restricts clicked part history to matching rows. `tests/purchase-filtered-metrics.test.mjs` runs real summary and drilldown modules in disposable VM with mixed Amazon/personal invoices, gift card/rewards/refunds, item allocation, unpriced lines, source-only invoices, and combined filters.
- Accounting semantics: gift cards and rewards used as payment are added back to checkout Grand Total, recorded refunds deducted. For mixed invoices, known non-aircraft lines excluded from aircraft scope by ratio; search/system/disposition allocate invoice-backed costs proportionally by matching item gross line costs. A note exposes estimated vendor acknowledgments, missing/unpriced line cost, mixed/partial allocations. No live Supabase records were modified as part of this UI release.
- Regression tests pass. Owner device acceptance / visual inspection still required: select Amazon and another vendor, then combine date + search; confirm all six cards and clickable drilldowns agree, and compare mixed-invoice allocations. Do not assume this new release is installed on phone until app version reads v5.19.32 and Synced.

## v5.19.31 canonical Readiness stage selector in Project editor (September 25)

- User reported that the Project editor's old Due / trigger dropdown (e.g. Before flight) should INTERFACE with the ACTUAL Before Flight, Before Engine Start, and other readiness lists. Root cause: app-52-project-editor-polish.js supplied free-text preset strings independently of app-20-workflow.js's real WORKFLOW_PHASES and saved project.phase. Read-only production inspection confirmed the exact user's Resolve airspeed indicator issue Project (id 104) had trigger Before flight but phase later. Thus the text did not place the Project in the real Before Flight Readiness stage.
- FIX IN ORIGINAL MODULES ONLY: app-52 now MOVES the EXISTING #prPhase select generated by app-20 into the old Due/trigger location, relabelled Readiness list / when required. Its choices are directly populated by canonical WORKFLOW_PHASES (Installation / Build; Before Engine Start; Engine Run / Ground Test; Before Flight; Return-to-Service Closeout; Later / Optional). Removed the separate static trigger preset menu and duplicate phase control. The selected stage actually determines which Readiness list includes this Project. An optional Additional due / trigger note preserves genuinely custom legacy trigger text; selection without a custom note also populates the historic trigger field with phase-compatible text for older consumers.
- Existing stage-like legacy trigger strings are recognized case-insensitively. If the stored text says Before flight but the ACTUAL saved phase is Later / Optional, a warning explains the conflict and instructs the user to choose the correct stage and save. We do NOT automatically bulk-reassign old projects or edit the live ASI record. The user's explicit choice fixes that Project. Existing custom notes remain intact and do not override phase selection. Merely opening the editor never mutates cloud records.
- app-06-projects.js now writes trigger AND stage together in the original trackerStore Project write, so the first persisted revision cannot pair a new Before Flight trigger with an old phase. app-20 continues saving its other workflow fields via existing compatibility wrapper. The Project detail's Workflow card now displays a clickable Readiness list that calls the ACTUAL openPhaseProjects() view; no disconnected text link or new storage table.
- The Readiness phase selector is for PROJECT scheduling and gate organization. It does NOT automatically attach a separate POH or Rotax procedural checklist, mark any checklist item done, or itself establish airworthiness; existing Checklists tab retains independent records and manufacturer references.
- Safety: recovery branch validated-v5.19.30-before-readiness-trigger-2026-09-25 at main commit 3d6ebd7cea5b0dde59b779133a8f35182fbb66a2; pre-release cloud snapshot 870faa81-959d-4bc1-a8f8-354c11b26afa captured 927 active tracker records. No live Project, Part, Order or Checklist records were edited during development. New tests/readiness-trigger-integration.test.mjs loads production workflow, project editor, core project saver and trackerStore against disposable VM data to prove actual list membership, mismatch warning, custom note preservation, new-project flow, same-write stage/trigger persistence, and no automatic migration. Full CI suite runs on readiness-* branches.
- Owner acceptance after deployment: refresh desktop and phone to v5.19.31, open Resolve airspeed indicator issue, observe warning that its note says Before flight while it sits under Later/Optional; choose Before Flight from the new Readiness list dropdown, save and verify the Project appears under Readiness → Before Flight and stays there on both devices. Other historical projects are not silently reassigned.
## v5.19.30 Open orders by default and non-destructive History (September 24)

- User confirmed that completed order #18374415 should remain searchable history, not clutter the active Orders queue. This is a presentation-only change to the ORIGINAL `app-05-views.js`. The Orders view opens with `Open — active orders` selected. Other views: `History — received / cancelled`, `All orders`, and the original individual statuses. The chosen filter persists across Orders page rerenders within the same open app session; on next full load it defaults to Open again.
- A line is shown in Open if `!isClosedOrder(o)` and in History if `isClosedOrder(o)`. Existing order records, receipt events, inventory and total spending are UNCHANGED; the History tab is an inclusive status filter, **not deletion, archival, or a second copy**. Search, project, system and sortable columns still operate with the selected filter. Received and Cancelled lines from a group remain separately inspectable in History; if some order lines are active, only those active lines appear in Open.
- Corrected the order group banner's `units remaining` calculation to exclude closed lines, especially cancelled lines that otherwise misleadingly reported unreceived quantities as still due. This is display-only and does not adjust actual ordered, received or inventory quantities.
- Pre-change GitHub recovery branch `validated-v5.19.29-before-order-history-2026-09-24` points to main `53eea7a3b2d2263d720fd7fb1c869ddd26b978e4`. No production cloud SQL writes or active aircraft data changes were required. `tests/order-multi-project-links.test.mjs` now checks default Open, History/All/individual statuses, status persistence during rerender, retention of completed and cancelled group lines, no filter data mutations, and that receiving the remaining test LEDs moves the line from Open to History with only one inventory credit. Full regression workflow also runs on `orders-*` branches. Phone and desktop visual confirmation are still owner acceptance tasks.

## v5.19.29 simplified blockers and real live order search (September 24)

- Owner clarified the actual intended model after real device testing: **a Project may have MULTIPLE INDEPENDENT blockers; an Order may block MULTIPLE Projects**. The previous ALL/ANY multi-order form, global native selector, and "Search other orders" text filter were unintuitive. This release simplifies the ORIGINAL \`app-67-linked-order-blockers.js\` rather than stacking override modules or changing the established atomic receipt engine.
- **Normal form:** Project detail now has a unified **Project Blockers** card with **+ Add Blocker**. One new blocker references exactly one explicitly selected Order and a positive required quantity, OR is a manual issue without any Order. A Project may have any number of distinct waiting blockers; the same Order can be referenced by independent blockers on the same Project or other Projects without copying its inventory/cost/order row. The old single free-text blocker note, if any, appears inside the unified card instead of presenting contradictory "No blocker recorded" when active blockers exist; older text notes are never silently deleted.
- **Actual autocomplete:** New Order blocker search is one search input with a VISIBLE live item-first dropdown as the user types, no giant native global select. A blank search suggests this Project's Orders. Typing searches matching existing Order item, vendor, tracking/reference and associated Project names across the workspace; own Project Orders rank first. Suggestions show actual Order item, received/ordered quantities, originating Project as secondary context, and tracking or unique record ID; user must explicitly CLICK a suggestion or select it with the keyboard (ArrowUp/Down, Enter, Escape). A raw typed item name is not enough to save. Suggestions are positioned directly UNDER the input on mobile. No irrelevant Order is auto-selected; choosing an Order autofills the blocker title only if no custom title was entered, and the default required quantity is that Order's qty (editable).
- **Manual issues:** User can pick "Other issue — resolve manually." These are stored in the same \`project.orderBlockers\` history array with \`kind:'manual'\` and no dependencies; only a user-confirmed "Mark resolved" changes their status, creates a dated Project Updates event and releases the Project if no other active holding blockers or legacy note remain. Manual blockers NEVER credit inventory or respond to Order receipts.
- **Old data preserved:** Existing v5.19.25 single-order blockers work unchanged. Older v5.19.26/27/28 combined ALL/ANY entries with multiple Orders remain readable, auto-resolve under their original rules, and show the advanced multi-order editor ONLY when explicitly editing an existing combined blocker; no data is silently converted. An exact duplicate waiting blocker on the same project is rejected; the same generic description may be used for DIFFERENT Orders. Explicit EarthX one-click already-received migration remains available and never credits stock twice.
- **Two-way clarity:** Opening an Order shows a derived "Projects blocked by this order" card listing all dependent Projects (including those whose cost is attributed elsewhere). This is a read-only view of Project blocker references, not a mutation of \`order.projectId\` or \`linkedProjectIds\`. Existing order multi-project association (Add/Manage) stays as-is for cost attribution and project order lists.
- **Safety and validation:** Pre-change known-good GitHub recovery branch \`validated-v5.19.28-before-simple-blockers-2026-09-24\` points to main commit \`6b904cc6d4ffc5cd558ece8057e7ceba425652c9\`. Production cloud safety snapshot \`6b5aa2b9-bb90-4532-92c6-eea7c58edbb4\` captured 924 active records before editing code. **No active production aircraft records were modified during development.** Tests in \`tests/order-linked-blockers.test.mjs\` now verify visible own/global live suggestions, explicit choice/invalidated stale text, two independent blockers with identical generic names on different Orders, manual blocker release with zero stock, legacy grouped edit, shared cross-project atomic receipt, rollback, duplicate prevention and cloud offline replay. The full existing CI suite runs on \`simple-*\` development branches. Actual iPhone and computer UI/sync verification still requires owner acceptance testing.

## v5.19.28 focused order-blocker picker (September 24)

- During real-device v5.19.27 testing, the user found the **New order blocker** phone native selector confusing: the project's TEST CONNECTOR/TEST LED orders were mixed with a huge global list starting "Shared: Repair fabric tear…" and unrelated propeller hardware could be auto-selected as the second blocker requirement. This was NOT a data-model problem; v5.19.26 had intentionally supported cross-project order reuse, but the picker showed all unrelated Orders by default.
- This release FIXES the ORIGINAL \`app-67-linked-order-blockers.js\` picker without adding another override or any schema changes. Its default selector now contains **only orders explicitly linked to this project** (primary or related via \`linkedProjectIds\`), with the ORDER ITEM displayed first and its actual received/ordered quantities. Adding a second requirement first chooses another Order linked to this project; when all this project's orders are selected, it adds a BLANK placeholder instead of silently selecting an unrelated Order. A blank row cannot be saved. Existing external-order dependencies remain visible/editable and are NEVER silently replaced.
- For genuine cross-project dependencies, each requirement has an **explicit, unchecked "Include orders from other projects"** checkbox that reveals a *search field* and separately grouped external Orders. Search matches item, vendor, tracking and primary project name; secondary project is context at the END of option labels rather than replacing order names. The selector preserves an existing chosen Order during filtering. Shared links still do not reserve stock or duplicate receipts.
- The **New independent blocker** form now distinguishes creating a separate blocker from adding a second required order to an existing blocker. If waiting blockers exist, it displays one-click "Edit [existing blocker]" actions and does NOT prefill their same name. Creating another blocker with an identical waiting description fails with a helpful "Use Edit requirements" message. Existing ALL/ANY requirements, historical resolved blockers and the confirmed EarthX explicit legacy migration are unchanged. This is a USER-INTERFACE correction; no production order/project/part records were modified.
- Pre-change GitHub recovery branch \`validated-v5.19.27-before-blocker-picker-2026-09-24\` points to \`30a2358215bcf2bb4c7f9b5755d1486e7c68e09e\`. Separate cloud safety snapshot \`020883f1-948d-4671-a0a3-508090cdb8a3\` captured 924 active tracker rows before release (no active record changes). Automated tests in \`tests/order-linked-blockers.test.mjs\` verify project-only dropdown, explicit opt-in, existing blocker edit guidance, correct second-order default, no auto-selected unrelated third row, empty-project placeholder and rejected duplicate blocker name, alongside existing cloud/atomic recovery tests. Test on phone and desktop before claiming real-device validation.
- Current user's TEST Annunciator project has an EXISTING "Waiting for parts" blocker already referencing TEST LED. To include TEST CONNECTOR in that SAME blocker: open the project, choose **Edit requirements** on its existing blocker, then click **+ Add another order**, select TEST CONNECTOR and set the threshold (e.g. 1), keeping ALL. Do **not** create a second "Waiting for parts" blocker. Do not receive inventory or alter production TEST records as part of deploying this UI fix.

## v5.19.27 multiple linked projects per Order (September 24)

- The user found during the disposable TEST LED acceptance test that the Order details only had one "Linked Project" and "Change", so it was impossible to add a second project without replacing the first. This release modifies the ORIGINAL Order and Project modules rather than stacking more wrappers. Pre-release safeguarded current main \`524e42cc1b4f09d47ba116be39cf0292c483af51\` in GitHub branch \`validated-v5.19.26-before-multi-linked-order-projects-2026-09-24\`, and created cloud safety snapshot \`3025fe9d-16ec-4fa4-8cab-925558a460d3\` with 924 active records. No real aircraft records were edited.
- **Data model:** preserve \`order.projectId\` as the ONE primary / cost-attribution project for existing compatibility; add optional \`order.linkedProjectIds\` containing UNIQUE additional project IDs (no duplicates and no primary inside the additional array). Existing Orders without the new field behave exactly as before, with no bulk normalization, migration, or unrelated Order rewrite. Helpers \`orderProjectIds(o)\`, \`orderLinkedToProject(o,pid)\`, and \`orderProjectSummary(o)\` safely handle old/new records.
- **Order details:** "Linked Projects" displays all projects, with \`+ Add\` and \`Manage\` controls. Manage allows adding another project, changing the primary project explicitly, promoting a related project to primary (keeping the former primary as a related link), or removing each project. Removing the primary promotes the first remaining link; no link removes cost attribution. Show clear confirmation when cost attribution moves and additional warning if waiting project blockers still refer to an unlinked Order. Standard Order editor explicitly labels its project field "Primary project", retaining other linked projects when saving.
- **Linked Part:** preexisting behavior of tagging the linked Part with associated project IDs is extended to any additional project. This does NOT reserve, debit or credit physical Part stock; the original Order and Part stay single records, and a single receipt still only increases stock once. Project's native Part assignment/reservation remains separate. If a new Part is created directly from an Order it receives the associated project tags, not duplicate stock.
- **Project views:** an Order linked as related now appears in all associated projects' "Orders / Things to Buy" lists and open-order closeout warnings, clearly labelled \`Shared order\` when relevant; Projects overview open order counts and Orders table search/sort display all project names. \`projectCost()\` continues to allocate full Order costs to PRIMARY project ONLY to avoid artificially doubling spend; related projects show the Order for reference without claiming its cost. Project deletion removes only the deleted project association and promotes another linked project if necessary, retaining the original Order and inventory history.
- **Order blocker compatibility:** the existing v5.19.26 ALL/ANY dependency picker prioritizes any Order already linked as primary OR related to the current Project, and uses "This project (shared)" in the chooser. Existing explicit blocker dependencies survive unlinking until separately edited or removed. The one-click already-received-order migration now recognizes a shared linked Order, always still requiring user confirmation.
- **Tests:** \`tests/order-multi-project-links.test.mjs\` loads REAL production Order, Project, Orders-table and blocker modules against disposable fixtures; checks Add, Manage, Change Primary, Make Primary, Remove, deduplication, existing Order editing, project deletion, search, shared closeout warnings, primary-only cost attribution, no duplicate receipts, pending atomic-journal protection and one receipt satisfying two projects' blockers. Existing \`tests/order-linked-blockers.test.mjs\` adds a shared Order → two Projects atomic receipt test confirming one Order, one Part, two Project changes in a single durable journal / one RPC, with offline retry. Full JS syntax and regression workflow tested on \`multi-linked-order-projects-v5.19.27\`.
- **Owner acceptance test:** Refresh phone AND desktop to v5.19.27 and wait until Synced before working across them. For the disposable TEST LED order from the screenshot, edit quantity from 1 to 4 (if following the original test plan), then + Add TEST — Second Panel under Linked Projects, confirm same Order appears on both projects without creating another Order or increasing stock. Receive 1, then 1 additional LED and verify each device and both projects' explicit blockers; verify exactly 2 in physical inventory. Do not claim live device verification until owner reports it.

## v5.19.26 reusable order blockers and ALL / ANY dependency groups (September 24)

- Pre-release protected v5.19.25 commit \`7d53eab224f90d074ad20643d8de2ff23b5f9421\` in GitHub branch \`validated-v5.19.25-before-multi-dependencies-2026-09-24\`. Created a fresh read-only-to-live cloud safety snapshot \`60e0f900-e7b1-4b75-8681-f3b9295ee89d\` of 917 active records. These safeguards did NOT modify active aircraft records.
- Replaced the old one-order/one-blocker restriction in the original \`app-67-linked-order-blockers.js\` module (no extra override layers): a Project's \`orderBlockers\` now supports one blocker with \`dependencies:[{orderId,requiredQty},...]\`, \`mode:'all'|'any'\`. Different blockers in one Project and blockers on **other Projects** may reuse the SAME Order by explicit choice. The original Order's \`projectId\` and its inventory/purchase attribution are never reassigned when an additional Project depends on it. Existing v5.19.25 single-order blockers with \`orderId\`/\`requiredQty\` remain readable and editable, without changing resolved history.
- The updated "+ Link Blocker" Project UI provides editable named blocker groups, quantity per Order, extra/removable Order rows, and two semantics: ALL required deliveries or ANY ONE alternative. The selection includes active orders assigned to other projects, explicitly labelled shared; a shared link does NOT allocate or reserve more physical units. Missing/cancelled previously selected orders must be deliberately replaced. One Project may have several active blockers; only requirements marked as holding the project count toward auto-resume.
- The existing \`applyOrderReceipt\` wrapper evaluates all explicitly affected Projects inside the SAME \`trackerStore.batch\` as the original Part and Order receipt; group receipts see all staged Order updates. ALL requires all specified quantities; ANY requires one. Partial deliveries and multiple blockers referencing the same Order are idempotent for each group; unrelated free-text \`project.blockers\` is never inferred or deleted. Resolving a group leaves a dated Project Updates history event and auto-resumes a project only if it was marked as held by an order dependency and no other holding dependencies/free-text blockers remain.
- Linking a blocker to already received parts immediately resolves the group when its ALL or ANY rule is met, WITHOUT booking an additional receipt or changing stock. The earlier one-click user-confirmed EarthX legacy text migration remains available for projects with exactly one previously received associated Order. Existing *resolved* groups cannot be silently reopened by editing them; create a new group.
- The existing v5.19.25 opt-in atomic receiving journal/RPC handles affected Order, Part and multiple Project records together. No database schema changes, extra outbox or direct edits to production inventory. Branch CI extends the existing \`tests/order-linked-blockers.test.mjs\` regression suite with many-to-many, cross-project, ALL/ANY, legacy editor compatibility, validation, already-received recognition, and five-record multi-order atomic receipt/offline retry. Owner phone/desktop real-device validation of this expansion is still required before claiming field verification.
- Note for handoffs: Since older v5.19.25 clients do not understand the new multi-order \`dependencies\` shape, refresh **all devices to v5.19.26** before entering or receiving multi-order blockers. An old client does not auto-resolve new-shape entries; it must not be relied on while stale.

## v5.19.25 order-linked project blocker resolution (September 24)

- Prior to development preserved v5.19.24 in branch `validated-v5.19.24-before-order-blockers-2026-09-24` and archived a 916-row cloud safety snapshot id `cd2320d2-f688-4bd3-95cf-1f5550373600`. No active production records were edited by development.
- New module `app-67-linked-order-blockers.js` stores explicit `project.orderBlockers` entries linking a required quantity to an existing Order. Only explicit links count; **never guess, overwrite or auto-clear unstructured legacy `project.blockers` text**. The project UI displays outstanding and resolved linked blockers, a Link Order form, and a one-click *user-confirmed* migration candidate when exactly one project Order is already fully received.
- When an Order receipt is recorded, the existing `applyOrderReceipt` handler is wrapped inside the same `trackerStore.batch`; once the required `receivedQty` threshold is reached, corresponding linked blockers are marked resolved with date, receipt event ID and a Project Updates history entry. An order-held Project transitions to In Progress only when **no other order-linked blockers or independent legacy text blockers remain**. Partial receipts do not prematurely unblock, repeat receipts do not duplicate resolutions and the original Order/Part receipt semantics are not modified.
- With opt-in atomic receiving already enabled on a device, the existing receipt journal captures the additional Project record alongside Order and Part and submits all through the original idempotent `sync_tracker_records_atomic` RPC; no new RPC or schema changes. A pending atomic journal prevents explicit blocker-link edits until resolved. This feature is independent of still-experimental v5.19.24 atomic Reserve → Use.
- **Actual EarthX user case**: the existing received Order `1790000000002` points to Project `1790030000001`, whose old text blocker still mentions waiting for the light. The app OFFERS the user a one-click “Resolve from Received Order” action, requiring explicit confirmation that the note refers ONLY to that Order. It archives the old note into Project Updates and clears the active text blocker, creates and immediately resolves the explicit order blocker, and transitions the project if otherwise unblocked. **No second receipt, inventory credit or automatic change to live EarthX data on deployment.**
- `tests/order-linked-blockers.test.mjs` covers required quantity thresholds, multi-order blockers, separate text blockers, one-click existing-receipt migration and refusal, no unrelated changes, rollback on failure and a three-record atomic receipt with offline retry. The full existing GitHub Actions regression suite also runs on this branch.
- Normal project edits, receipts and existing manual adjustment journals still use their prior guarded/atomic modes. Cross-device owner testing of the new blocker-link UI and the already-received EarthX flow remains required before claiming real-device validation.

## v5.19.24 experimental atomic Reserve → Use (September 24)

- On September 24, the owner confirmed **v5.19.23 manual adjustments and reversals** worked on their devices, following the earlier confirmed receipt tests. Preserved the then-validated main commit `c386b5eecdaed2598532bc5a616ba4ac696a4ddc` as GitHub recovery branch `validated-atomic-adjustments-2026-09-24`. Independently created cloud snapshot `c1a3c752-5fda-4b54-b013-17805321df44` of 914 active rows when development started; additionally saved the pre-release snapshot `ea8f5a92-b897-4d8a-b82f-56baa72b2c02` containing 914 active rows at 2026-09-24 17:41 UTC. These snapshots do not modify active aircraft records.
- This is a **deliberately limited next extension**. Under Cloud Account → Atomic Inventory Testing, `Atomic Reserve → Use` has its own OFF-by-default per-device toggle. The pre-existing receiving and manual-adjustment opt-ins are unaffected. When enabled, pressing **Record Use** for a *reserved* Part writes ONE durable local journal containing an existing Part, its Project, a newly CREATED Work Log, and any existing Installed Purchase records materialized for that use. All records pass through the SAME pre-existing `sync_tracker_records_atomic` RPC and idempotency ledger; no schema migration or extra sync engine was needed.
- Before journal persistence, the scoped trackerStore batch enforces one source Part and Project, a *new* Work Log (cloud `expected_version=0`), one physically consumed row with matching identifiers and quantity, exactly one Project Parts Used append and matching reservation reduction, and tightly scoped Part/Purchase credit changes. It version-locks the Part **even if unchanged** (ordinary work-log consumption does not subtract `stockQty`). Unexpected record changes/creation, a missing cloud baseline, stale values, bad quantity or storage failure fail closed and roll back unjournaled mutations.
- The shared durable journal includes `operationKind:'consumption'` while retaining V1 format and backwards compatibility with old receipt/adjustment journals. New-Log-aware recovery **preflights all records before mutating any**, recreating a missing Work Log from the saved journal after an interrupted browser cache write. On network retry the original operation ID is replayed exactly once by the server; on version conflict the journal remains blocked and must be reviewed. Full exact-cloud-payload read-only comparison with explicit confirmation can acknowledge an already-applied journal without double consumption. **Never clear site data, switch browsers to evade a blocked journal, or restore a core backup over it.**
- Stock credit preview now happens before any Part/Purchase mutation in the opt-in path: declining a negative-inventory warning leaves Part, Purchase, reservation, and Work Log unchanged. Quantity used can be PARTIAL; the remaining Project reservation persists and can be used later. Existing non-opt-in paths retain their prior behavior.
- Added `tests/atomic-consumption.test.mjs` (multi-record staging, new-log creation, offline/restart and partially persisted cache, no duplicate replay, Part version-lock with no Part stock change, storage exhaustion rollback, strict scope, blocked server conflicts, exact-match and divergent-cloud review), plus production-handler tests in `tests/core-workflows.test.mjs` (four touched records, installed-Purchase credit, partial reservations, declined warning and staging failure). The original receiving/adjustment and all other regression tests also pass under the atomic-inventory GitHub Actions workflow.
- **Not yet validated on the owner's phone/desktop at the time of development.** First test with a NEW disposable Part, Project and reservation; verify Part quantity, Project reservations, Work Log entry, Purchase credit if relevant, and sync across devices. Test an offline queue and reconnect only on disposable data. The toggle remains OFF by default everywhere until owner opts in.
- **Not included in v5.19.24:** unreserved Assigned → Used, Quick Part Used, arbitrary multi-part Work Log editor consumption, and other multi-record purchase workflows. These still use their existing sync paths and require distinct scoped follow-up tests. Do NOT call the entire tracker ACID or claim all consumption is atomic.

## v5.19.23 opt-in atomic manual inventory adjustment (September 24)

- On September 24, the owner confirmed the current Order/Part atomic receiving workflow and its cross-device history checks passed on their devices. Before any expansion, created the immutable GitHub recovery branch `validated-atomic-receiving-2026-09-24` at `11f6d449ecc6f9c0414ac6a41b59615b0774698f`, plus a **new cloud snapshot** id `314b75e5-0b61-4060-b919-fd76acd9704d` containing 916 active records. Neither action edited existing aircraft records.
- This is a SMALL FIRST EXTENSION: the existing Part's **Save Adjustment** and **Reverse** buttons use a scoped `trackerStore.batch` for predictable synchronous rollback. When the new **Atomic manual adjustments** device toggle is enabled under Cloud Account → Atomic Inventory Testing, they instead use the existing durable atomic receipt journal plus the existing `sync_tracker_records_atomic` RPC. Receipts keep their independent pre-existing opt-in. No database schema/RPC changes were required.
- Adjustment staging is deliberately restricted to exactly ONE existing Part, EXACTLY ONE appended `inventoryAdjustments` history event, no stockQty or other Part-field changes and no unrelated record touched. It verifies the confirmed cloud baseline before durable write; if unsafe, the local batch rolls back without an outgoing journal. Both operation types share one journal and one pending slot; an older blocked journal cannot be bypassed by toggling either mode off.
- New manual event fields are normalized **before** journaling (`reverses:null` for a fresh adjustment), avoiding a false mismatch when global `saveDB` normalizes Part adjustment history. The code exposes `stageAdjustment`, `adjustmentsEnabled` and `toggleAdjustments`, but leaves adjustment mode **OFF by default** on every device. Non-opt-in adjustments still use ordinary guarded cloud sync.
- The existing generic exact-cloud-match conflict review can safely acknowledge an already-applied Part-only adjustment without reapplying it, with a corrected adjustment-specific confirmation. Stale or divergent records remain blocked and need explicit review. Do NOT interpret a successful retry alone as cross-device testing.
- Added tests for the new production handler, reversal deduplication, original default path, idempotent Part-only RPC acknowledgement, offline reload recovery, strict mutation scope, storage failure, pending-operation serialization, server version conflict, exact-cloud-match review without replay and post-save normalization. Existing receipt regressions remain unchanged.
- This release DOES NOT atomically protect the more complex Reserve→Use, newly created Work Log entries, purchase-stock materialization or other multi-record consumption flows. Those require a separately designed typed journal that handles newly created Logs/Projects/Purchases, before enabling them on genuine aircraft data. Do not claim full application-wide ACID.
- Feature branch `atomic-inventory-adjustments-v5.19.23`; branch CI and normal Pages deploy must pass before counting v5.19.23 as live. Real-device offline and simultaneous-device tests for **adjustments** are still required. Start with a disposable Part; don't alter existing actual stock during validation.

## v5.19.22 supervised recovery of a deleted experimental test Order

- Sept 24 user uploaded read-only `N594ZS_Atomic_Receipt_Safety_2026-09-24.json` (app v5.19.21, blocked legacy journal created 2026-09-23 16:22:50Z) and `N594ZS_Core_Backup_2026-09-24.json` (830 manifest-counted records, app v5.19.21). Inspected both without import. The journal is ONE Order-only partial receipt for unlinked disposable `Numb` Order ID 1790180527578: 2/4, expected cloud version 2. Its older conflict reports cloud version 3 for a different receipt update ID. The safety export shows **zero current local records** for that key; current full core backup has no Numb Order.
- Independent read-only Supabase query on Sept 24 verified the actual cloud Order is version 4, `deleted_at=2026-09-23 20:06:53.95+00`, `receivedQty=2`, `partId=null`. No operation ledger row for its old pending operation ID. This is a **stale protected journal after a cloud deletion**, not a reason to retry or recreate the Order. No Part was linked or credited by that journal. **The user's intention behind deletion is NOT established**; never archive without explicit on-device consent.
- Enhanced `app-66-atomic-receipt-outbox.js`'s existing `Compare with Cloud Safely`: when and ONLY when a blocked journal has exactly one unlinked Order change, authoritative cloud contains its deleted tombstone with matching Order ID/item/ordered quantity/received quantity, and the original browser no longer has that Order, it offers TWO explicit confirms about intentional deletion and saved safety export. On approval it fetches and verifies unchanged tombstone a second time, confirms journal identity, writes/verifies full local resolution archive before touching baseline/journal, drops only that tombstoned key's saved baseline, records remote tombstone version and clears the archived pending journal. It then resumes ordinary guarded sync, which may still report unrelated conflicts. **No cloud RPC writes, no inventory credits, no Order resurrection or cloud deletions are done by the recovery action itself.**
- If local Order still exists, linked Part was included, quantity/item mismatch, cloud row is not deleted, user cancels, storage archive fails, or server/journal changes during the second read, preserve the original pending journal and request supervised review. Existing exact-match conflict reconciliation remains unchanged.
- New automated tests cover the actual unlinked deleted-Order scenario, user refusal, local record still present, linked-Part disqualification, storage failure, tombstone version race, no double credit/cloud RPC and the original safety export retention. Rollback branch `pre-deleted-test-receipt-recovery-v5.19.21`; no production Supabase records or schema were modified.
- **Device recovery instruction:** On the SAME original browser, keep both downloaded Sept 24 JSON exports, do NOT restore the core backup or clear browser/site data, refresh normally to v5.19.22, Cloud Account → Atomic Receipt Testing → Compare with Cloud Safely. Confirm archival ONLY if the owner intentionally deleted Numb and has the separate saved journal file; otherwise cancel and investigate. The pending operation may block newer unrelated local edits until resolved. Test new linked atomic receipt only AFTER the device is Synced, using NEW disposable Part and Order.

## v5.19.21 pending receipt safety export and backup label

- Added a **read-only** `Download Pending Receipt Safety Copy` button in Cloud Account → Atomic Receipt Testing, visible whenever that browser/device has a pending journal, including blocked or malformed journals while atomic opt-in is OFF. `atomicReceiptOutbox.exportPendingJournal()` exports the exact journal (or unreadable raw value), the affected local Order/Part rows, their saved cloud baselines/versions and the pending flag into a separate `N594ZS_ATOMIC_RECEIPT_SAFETY_EXPORT_V1` JSON file. It never calls an RPC, reloads cloud data, clears a pending operation or changes inventory. Browser file download cannot be independently confirmed by the app; user should verify the file was saved.
- Extended `tests/atomic-receipt-outbox.test.mjs`: blocked/offline journal export with opt-in OFF, corrupt journal raw export, no pending alert, no sync/RPC/cache deletion. All tests run in GitHub Actions. Rollback branch `pre-atomic-safety-export-v5.19.20`.
- The user's uploaded `N594ZS_Core_Backup_2026-09-23.json` was inspected read-only: exported 2026-09-23T20:53:52Z, 833 manifest-counted core records; SHA-256 and count BOTH match the contained `db` JSON. **Core backup does not include the browser-local pending atomic journal. Do not assume restoring the backup will resolve a blocked atomic receipt. Never clear the originating browser's site data while its journal is pending.** Core-only record count cannot be directly compared to cloud's extra record types. User backup was NOT imported or changed.
- Fixed `app-45-reliability.js`'s old hardcoded `VER='5.6.0'` used for backup manifests and Data Integrity badge: now reads global `APP_VERSION`, falling back only when run in isolation. A valid core backup can have a stale *reported appVersion* without a bad checksum; existing uploaded backup shows this historical label bug. Added regression check in `tests/app-update.test.mjs`.
- Before any fresh atomic test: inspect the original device/browser for pending journal. If present, use the new button to preserve it, then `Compare with Cloud Safely` for BLOCKED journals; only exact full-payload equality and separate explicit confirmation permit archival/acknowledgement, otherwise request supervised conflict review. Do not re-receive the existing unlinked `Numb` test order (received 2/4, no inventory credit). Cloud Numb row was version 4 at 2026-09-23 20:06:54 UTC, but we do not know whether its local journal exists or matches current cloud. If no pending journal remains, create a NEW disposable linked Part and Order for opt-in testing, verify Synced baseline, then test 2/4 partial receipt, offline retry and phone/desktop reflection.
- App upgrade on a device with pending changes: ordinary refresh is normally safe and preserves localStorage, sometimes requires a second load after PWA cache cleanup. `Force Latest Version` currently refuses while pending. Do not clear browser/site data, uninstall/reinstall a PWA or switch browsers to attempt recovery.
- No production Supabase record or schema changes for this release; this is an export-only safety tool and accurate display/version label. The underlying atomic RPC/outbox is unchanged.

## v5.19.20 safe recovery of an older blocked atomic receipt

- User screenshot showed an experimental **OFF** toggle but a **blocked, pending legacy order-only** atomic journal. Verified actual cloud Order `1790180527578` ("Numb") is now version 3, `qty=4`, `receivedQty=2`, `partId=null`, `status='Ordered'`. The screenshot's journal operation ID does **not** appear in `tracker_atomic_operations`. The original browser journal cannot be read remotely, so do NOT claim the precise staged payload matches cloud. This older test cannot prove linked inventory credit.
- `app-66-atomic-receipt-outbox.js` now replaces the futile Retry button on **blocked journals only** with `Compare with Cloud Safely`. It performs a **read-only** authenticated query of canonical `tracker_records` for every staged record key and requires EXACT stable JSON equality with the staged data, present/nondeleted rows and positive versions. Similar quantity alone does not suffice. Missing/mismatched fields leave the original journal untouched and instruct user to seek supervised review. No write RPC is called during comparison.
- On complete exact match, it asks **separate explicit confirmation**, warns when an older journal lacks a linked Part, validates same journal is still current, recovers the staged local cache if necessary, archives full journal locally (verified under `n594zs_atomic_receipt_resolutions_v1`), refreshes the local cloud snapshot/version baseline from authoritative server data, then clears the old pending journal and runs normal guarded sync for other changes. A quota/identity/offline failure, user cancellation or cloud divergence leaves the journal intact. Server data is never overwritten as part of this recovery.
- Tests in `tests/atomic-receipt-outbox.test.mjs` cover matching linked Part+Order without replay, matching older order-only incident without stock credit, cloud-different Part, declined confirmation, archive-storage error, offline review, and blocked UI labels, alongside existing crash/retry/outbox tests. GitHub Actions validates the release.
- The new UI requires loading **v5.19.20 on the SAME DEVICE/BROWSER containing the pending journal**. Browser/PWA code updates should retain localStorage; do not clear site data, delete/recreate the PWA or use a different browser. `Force Latest Version` currently refuses updates while pending; try ordinary page refresh first (the PWA's cache cleanup can require a second load). If refresh still shows an old release, investigate an explicitly safe code-only update path rather than clearing the journal.
- Existing user aircraft records and Supabase schema were NOT changed. Rollback branch: `pre-atomic-conflict-review-v5.19.19`. The opt-in experiment remains off by default. After resolving the old order-only journal, redo a NEW disposable linked Part + Order test from zero; keep genuine inventory outside the experiment until the device test passes.

## v5.19.19 guard unlinked experimental atomic receipts

- Verified latest cloud sample on Sep 23: disposable-looking Order "Numb" (record 1790180527578) had qty=4, receivedQty=2, status=Ordered and **partId=null**. No Part named Numb was present. This is a legitimate *order-only* receipt; it did NOT credit inventory. A newly linked Part would NOT automatically be credited the earlier two units. Cloud atomic ledger had two earlier successful operations, neither at the time of the Numb order's most recent update; do not infer the Numb receipt exercised the atomic Order+Part operation.
- Opt-in atomic outbox `app-66-atomic-receipt-outbox.js` now checks that **each changed Order has a linked Part that was changed by the very same receipt**. If not, it aborts before creating the durable journal or calling saveDB and restores staged local data. This prevents accidentally "passing" a supposed atomic inventory test with only an Order change. Existing standard non-atomic order-only receipts remain possible.
- `app-08-orders.js` single-order receipt form explicitly warns when no Part is linked. It notes that receiving only updates the Order; linking a Part later will not retroactively credit earlier receipts. Does not silently repair historical inventory.
- `tests/atomic-receipt-outbox.test.mjs` adds unlinked Order and no-part-update rollback fixtures. `tests/order-receipt-transaction.test.mjs` confirms warning markup and no side effects on opening the form. All tests and Pages deploy passed before publishing.
- A clean opt-in end-to-end test must use a NEW disposable Part (zero on hand) and NEW linked Order (four ordered, zero received) with synced baseline before receiving two. Do not re-receive the existing Numb order's earlier two or reuse actual aircraft Parts; its earlier unlinked receipt cannot prove inventory credit. Require user confirmation before altering or deleting existing user test records.
- No Supabase schema or production aircraft record changes in this release. Rollback branch: `pre-atomic-linked-receipt-guard-v5.19.18`. Atomic receipt mode remains **OFF by default** and limited to one pending operation per device. Next: user device end-to-end linked receipt test, offline/reconnect test and UX review.

## v5.19.18 receipt modal editing guard (phone)

- User reported: **the receive-items popup disappears while changing its default quantity from four to two**, despite the previous v5.19.14 navigation race fix. Root cause remains unconfirmed without a device event trace; the code had no quantity-input handler that intentionally closes it.
- Scoped UI hardening: `app-08-orders.js` marks both single- and grouped-receipt forms with `data-receipt-editor`; single quantity uses `inputmode="decimal"`. `app-35-navigation-ux.js` prevents backdrop clicks from dismissing an active receipt form (they blur the focused editor), makes Escape from a focused receipt input blur it instead of closing, and ignores unsolicited `popstate` during an active/recent edit (restoring the modal history entry). **Explicit in-app X/Back and Cancel still work.** Normal non-receipt modals retain backdrop and Back dismissal.
- New regression cases in `tests/order-modal-navigation.test.mjs` simulate backdrop, Escape, recent input/unsolicited popstate, explicit Back and non-receipt normal backdrop; `tests/order-receipt-transaction.test.mjs` verifies the REAL single and group receipt markup enables those guards. Tests passed in Actions before version bump. No Supabase schema or production records changed.
- Rollback branch `pre-receipt-form-dismiss-guard-v5.19.17`. User phone test **still required** to confirm the specific disappearing-popup report. If it persists, get device/browser and whether it happens while typing, when dismissing the keyboard, or at an incoming cloud reload; use focused event tracing rather than piling on general modal patches.
- Experimental atomic receipt outbox remains **opt-in OFF by default**; do not encourage real-aircraft stock tests. If user reports a popup vanished *after* tapping Receive, verify order and inventory before retrying to avoid a duplicate credit.

## v5.19.17 opt-in atomic receipt outbox (v5.19.16 prototype hardened)

- New `app-66-atomic-receipt-outbox.js` is loaded **after** `app-45-reliability.js` and `app-62-storage-resilience.js`, before PWA/init. It wraps the final `saveCloudState`, `loadCloudState`, `forceCloudReload`, Cloud Account, and conflict-resolution actions. Existing sync remains the **default**.
- A per-device, **OFF by default**, opt-in is in Cloud Account → **Atomic Receipt Testing**. Do **not** auto-enable it. Test with a newly created disposable Part and Order, not existing aircraft stock. `app-08-orders.js` delegates the actual production receipt callback to this journal only when opted in or another atomic receipt is already pending. Otherwise existing `trackerStore.batch` remains in use.
- Staging: refuse if other records are still pending sync or the touched Part/Order differs from the last confirmed cloud snapshot; refuse when there is another pending receipt or no durable localStorage capacity. A scoped `trackerStore.batch(work,{persist:false})` stages all Order/Part writes. Before `trackerStore.commit()` calls `saveDB()`, a journal containing an immutable `operation_id`, exact payload, pre-mutation record copies, record expected versions, workspace/user identity and timestamp is written **and verified** in localStorage. On storage failure, staged memory is restored; after a successfully persisted journal, a subsequent saveDB error preserves the journal and staged memory for recovery.
- Sync: replay the exact journal through the previously installed `sync_tracker_records_atomic` RPC before **any** legacy general sync. Verify server acknowledgements for every staged key and record version, persist exact synced snapshots/versions, and only then remove the journal. Both overlapping save triggers and concurrent retry triggers are serialized. On network failure/offline, keep the journal and pending marker; on server version conflict, store a blocked journal and stop automatic retries instead of partially acknowledging stock. Repeating an uncertain network request uses the same operation ID, relying on server-side idempotency.
- Recovery: after authenticated workspace connection, but before cloud reload, confirm the same user/workspace and restore staged Order/Part records to the local cache only if they match their saved pre-mutation values. This prevents both a crash before async browser-cache persistence and a second stale same-device tab from undoing a queued receipt. If the cache has unrelated newer edits on affected records, do not overwrite it; stop and request review. `forceCloudReload`, sign-out and ordinary field/whole-record conflict choices are guarded while an atomic journal remains pending.
- **LIMITS:** one pending atomic receipt per device; while pending, a second receipt is blocked (including if the toggle is turned off). Other ordinary tracker workflows still use existing guarded per-record cloud sync; this is **not an app-wide ACID transaction engine**. The pending journal is in browser localStorage, not a server-side general operation queue. Fully offline cold-start recovery can require sign-in/membership reestablishment; do not assume the displayed cold cache is current before authentication. A blocked server conflict needs supervised resolution; no automatic abandonment/overwrite is offered.
- `tests/atomic-receipt-outbox.test.mjs` uses fixture-only VM tests for exact payload/versions, journaling before save, quota rollback, retry after timeout with same ID, offline gating, conflicting second row, identity mismatch, crash/cache restoration on load, stale same-browser-tab reconciliation, concurrent retry serialization, and opt-out while pending. `tests/order-receipt-transaction.test.mjs` proves the real receipt handler delegates to the opt-in journal. Original cloud SQL smoke test remains `supabase/tests/atomic_operations_rollback.sql`; this release has **no new Supabase migration or production record writes**.
- NEXT: user test the opt-in path with a brand-new fake Part/Order on desktop and phone, including one offline receipt/reconnect and a fresh page load; check both order received quantity and Part movement history. Do not enable for genuine aircraft inventory until cross-device authenticated tests succeed. A recoverable conflict handoff, IndexedDB-backed journal fallback and broader multi-operation queue are later milestones.
- Rollback branch: `pre-atomic-outbox-v5.19.15`. Main release version should be v5.19.17 with cache-busted `app-66` URL.

## v5.19.15 linked order receipts in Part inventory movement history

- Corrects an observed display gap: a real Red Ring terminal (M1292) test order was successfully received into its linked Part, but the Part's Inventory Position movement history showed only its original purchase and manual adjustment. The verified cloud order has one recorded receipt +1, the linked Part's `stockQty=5`, an existing manual count adjustment -1, hence On Hand 4. **No cloud aircraft records were modified by this fix.**
- `app-42-inventory-workflow.js` now shows (a) structured Part `receiptHistory` events and (b) legacy autogenerated Order Updates of the form `Received N ea (line complete/partial receipt).` linked to the current Part. Older inferred links are explicitly labelled because legacy records did not store the Part's ID at the time of receiving. Legacy display is read-only; it does not credit stock again.
- `app-08-orders.js` writes every **new** receipt into the Part's `receiptHistory`, in the SAME local `trackerStore.batch` that updates stockQty and Order. It includes the Order's ID, immutable receipt quantity/date, vendor/reference, and shared Order Update ID for deduplication. New Part audit entries survive deleting or relinking the corresponding Order.
- Duplicate protection: if an Order Update already has a structured receipt event on any Part, do not show that update as a legacy receipt on the current (possibly changed) Part. `app-42` also subtracts Order receipts from the generic BASE fallback for Parts without linked purchases, so receipt inflows do not double-appear as both opening stock and receipt events.
- `app-38-smart-workflow.js` displays **RECEIPT +quantity** in green in the existing Part Inventory Position movement panel; users do not need a new tab. Its help text now includes order receipts and adjustments. Automated tests cover the observed Red Ring figures and actual injected UI HTML; normal partial/group receipt paths, duplicate retries, failures and new Parts with zero/nonzero opening quantities.
- Rollback branch `pre-order-receipt-history-v5.19.14`. Code-only release, no Supabase schema or user-record writes. Existing historical Order-based receipt rows disappear if their old Order is deleted (unless separately persisted onto the Part); new structured Part history survives deletion.
- IMPORTANT TEST HYGIENE: The user's Red Ring example was a **fake receipt on a REAL inventory Part**. Deleting an Order does NOT reverse its credited stock. If the unit was not physically received, recommend a `-1` manual count adjustment with an explanatory note, once verified against the user's actual count; do not alter live stock automatically or ask them to delete the original purchase.
- Cloud-wide atomicity is still not connected to browser receipts; the existing scoped local batch and legacy async record sync remain in use. Future work: durable client outbox, safe cloud operation retries, conflict integration and browser-level cross-device outage tests.

## v5.19.14 order form autocomplete and receipt popup stability

- New Order `Item / order description` now offers live, keyboard-accessible suggestions from existing `db.parts`, matching name, part number, vendor or system. Selecting a suggestion fills the full name, links the existing `orPart` inventory record and prefills available unit/vendor/price/URL/system metadata. Freeform descriptions remain allowed; editing an auto-selected name clears its automatically assigned part ID to avoid incorrect inventory credit. An explicitly selected link on an existing order is not silently cleared. Styling is scoped in `styles.css`.
- Investigated a **plausible cause** of the receipt modal disappearing immediately after creating an order: `app-35-navigation-ux.js` invoked `history.back()` from a delayed modal-close timer; the resulting asynchronous `popstate` could arrive *after* the next popup opened and close the newer receipt form. Its modal-open serial now detects this race and restores the new popup's history entry instead of dismissing it.
- `tests/order-autocomplete.test.mjs` exercises name/part-number matching, selection and automatic existing-inventory linkage, clearing only auto links after editing, and keyboard ArrowDown/Enter/Escape. `tests/order-modal-navigation.test.mjs` reproduces the late-`popstate` popup-close race, verifies new receipt form survival and normal Back/close behavior. Existing store/receipt tests continue to pass.
- Rollback branch `pre-order-autocomplete-receipt-modal-v5.19.13`. Code-only change; no aircraft records or Supabase schema were edited. **User device test still required** to confirm the specific receipt popup disappearance is resolved. If it persists, obtain steps/browser and inspect other async modal or viewport causes before broad changes.
- Cloud atomic RPC is still additive but not yet connected to the live receipt workflow; see the v5.19.13 section below.

## v5.19.13 atomic cloud primitive and scoped receipts

- New **opt-in** Supabase migration `atomic_tracker_operations` (applied in cloud migration history as `20260922200847`); tracked SQL at `supabase/migrations/202609222003_atomic_tracker_operations.sql`.
- `public.sync_tracker_records_atomic(target_workspace uuid, operation_id uuid, changes jsonb)` is an authenticated-only, permission-checked RPC. It takes 1–50 unique record keys, invokes the existing guarded-version RPC in a PostgreSQL exception subtransaction, and rolls back **all** writes if *any* record conflicts. It returns `applied: []` plus conflicts in that case. Identical successful retries of one `operation_id` replay the stored result rather than applying again; different payloads with the same ID are rejected.
- Private `public.tracker_atomic_operations` table: RLS enabled, direct read/write grants revoked for `anon` and `authenticated`; only the authenticated RPC uses the ledger. Existing `sync_tracker_records_guarded` and its callers were **not** changed. Security advisor lists its intentionally policy-less ledger as an informational lint; the new RPC does **not** appear among anonymously executable SECURITY DEFINER findings.
- SQL smoke test `supabase/tests/atomic_operations_rollback.sql` was executed inside a transaction and rolled back. It verified two-record commit, exact-op replay without version increments, reused-ID rejection, all-or-nothing rollback when the *second* row conflicts, and unauthorized rejection. Verified 0 persistent test workspaces, 0 ledger rows and the existing 913 active aircraft records after tests.
- Production `app-08-orders.js` receipt paths now use scoped `tx.read/update` rather than mutating captured live order/part objects. Group completion toast reports the pre-operation unit count. `tests/order-receipt-transaction.test.mjs` adds captured-object immutability and toast regressions.
- **NOT YET WIRED INTO BROWSER:** The live browser still calls the old async guarded cloud-sync RPC for its receipt records; cloud-wide atomicity and durable retry for live user operations are NOT delivered by this release. Next: durable browser-side operation ID/queue, safe before-save staging, replay on reconnection and page reload, conflict-resolution integration, and cross-device browser testing. Do not enable the atomic RPC for real receipts until these are verified.
- Rollback branch: `pre-cloud-atomic-ops-v5.19.12`. The migration is additive, so app rollback does not require dropping its ledger/function. No user aircraft data was edited.

## v5.19.12 actual order receipt safety

- The REAL `app-08-orders.js` entry points (`savePartialOrderReceipt`, `receiveOrderGroup`, `saveOrderGroupReceipt`, and the fully-applied `receiveOrder` path) now use `trackerStore.batch()` for single in-memory rollback/one `saveDB()` call. The legacy `applyOrderReceipt` function still directly mutates records *inside that guarded callback*; it has **not** yet been fully refactored to the `tx` API.
- Selected grouped receipt inputs are validated **all at once before mutation**, fixing a prior case where a bad second quantity could leave the first row incremented in memory without any save. A broken linked Part now blocks the receipt instead of acknowledging an order without inventory credit. No automatic Project or Work Log entry is created by a receipt (preserve existing behavior).
- `tests/order-receipt-transaction.test.mjs` runs the real production receipt paths against fixture-only DBs. Covers partial/final, full/selected group, no double-credit on repeat, invalid second line, missing part, injected second-part failure with rollback, cancel, and synchronous persistence errors. CI executes this file with all other tests.
- The batch rolls back **only** synchronous errors during mutation. If `saveDB()` throws after local side effects, staged memory is retained and the user is told to inspect order and sync status before retrying. Cloud sync is asynchronous and `sync_tracker_records_guarded` isn't made atomic across all records by this change.
- Rollback branch `pre-order-receipt-atomicity-v5.19.11`; no production aircraft records or Supabase schema were changed. Cache-bust `app-08-orders.js` to v5.19.12 in `index.html`.
- Next priority: durable cloud transaction protocol or operation identifiers for exactly-once order receipt, plus browser-level test of real UI on multiple devices.

## v5.19.10 transaction reliability / local-first status

- `app-17a-data-store.js` is the thin `trackerStore` interface now used by selected ordinary CRUD flows (aircraft details, dated entity updates, equipment history, checklists, documents, ordinary projects, ordinary orders).
- `trackerStore.batch(tx => {...})` supports **synchronous in-memory grouping only**: one `saveDB()` call after the callback, full in-memory rollback if the mutator throws, and no nested batches/mid-batch commit.
- The per-batch `tx` facade is revoked on completion or rollback. Returning a Promise is rejected; callers must not use global `window.trackerStore` or direct `db` mutation for delayed work and must not treat this API as an asynchronous/cloud transaction.
- Record writes reject mismatched supplied IDs versus payload IDs. On a synchronous `saveDB()` exception **after staging**, the store leaves the staged state in memory rather than falsely rolling back changes that may already be queued/persisted; the caller must handle recovery/retry.
- Regression suite: `tests/transaction-reliability.test.mjs` covers a simulated linked Order + Part + Project + Work Log batch, rollback/identity checks, async-after-batch guards, and save-failure handling. `tests/sync-versioning.test.mjs` covers server stale-write rejection, successful row-version updates, cloud-RPC failure, and offline pending flags. CI runs all `tests/*.test.mjs`.
- **Cloud durability is still not atomic:** `saveDB()` queues cloud sync; it does not await durable persistence, and the guarded RPC is invoked in batches of up to 50 records. Do not promise all-or-nothing cloud behavior across batches or on network failure. Multi-record delete, attachment flows, and some remaining inventory/purchase paths still bypass `trackerStore`. Build an explicit durable operation/transaction layer before claiming cross-device atomicity.
- Current safety branch: `pre-transaction-regressions-v5.19.9`. No schema or user aircraft-record changes were required for this slice.
- `app-44-assistant-collapse.js` **is still dynamically loaded** by `app-15-init.js`. It is not listed in `index.html` directly, but it is active; do not delete based on the direct-script list alone.

## v5.9.0 Systems workspace

- `app-48-systems.js` provides the first-class Systems tab and saved system overview records.
- System dashboards derive linked projects, squawks, equipment, parts, orders, maintenance, documents, work logs, purchases, checklists, and references from existing records.
- `db.systems` stores only system-level metadata: canonical name, aliases, description, purpose, readiness override, next action, blockers, notes, and representative image URL.
- System metadata syncs through the existing `tracker_records` table using record type `system`; no Supabase schema migration is required.
- Orders now support a direct `system` value and otherwise inherit their system from their linked project or part.
- Filtered drilldowns preserve the selected system across Orders, Maintenance, Checklists, Documents, Equipment, Purchases, Squawks, Projects, Parts, and Work Log.
- The Unassigned workflow can classify records in bulk. The merge workflow rewrites system names while preserving the former name as an alias; it never deletes underlying records.
- Readiness is a tracker-derived workflow signal, not an airworthiness determination or return-to-service authorization.

### v5.9.1 system-card actions

- Every Systems overview card has a three-dot menu with Open, Edit/Rename, Merge, and Delete.
- Renaming a derived system automatically keeps its former name as an alias so existing records remain linked.
- Deleting a system never deletes underlying records; it moves linked records to Unassigned and removes only the system metadata.
- Prefer stable aircraft subsystems as top-level systems (for example Electrical, Engine, Fuel System, Propeller, Landing Gear, Brakes, Flight Controls, Panel / Avionics, Airframe / Fabric, and Cooling). Use projects for discrete jobs.

### v5.9.2 consolidated systems and tile ordering

- The overview consolidates legacy categories into stable aircraft systems without deleting or duplicating records: Aircraft, Airframe, Fabric / Airframe, and Records / W&B appear under Airframe / Fabric; Avionics / Instruments appears under Panel / Avionics; Exhaust and Project appear under Engine; Fuel appears under Fuel System.
- Canonical-aware filters keep legacy records visible when drilling into Projects, Parts, Equipment, Purchases, and Work Log.
- System tiles can be rearranged with desktop drag-and-drop or the Move earlier / Move later actions in each tile's three-dot menu.
- The chosen order is stored in `db.settings.systemOrder` and syncs through the existing singleton settings record; no Supabase migration is required.

### v5.9.3 sortable Orders table

- Every data column on Orders is sortable in both directions: Item, Project, Part, Vendor, Quantity, Received, Status, ETA, and Total.
- Sorting preserves grouped purchase-order rows and works together with search, status, and system filters.
- The active column shows an ascending or descending arrow; unsorted headers show the bidirectional sort indicator.

### v5.9.4 collapsible Dashboard sections

- Current Project Priorities, Blockers / Holds, Recent Work, Parts Inventory, Open Orders, and Quick Actions can each be collapsed independently.
- Collapse choices are stored in `db.settings.dashboardCollapsedSections` and sync through the existing singleton settings record.
- The aircraft summary, high-level metrics, readiness strip, and independently collapsible N594ZS Assistant remain visible.

### v5.9.5 rearrangeable Dashboard sections

- The six collapsible Dashboard section tiles can be reordered by dragging their handle on desktop.
- Move earlier / Move later arrow controls provide reliable rearranging on phones and tablets.
- The chosen order is stored in `db.settings.dashboardSectionOrder` and syncs through the existing singleton settings record.
- Aircraft identity, readiness, the Assistant, and top metrics remain anchored so essential context stays predictable.

These identifiers are not credentials. Never expose secrets, service-role keys, access tokens, or private authentication material.

## First steps in every new ChatGPT conversation

Before changing the tracker:

1. Read this file.
2. Fetch the current `index.html` from GitHub and identify the actual live release/version and script order.
3. Inspect the latest GitHub commits/workflow runs. Never assume the version in this handoff is still current.
4. For any Supabase work, read the Supabase skill/instructions and current Supabase documentation first.
5. Query the current cloud record(s) you are about to change before editing them.
6. Preserve existing user-entered data and links.
7. Make the smallest coherent change that solves the request.
8. Verify after the change:
   - relevant cloud rows if data changed;
   - JavaScript syntax/GitHub Actions if code changed;
   - GitHub Pages deployment completion;
   - cache/version bump when browser delivery matters.
9. State clearly what was changed and what still needs real-device verification.

## Product philosophy

This is not a generic list app. It is an aircraft lifecycle/workshop system for an experimental aircraft.

The tracker should help answer:

- What should I work on next?
- What is blocking first engine run / first flight?
- What parts do I own, where are they, and what project are they for?
- What was purchased, from whom, for how much, and why?
- What configuration produced a test result?
- What changed on the airplane over time?
- What is unresolved, unverified, missing, or waiting?

### UX rules

- Mobile-first behavior matters because the owner uses the tracker while working on the airplane.
- Avoid dead-end statistics. If the app shows a count or dollar total, prefer making it clickable into the records behind the number.
- Search/browse controls should coexist where practical.
- Back behavior and modal close behavior must be predictable.
- Do not add duplicate buttons or parallel workflows when an existing workflow can be extended.
- Preserve a clean, finished-product feel rather than continually adding tabs.

## Major current capabilities

- Dashboard and N594ZS Assistant
- Projects with priority, status, progress, phases, dependencies, blockers, next steps, definitions of done, ordered step-by-step tasks and Focus Today
- Readiness gates for engine start / flight / return-to-service organization
- Parts inventory, reservations and transaction/adjustment history
- Reserve → Use workflow tied to work-log consumption
- Orders / things to buy
  - Vendor/reference grouping, partial receipts and receive-entire-order workflow
  - Ordered quantities stay separate from on-hand inventory until received
- Purchases, invoices/order records, vendor history, receipts and source provenance
- Purchase summary drill-downs
- Aircraft Ops:
  - Status / RTS
  - Configuration
  - Inspections
  - Specs / Setup
  - Consumables
  - Costs
  - Test Trends
  - Flight Cards
  - Timeline
  - Reports
- Aircraft Ops cost drill-downs by vendor/system and underlying records
- Work log
- Squawks
- Runs / tests
- W&B
- Documents and attachments
- Equipment lifecycle/provenance
- Cloud sync and shared access
- PWA/mobile UX
- Backup, local recovery, cloud snapshots and conflict protection
- Data integrity audit
- Project sorting, including progress most→least and least→most

## Important data behavior

### Purchases vs inventory

- Purchases are provenance/financial history.
- Parts are physical inventory.
- A purchase becoming **On Hand** can create/link inventory.
- `inventoryApplied` and `inventoryPartId` are used to prevent duplicate inventory application.
- Work-log consumption is the physical outflow mechanism.
- Project “Parts Used” should not separately subtract stock if the same use is represented by work-log consumption.

### Known inventory caveat

The historical purchase→inventory trigger is intentionally idempotent, but reverse transitions from an already-applied On Hand purchase to Returned/Sold/Consumed/Installed are not considered a fully robust stock-reversal mechanism. Do not assume those transitions automatically reconstruct inventory history perfectly without inspecting the current implementation.

### Purchase system/category overrides

Aircraft Spruce CSV imports receive an automatic system category. A user-edited system/category must be preserved with `systemManual: true` so later auto-categorization does not overwrite it.

### Costs

Canonical aircraft purchase spend is based on invoice/order totals plus purchase lines not represented by an invoice record. Equipment acquisition and project material-use totals are alternate views of overlapping dollars and must not be blindly added to canonical spend.

### Source-backed aviation information

The tracker is an organizational/project-management aid. It does not determine airworthiness, return to service, maintenance legality, or regulatory compliance. Manufacturer instructions, operating limitations, required aircraft/engine records and appropriately authorized maintenance/inspection signoffs remain controlling.

## Cloud-sync philosophy

Prefer data preservation over silent overwrite.

Current sync design includes:

- normalized/canonical record comparison;
- exact per-record dirty tracking;
- Realtime reload deferral while local saves are pending;
- protected same-record conflicts;
- local recovery points before destructive choices;
- cloud snapshots before risky restore/conflict operations;
- stale-conflict migration logic.

Direct database changes made outside the browser (including assistant imports) may generate Realtime updates. Verify the browser has absorbed current cloud state after such changes rather than assuming a displayed local copy is current.

## Files / receipts

Structured receipt and invoice data can be inserted directly into `tracker_records`. Original binary receipt/PDF attachment handling depends on the app's attachment/storage pathway; do not claim the actual file is stored unless it has really been uploaded to Supabase Storage.

## Current development workflow

For code changes:

- edit the existing appropriate module when the change belongs there;
- use a new additive module only when that is safer than disturbing mature code;
- keep script order deliberate;
- bump the cache version in `index.html` when changed JavaScript must reach browsers;
- align the dynamically loaded post-init UX script version in `app-15-init.js`;
- wait for GitHub Actions JavaScript syntax validation and Pages deployment to succeed.

For cloud data changes:

- inspect the existing record first;
- preserve unknown facts as unknown rather than guessing;
- use explicit provenance notes for imported receipts/instructions;
- verify the written row afterward;
- create a snapshot before broad/risky data transformations.

## Separation from other projects

Do **not** modify the separate Homebase/household/vehicle application while working on N594ZS Tracker unless the user explicitly asks. The N594ZS repo and cloud data must remain isolated from that project.

## New-chat continuation prompt

A new chat can be started inside the same ChatGPT Project with:

> Continue development of N594ZS Tracker. Read `CHATGPT_HANDOFF.md` in `mtm951/N594ZS-Tracker`, then inspect the current `index.html`, latest commits/deployments, and current Supabase state before changing anything. The repo/cloud are canonical; preserve existing behavior and pick up from the current live version rather than relying on an old chat summary.

## Maintenance of this file

Update this handoff when architecture, canonical storage, release workflow, safety rules, or major known caveats materially change. Do not update it for every small UI tweak.
