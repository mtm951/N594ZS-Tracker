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
- Current release: **v5.9.4**

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
