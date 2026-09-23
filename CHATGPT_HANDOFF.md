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
- Current release: **v5.19.17** (verify against current `index.html` on every new session)

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
