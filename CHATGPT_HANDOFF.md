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
- Current release: **v5.19.72** (Rotax oil-system source-page correction; October 5).



## v5.19.72 Rotax oil-system source-page correction (October 5)

- Owner noticed that the Commissioning / Pre-Trial-Run oil-system source button was landing on the generic **10-10-00 p.12–13 Checks before trial run** list instead of the detailed lubrication chapter. Owner screenshot showed the relevant **79-00-00 p.3 System Description** page (physical PDF page 181).
- Source review confirmed the generic pre-trial page literally lists “Check oil hose connections are correct” and “Check for correct oil system purging,” but the detailed technical material lives in Chapter 79:
  - **79-00-00 p.3–4** = lubrication-system diagram/system description and the required external circuit connections (tank outlet → cooler → pump inlet; engine return → tank inlet; tank vent → atmosphere).
  - **79-00-00 p.24–25** = replenishing/purging procedure and closeout, including the explicit warning about incorrect line connections and the instruction to check lubrication-system connections/lines/clamps.
- v5.19.72 therefore keeps the generic pre-trial checklist itself intact but adds effective item-level source overrides for checklist `82d7854b-4268-43cd-b04e-9b94ad793b81`:
  - item **11 — Check oil-hose connections are correct** → source **79-00-00 p.3–4**, section **System description / oil-system connections**;
  - item **12 — Check oil-system purging is complete** → source **79-00-00 p.24–25**, section **Replenishing and purging of the oil system**.
- Item 10 (**Check oil-filter security**) remains on **10-10-00 p.12–13** because that page is the explicit source for the “tight fit of oil filter” pre-trial check; Chapter 79 shows the filter in the system but does not replace that specific security instruction.
- The override is presentation/source-routing only in this release. It does not rewrite the existing production checklist row while the owner still has a protected pending atomic inventory journal. Both the normal Checklist detail view and Commissioning Readiness now display/use the effective source page, so Source opens directly at the detailed Chapter 79 location.
- Added regression coverage for the oil-source overrides and direct PDF mapping:
  - `79-00-00 p.3–4` → physical PDF page **181**;
  - `79-00-00 p.24–25` → physical PDF page **202**.
- Release metadata bumped coherently to **v5.19.72** for APP_VERSION, changed checklist/readiness modules, and service-worker shell.
- No production Supabase aircraft/inventory/checklist records are modified by deploying this release.

## v5.19.71 safe consumption recovery + pending-record edit freeze (October 5)

- Owner exported the actual v5.19.70 Pending Atomic Safety Copy for operation `f00fcffd-c977-4454-a8a4-4973b86503e9` and supplied it for review.
- Exact local/staged diagnosis from that safety export:
  - pending operation is a **reserved-part consumption** of 1 ea `Parker 836-8 1/2" ID Oil Line` from Project `1789745161554` with new Work Log `1791166345591`;
  - the staged Project correctly appends one `partsUsed` row linked to that Work Log and removes the Parker reservation;
  - the local Work Log is an exact match to the staged Work Log;
  - the local Parker Part is an exact match to the staged Part;
  - the **only** local-vs-staged difference among journal members is `project.plannedParts`: after the Parker use was staged, the owner added a later reservation for **2 ea OETIKER 155 SS CLAMP 22.6MM MECH INTERLOCK 1EAR** (Part `1789662605156`, reservation `1791166410747`).
- Read-only Supabase verification immediately after reviewing the export showed:
  - the atomic-operation ledger still has no entry for operation `f00fcffd-c977-4454-a8a4-4973b86503e9`;
  - cloud Project `1789745161554` is still exactly at the journal before-state / record version 4 with Parker reserved and no Parts Used entry;
  - cloud Work Log `1791166345591` does not exist;
  - cloud Parker Part `1790029520392` is record version 4 and matches the journal;
  - cloud Oetiker Part `1789662605156` exists, has 10 on hand, and is already linked to Project `1789745161554`.
- Root cause: the original atomic transaction itself is intact and unapplied. A **later legitimate Project reservation edit** was allowed while that Project was protected by the pending journal, so `recoverLocal()` correctly refused to overwrite the newer local Project.
- v5.19.71 adds a guarded recovery path detected only when:
  - the pending operation is a consumption with one new Work Log;
  - every non-Project journal member is still the exact staged payload;
  - the affected Project differs from staged data **only** by one or more newly added reservation rows;
  - those later reservation IDs were not present in the journal before-state.
- Supervised Conflict Review then shows **Resolve Original Use + Keep Later Reservation**. On activation it:
  1. re-fetches all journal members and later-reservation Parts;
  2. requires every existing journal member in cloud to still equal the saved before-state at the exact expected version and the new Work Log to still be absent;
  3. requires later-reservation Parts to exist and already be linked to the Project;
  4. revalidates the journal and local reservation drift after the async fetch;
  5. requires explicit user confirmation that the external Pending Atomic Safety Copy was saved;
  6. archives the original journal + later local Project state in browser recovery storage;
  7. temporarily reconciles only journal members to their exact staged payload;
  8. replays the **original operation ID and exact original change payload** through the existing idempotent atomic RPC;
  9. on success, restores the later reservation list onto the now-applied Project as a separate normal local edit and queues it for ordinary guarded cloud sync;
  10. on any preflight/RPC failure while the journal is still live, restores the prior local DB and keeps the journal.
- The recovery never folds later reservations into the old atomic request, never changes the operation ID, never consumes the later reservation, and never creates a second Work Log / Parts Used row.
- Prevention: Project reservations/assignments are now blocked while any atomic inventory journal is pending; ordinary Edit Project/delete and workflow step/focus/progress edits are also blocked when that specific Project is a pending-journal member. This prevents the same post-staging drift from recurring through normal Project UI.
- Added production-harness regression coverage proving the original operation is sent exactly once with the original operation ID, the new Work Log and Parts Used row are not duplicated, and the later reservation is restored after acknowledgement.
- Release metadata is coherently bumped to **v5.19.71** for APP_VERSION, changed Project/workflow/inventory/atomic modules, and the service-worker shell.
- No production Supabase aircraft/inventory record is changed merely by deploying v5.19.71. The owner must explicitly run the supervised recovery after reviewing the conflict screen.

## v5.19.70 supervised atomic conflict review accessibility (October 5)

- Owner screenshot after the v5.19.69 cleanup still showed **Retry Pending Transaction** and **Compare Local / Cloud Safely**. This was **not** another stale-cache failure: current production code intentionally showed **Open Supervised Conflict Review** only when the journal's `blocked` flag was already set.
- The owner's current pending consumption can fail the safe local/cloud comparison because Project / Work Log cloud data differs from the staged transaction without automatically setting `blocked=true`. That made the read-only supervised review inaccessible from exactly the state where it is useful.
- v5.19.70 keeps ordinary Retry and Compare actions for an unblocked pending journal but also exposes **Open Supervised Conflict Review** at all times while a pending journal exists. Blocked journals still show the supervised review as the primary action and do not expose ordinary retry.
- The supervised review remains read-only: it compares the staged transaction against current cloud records and cannot receive, consume, overwrite, delete, or acknowledge anything merely by opening the screen.
- Added a production-harness regression proving that a normal nonblocked pending transaction renders **Retry Pending Transaction**, **Compare Local / Cloud Safely**, and **Open Supervised Conflict Review** together.
- Release metadata is bumped coherently to **v5.19.70** for `APP_VERSION`, `app-01-seed.js`, `app-66-atomic-receipt-outbox.js`, and the service-worker shell.
- No Supabase production aircraft/inventory data is modified by this release.
- Owner acceptance: once v5.19.70 is visibly loaded, open **Inventory Transaction Safety**. The existing pending transaction should show **Open Supervised Conflict Review** alongside Retry/Compare. Use **Open Supervised Conflict Review** (not Retry) and send/review the resulting field-level differences before any recovery write is considered.

## v5.19.69 atomic recovery / release-cache repair (October 5)

- Release-hygiene cleanup PR #43 merged to `main` at `cdb6165840a529eb5e6bd0b24cae5119f1532bb5`. PR regression run `37317591882` passed; main GitHub Pages deployment `37317670698` passed JavaScript syntax, the dedicated release/cache consistency check, the complete regression suite, artifact upload, and Pages deployment.
- An unresolved owner-side atomic **consumption** journal remains protected in the browser. It involves Project `1789745161554` (**Redo oil cooler to oil pump hose**), Part `1790029520392` (**Parker 836-8 1/2" ID Oil Line**), and pending Work Log `1791166345591`. Do **not** manually consume the part again, clear site/browser data, force a cloud reload, delete the pending Work Log, or discard the journal while it remains unresolved.
- Read-only Supabase inspection during recovery found the Project and Part in the cloud at record version 4, with the Part at `stockQty: 0` and the Project Open at 67%. The queried pending Work Log ID was not present in that read. Treat that as diagnostic evidence only; the protected browser journal is still required to resolve the transaction safely.
- v5.19.66 added direct pending-transaction recovery from the Work Log, an attachment-fetch Retry action, and **Completed with Warning** closeout wording.
- v5.19.67 added a guarded local/cloud comparison for the case where cloud may already contain the exact staged transaction while the browser copy has drifted. It refuses to reconcile if the staged transaction and cloud are not exact matches.
- v5.19.68 added **Open Supervised Conflict Review**, a read-only field-level comparison of the original staged transaction against current cloud records. It cannot receive, consume, overwrite, or delete records and retains the safety-copy path.
- The release sequence exposed a cache/version hygiene problem: the atomic recovery module briefly remained referenced by an old cache-buster, and visible `APP_VERSION` / service-worker shell versions were not kept aligned with the recovery module. v5.19.69 aligns `APP_VERSION`, `app-01-seed.js`, `app-66-atomic-receipt-outbox.js`, and the service-worker shell at **5.19.69**.
- Added `tests/release-cache-consistency.test.mjs` so the visible app version, safety-critical atomic module cache-buster, and service-worker shell must match; all local `app-*.js` script tags must also carry explicit semver cache-busters.
- Recovery/report UI tests no longer hard-code historical unrelated release numbers merely to prove that a module is cache-busted. CI now runs the release/cache consistency check before the broader regression suite so version drift fails fast and clearly.
- No Supabase aircraft/inventory records were modified as part of the recovery-code or release-hygiene work described above. Cloud inspection was read-only.
- Next owner step after the correct v5.19.69 code is visibly loaded: open **Inventory Transaction Safety → Open Supervised Conflict Review**, inspect the exact Project / Work Log / Part differences, and continue only from that evidence. Do not use ordinary Retry as a substitute for supervised review while the records differ.

## September 28 source-faithful Kitfox checklist rebuild

- Owner clarified the goal: the tracker checklist itself must faithfully reflect the supplied SkyStar P/N 64825.000 Dec 2001 installation manual; ChatGPT should not interrogate the owner step-by-step while rebuilding it. The owner will review/check items in the tracker.
- Rebuilt the wording and source instructions for ALL 13 manual chapters A–M directly from the supplied PDF while preserving existing owner review statuses. No checklist count or deterministic item ID changed.
- Global verification after rebuild: 13 chapters, 159 items, 0 blank titles, 0 blank manualInstruction values, 0 blank sourcePage values, 0 duplicate item IDs, exactly 1 sourceGap (the genuine missing printed L.3), 44 Verified, 115 Pending, 0 N/A, 0 Needs Attention.
- Chapter status counts after rebuild: A 7/7 Verified; B 8 Verified / 4 Pending; C 1/15 Verified; D 0/12; E 0/19; F 5 Verified / 1 Pending; G 15 Verified / 1 Pending; H 1 Verified / 8 Pending; I 0/15; J 0/22; K 7 Verified / 1 Pending; L 0/15; M 0/3.
- Applicability boundaries are explicit rather than silently rewriting the manual: C=round cowl; D=smooth cowl; E.8–E.14=smooth-cowl oil-tank housing; G.8=tricycle radiator and G.9–G.12=conventional gear; H.1=smooth-cowl; I.2–I.8=factory fuel-valve arrangement; J preserves the stock SkyStar fuel schematic plus seven separately checkable p.58 routing precautions; K describes the stock SkyStar exhaust; L describes the stock 2001 electrical architecture; M is specifically the GSC three-blade ground-adjustable wood propeller.
- The owner has custom systems in several areas, so source steps may later be marked N/A by the owner and checked against the applicable custom/component instructions separately. Do not alter source-faithful wording merely to match custom hardware.




















## v5.19.65 records / PDF-ready report generator (September 30)

- Added `app-71-records-reports.js` to turn existing tracker records into print-ready reports that can be saved as PDF through the native browser/Windows print dialog. No third-party PDF writer dependency was added.
- Project detail now has **Generate Records**.
- Work Log detail now has **Generate Record** and **Draft Logbook Entry**.
- Project reports pull together:
  - project summary/status/progress;
  - linked Work Log history;
  - airframe/engine times recorded on those logs or the aircraft record;
  - Parts & Materials Used, aggregated from Work Log consumption plus project-only material records without a linked consumption record;
  - linked Orders / Procurement;
  - linked Documents / References;
  - blockers and optional additional record wording;
  - optional cost information.
- Individual Work Record reports include work performed, observations/settings, notes, hours, consumed parts/materials, blockers, next step, and linked references.
- Draft Maintenance Record output includes performed-by, certificate/authorization number, certificate type, date, proposed work description, parts/materials, related project, and signature/date lines.
- The generator intentionally labels outputs as drafts/summaries and explicitly does **not** determine maintenance classification, regulatory compliance, return-to-service authority, or approval wording.
- No production aircraft records are created merely by generating a report. The first release is read-only with respect to tracker data.
- v5.19.65 loads the new report module with cache-busting and updates the service-worker shell version.
- Added `tests/records-reports.test.mjs` covering generator entrypoints, Project/Work Log button wiring, PDF path wording, and the maintenance-record safety language.
- Owner acceptance: after v5.19.65 is Synced, open a real Project → **Generate Records**, fill or leave the record fields blank, and use **Generate Report / Save PDF**. Confirm the Windows/browser print dialog offers **Save as PDF** and that the report contains the linked Work Logs and Parts & Materials Used. Also open a Work Log → **Draft Logbook Entry** and verify it remains clearly a draft and does not automatically assert return-to-service approval.

## v5.19.64 commissioning recorder flow polish (September 30)

- Owner approved continuing from the actionable Commissioning Readiness release into the existing First Start / Ground Run recorder and transition UX.
- PR #42 `v5.19.64: tighten commissioning recorder flow` merged to `main` at `90a73836ab543514959f44f921d6161395a3735a`.
- Final PR workflow run `36776283303` passed JavaScript syntax and the complete regression suite.
- The guided recorder now includes a collapsible **Guided Session Checklist** above the current step:
  - every recorder step is visible with **Open**, **Complete**, or **Finding** status;
  - each row shows the checklist group and applicable readiness stage when present;
  - clicking a row jumps directly to that recorded step without changing its completion state;
  - normal active-run jumps preserve the current unsaved draft locally before switching steps;
  - finalized-session step browsing is intentionally read-only and uses a local view index, so merely reviewing an old Run/Test does not mutate the saved Run record.
- Finalized guided sessions now show a **Post-run readiness** section with live **Full-Power Ground Run** and **Flight Release** cumulative gate counts plus direct gate buttons and Readiness Overview.
- The Run/Test detail card for a finalized guided session also shows those next workflow-gate counts and provides **Full-Power Gate** / **Flight Release Gate** actions, so the transition is visible immediately after Finish/Abort returns to Run/Test detail.
- Core modal navigation now treats `openCommissioningGate(...)` as nested detail navigation, preserving Back/Escape history when opening a readiness gate from a recorder or Run/Test popup.
- Repeated commissioning sessions no longer misleadingly keep saying **Start First Run**:
  - after a prior guided run exists, Readiness shows the last Run number/outcome;
  - the next action becomes **Start Run #N**;
  - a **Last Run** button opens the prior Run/Test;
  - the creation modal shows previous-run context.
- No source procedure wording, timer limits, checklist completion state, aircraft data, Project state, inventory state, or Supabase records were changed by this release.
- Added regression coverage for direct recorder-step jumps, finalized-session read-only browsing, post-run gate summaries, and recorder-to-gate modal history.
- Main verified after merge: `APP_VERSION='5.19.64'`; `app-03-core.js` and `app-70-first-start-recorder.js` are cache-busted to `v=5.19.64`; service-worker shell `n594zs-v5-19-64-shell`.
- Owner acceptance: once Synced, refresh and confirm footer **v5.19.64**. Preview or open a guided run and expand **Guided Session Checklist**; click several rows and verify direct navigation. On a finalized run, review several steps and confirm no record state changes, then use **Full-Power Gate** / **Flight Release Gate** and Back/Escape to verify navigation continuity.

## v5.19.63 actionable Commissioning Readiness (September 30)

- Owner greenlit the next Commissioning Readiness polish/integration pass after re-orienting on the current repo and explicitly avoiding a duplicate commissioning architecture.
- PR #41 `v5.19.63: make commissioning requirements actionable` merged to `main` at `6b738be2085b189a6b5d0eb5ed6273bfd72b2239`.
- Final PR workflow run `36771267209` passed JavaScript syntax and the complete regression suite.
- Gate requirement rows are now operational drill-downs instead of read-only status rows:
  - clicking a requirement opens its source checklist and scrolls/highlights that exact checklist item;
  - the requirement shows a concrete state explanation: **Complete**, **Pending verification**, **Finding open**, **Needs attention**, or **Source review required** when that metadata exists;
  - saved `moreInfo` / acceptance detail and owner review notes are visible directly in the gate;
  - source manual name/page and linked Project status are shown when available;
  - **Source** routes through the existing generic source resolver (attached PDF exact-page mapping → attached PDF → manufacturer URL → Document fallback);
  - **Project** opens the linked Project when the checklist has one.
- Gate modals now show the exact **Next open requirement** at the top with **Open next requirement**, rather than forcing the owner to hunt through the grouped checklist packs.
- The main Commissioning Readiness panel's Continue action also opens the exact next blocking requirement rather than only opening the parent checklist.
- Generic checklist rows now carry stable item focus targets and `openChecklistDetailAtItem(checklistId,itemId)` provides exact-item navigation/highlighting.
- Core nested-modal history now recognizes focused requirement navigation and commissioning Source navigation, so gate → requirement/source → Back/Escape returns through the prior gate context rather than losing the popup stack.
- A clear **First Start** gate now exposes **Start / Resume First Start Recorder**, handing directly into the existing durable guided Run/Test recorder. The recorder's existing gate enforcement remains unchanged.
- Added regressions for exact requirement focus, source routing, project/source context, state explanations, next-blocker routing, modal-history recognition and First Start recorder handoff.
- No production checklist completion state, Project state, aircraft data, inventory data or Supabase records were changed by this release.
- Main verified after merge: `APP_VERSION='5.19.63'`; `app-03-core.js`, `app-11-checklists.js`, and `app-69-commissioning-readiness.js` are cache-busted to `v=5.19.63`; service-worker shell `n594zs-v5-19-63-shell`.
- Owner acceptance: once Synced, refresh normally and confirm footer **v5.19.63**. Open Readiness → Commissioning → **First Start**. Click an open requirement and verify its exact checklist row opens highlighted; Back/Escape should return to the gate. Try **Source** on a source-backed row, and when the First Start gate eventually reaches clear, verify the gate offers **Start / Resume First Start Recorder**.

## v5.19.62 inline Project task builder (September 28)

- Owner requested that the **Edit Project** form make creation of the clickable Step-by-step task list fast and spreadsheet-like instead of requiring one separate popup per task.
- PR #40 `v5.19.62: add inline Project task builder` merged to `main` at `edcd0fa66aa9f4c23ae6f0c7721ecba675fa6208`.
- Final PR workflow run `36494759889` passed JavaScript syntax and the complete regression suite.
- Edit Project now places **Step-by-step tasks** directly after **Plan / Notes**:
  - each saved task appears as a checkbox + editable text field;
  - there is always a blank trailing task field;
  - pressing **Tab** from a task moves directly to the next task text field;
  - pressing **Tab** from the last filled task creates/focuses another line;
  - **Enter** does the same;
  - pasting multiple lines creates one task per nonblank line;
  - **+ Task** explicitly adds/focuses another task;
  - **×** removes a draft row;
  - existing per-step notes/details are preserved and indicated with a **details saved** badge.
- Inline edits are a draft until **Save Project**. Closing/canceling the Project editor does not mutate the saved checklist.
- Saving preserves existing step IDs and any extra step metadata/notes; new rows receive new IDs and ordered positions.
- If **Use checklist completion as project progress** is enabled, the newly saved inline checkbox state continues to drive Project progress through the existing workflow logic.
- The existing Project detail **Step-by-Step Tasks** card remains the normal clickable working checklist; individual task detail/note editing remains available there.
- No production Project, checklist, aircraft, inventory, or Supabase records were modified by this code release.
- Main verified after merge: `APP_VERSION='5.19.62'`, `app-20-workflow.js?v=5.19.62`, `workflow.css?v=5.19.62`, service-worker shell `n594zs-v5-19-62-shell`.
- Owner acceptance: once Synced, refresh normally and confirm footer **v5.19.62**. Open any Project → **Edit fields**, scroll to **Plan / Notes**, type several tasks using Tab/Enter between them, save, and verify they appear immediately as the clickable checklist at the top of the Project.

## v5.19.61 Documents source UX + string-ID hardening (September 28)

- Owner approved a final **Documents / source-reference cleanup pass** before returning to commissioning.
- PR #39 `v5.19.61: upgrade Documents source UX` merged to `main` at `41aaf589899489c350f51fa319f0b9ebead547b3`.
- Final PR workflow run `36493864714` passed JavaScript syntax and the complete regression suite.
- Documents table improvements:
  - **Document**, **Type**, **Revision**, **System**, **Linked projects**, and **Location / source** are sortable.
  - Active sort shows **▲ / ▼**; inactive sortable headers show **↕**.
  - Document names are now visibly underlined/clickable while the rest of the row still opens the tracker Document record.
  - Source cells asynchronously resolve actual tracker attachments without blocking the table.
  - Attached PDFs show **PDF attached • Open PDF**.
  - Other attachments show **File attached • Open file**.
  - Stored manufacturer URLs remain directly available as **Web link**, including when a PDF is also attached.
  - Records with no actual attachment or URL show **Needs file / link** while preserving any existing owner action/location note underneath.
  - Attachment source status refreshes automatically after a Document upload or attachment deletion.
- Stable string Document IDs were audited outside the Documents page as well:
  - Project → Relevant Documents links now safely open string-ID records.
  - Project → Link Document no longer coerces Document IDs through numeric-only `selectedNumber()`.
  - Work Log → Relevant Documents and Component View → Related Documents are string-ID safe.
  - Annual Inspection source-document lookup and source links no longer coerce IDs to numbers.
  - Kitfox manual source-document lookup no longer coerces IDs to numbers.
- Added/expanded regression coverage for Documents sorting, direct PDF/file/web source display, missing-source status, numeric + string ID rows, Project linking, and cross-view string-ID safety.
- No Supabase records, Document records, checklist completion states, or aircraft records changed.
- Main verified after merge: `APP_VERSION='5.19.61'`, changed script/style cache-busters are `v=5.19.61`, service-worker shell `n594zs-v5-19-61-shell`.
- Owner acceptance: once Synced, refresh normally and confirm footer **v5.19.61**. On **Documents**, click the six sortable headers, open several document names/rows, try **PDF attached • Open PDF** or **Web link**, and confirm records without a real source show **Needs file / link** with their existing note beneath it.

## v5.19.60 Documents table clickability fix (September 28)

- Owner reported that many rows in **Documents** appeared non-clickable.
- Root cause: the list renderer still emitted Document IDs directly into inline JavaScript. Legacy numeric IDs worked, but newer stable string IDs such as manufacturer/source records were emitted as bare JavaScript expressions and their row/Edit clicks failed.
- PR #38 `v5.19.60: fix document list clickability` merged to `main` at `229770ce806c9b3ad85aa356fdc49ae22537459f`.
- PR workflow run `36492725898` passed JavaScript syntax and the complete regression suite.
- The entire Documents row now opens the Document record for both legacy numeric IDs and stable string IDs.
- The row **Edit** button now works for both ID formats.
- **Web link** badges are now real direct links that open the stored source URL in a new tab without also opening the tracker record.
- New regression coverage verifies numeric IDs, string IDs, Edit actions, and direct web links.
- No Supabase data or Document records changed.
- Main verified after merge: `APP_VERSION='5.19.60'`, `app-05-views.js?v=5.19.60`, service-worker shell `n594zs-v5-19-60-shell`.
- Owner acceptance: once Synced, refresh normally and confirm footer **v5.19.60**. In **Documents**, click several of the newer source records (EarthX, IVO, ROTAX SI/OM, etc.) anywhere on their row; each should open its Document record. Their **Edit** buttons should open the editor, and **Web link** should open the actual source directly.

## v5.19.59 sortable Maintenance columns (September 28)

- Owner asked whether **System**, **Next Due**, etc. on the Maintenance table should be clickable/sortable. Agreed and implemented for consistency with Orders/Projects/Equipment.
- PR #37 `v5.19.59: make Maintenance columns sortable` merged to `main` at `2419556daf1c85628bc0e3808373e0049c374d15`.
- Workflow run `36492149136` passed JavaScript syntax and the complete regression suite. New `tests/maintenance-sort.test.mjs` passed default urgency ordering, Next Due urgency sorting both directions, unset-last behavior, text sorts, basis-label sorting and header-button markup.
- Sortable Maintenance columns:
  - **Item**
  - **System**
  - **Basis**
  - **Next Due**
  - **Status**
- Active sort shows **▲ / ▼**; inactive sortable headers show **↕**.
- Default sort remains **Status ascending** (Due → Due Soon → OK), preserving prior urgent-first behavior.
- **Next Due** is not a text sort:
  - date-based items use remaining days normalized to the existing 30-day Due Soon window;
  - hour-based items use remaining hours normalized to the existing 10-hour Due Soon window;
  - Date + hours uses whichever criterion is more urgent;
  - overdue items sort before upcoming items;
  - unset due values stay at the bottom even when reversing the sort.
- Search, System filter and Due-state filter continue working with the active sort.
- Basis display is normalized to **Date**, **Hours**, or **Date + hours**.
- No Supabase data or maintenance records changed.
- Main verified after merge: `APP_VERSION='5.19.59'`, `app-18-enhancements.js?v=5.19.59`, service-worker shell `n594zs-v5-19-59-shell`.
- Owner acceptance: once Synced, refresh normally and confirm footer **v5.19.59**. Open Maintenance and click Item/System/Basis/Next Due/Status; verify the arrows and row order change in both directions.

## v5.19.58 commissioning gate requirement drill-downs (September 28)

- Owner requested that **First Start**, **Full-Power Ground Run**, and **Flight Release** be directly clickable so the actual requirements in each gate can be inspected.
- PR #36 `v5.19.58: make commissioning gates show their requirement lists` merged to `main` at `5cfcd4df110a6d6b9b926e6f64bf86ab7fcb7263`.
- Workflow run `36490345448` passed JavaScript syntax and the complete regression suite.
- Gate cards now visibly advertise **View requirements →** so the drill-down behavior is obvious.
- Clicking a gate opens a cumulative requirement view:
  - **First Start** shows every requirement in the First Start gate;
  - **Full-Power Ground Run** shows First Start + Full-Power requirements;
  - **Flight Release** shows all commissioning requirements.
- Requirements are grouped by source checklist using collapsible sections.
- Each requirement displays:
  - requirement text;
  - **Open** or **Complete** status;
  - origin-stage badge (**First Start**, **Full-Power**, or **Flight**);
  - source checklist grouping.
- Each checklist group shows its completion count and provides **Open checklist**.
- Gate modal includes **Expand all** and **Collapse all** controls.
- The first two checklist groups are expanded by default; all groups can be expanded for a full list.
- Existing cumulative gate math and completion state are unchanged.
- No Supabase data or checklist state changed in this release.
- Main verified after merge: `APP_VERSION='5.19.58'`, `app-69-commissioning-readiness.js?v=5.19.58`, service-worker shell `n594zs-v5-19-58-shell`.
- Owner acceptance: once Synced, refresh normally and confirm footer **v5.19.58**. Click **First Start**, **Full-Power Ground Run**, and **Flight Release** and verify each opens its grouped requirement list with Open/Complete status and Open checklist actions.

## v5.19.57 Kitfox manual Save Progress / Close footer (September 28)

- Owner requested explicit **Save Progress** and **Close** controls on the long Kitfox manual chapter review checklists.
- PR #35 `v5.19.57: add Save Progress and Close to Kitfox manual checklists` merged to `main` at `4ebf6bd119daaa9badeb9ade9c3f8dbeee77180c`.
- Workflow run `36489479807` passed JavaScript syntax and the complete regression suite, including Kitfox manual UI, generic source access, First Start recorder, commissioning readiness, modal navigation and atomic inventory.
- Every Kitfox manual chapter now has a **sticky bottom footer** that remains visible while scrolling:
  - left side: **Review changes save automatically • Last checkpoint …**
  - right side: **Close** then **Save Progress**.
- Existing review actions (Verified, N/A, Needs Attention, Review note) continue to save immediately as before.
- **Save Progress** writes only `manualProgressSavedAt` on that checklist record and displays the updated checkpoint time. It does not change any review status, completion state, N/A state, finding state or note.
- **Close** uses the existing tracker Back/modal navigation via `trackerBack()`, so it returns to the prior context rather than hard-navigating to a fixed page.
- The existing previous/next chapter, All checklists and alternate-cowl N/A controls remain in place above the sticky footer.
- Mobile stacks the sticky footer cleanly and keeps Save Progress prominent.
- No existing checklist review/completion state was changed by this release.
- Main verified after merge: `APP_VERSION='5.19.57'`, `app-68-kitfox-manual-checklists.js?v=5.19.57`, service-worker shell `n594zs-v5-19-57-shell`.
- Owner acceptance: once Synced, refresh normally and confirm footer **v5.19.57**. Open any Kitfox manual chapter and verify **Close** and **Save Progress** remain visible at the bottom while scrolling. Press Save Progress and confirm the checkpoint text updates; press Close and confirm it returns to the previous tracker view.

## v5.19.56 direct manufacturer source access (September 28)

- PR #34 `v5.19.56: open source documents directly from checklist citations` merged to `main` at `6065911e3384f4dc1f9c8d750c2e23b10d0144c8`.
- Final workflow run `36488732540` passed JavaScript syntax and the complete regression suite.
- Generic checklist item **Source** buttons and the First Start / Ground Run recorder **Source** button now route through one source resolver in `app-13-attachments.js`.
- Source resolution order:
  1. attached tracker PDF + verified page mapping → open exact cited physical PDF page;
  2. attached tracker PDF without mapping → open the attached PDF;
  3. manufacturer `sourceUrl` / URL `location` → open manufacturer source directly;
  4. no attachment or trustworthy URL → fall back to tracker Document record.
- `openAttachmentPage(id,page,label)` now accepts the source-document label so the mobile in-app PDF.js viewer displays the correct manual title instead of always saying Kitfox.
- Production Document 301 (**Rotax 912 ULS Installation Manual**, Ed.3/Rev.0) now stores verified 1-based physical PDF page starts:
  - `10-10-00` → 31
  - `24-00-00` → 45
  - `61-00-00` → 67
  - `73-00-00` → 101
  - `78-00-00` → 165
  - `79-00-00` → 179
  - `80-00-00` → 207
- Verified examples:
  - `73-00-00 p.7` → physical PDF page **107**;
  - `78-00-00 p.5` → page **169**;
  - `10-10-00 p.12` → page **42**.
- This gives exact in-app source jumps for many commissioning items covering Pre-Trial, fuel, electrical, propeller, exhaust and starter-interface references that cite the attached ROTAX Installation Manual.
- URL-only manufacturer sources (current ROTAX OM, SI-912-018, EarthX, IVO) now open their manufacturer document directly when no private attachment exists.
- Current ROTAX MML Ed.04/Rev.2 still falls back to its tracker Document record because the tracker has no private PDF attachment and no trustworthy current manufacturer URL stored. No stale Rev.1 URL was substituted.
- Tests now verify chapter/page→physical-page mapping, mobile attached-PDF exact-page dispatch, manufacturer-URL opening, Document fallback, and that both checklist + recorder Source actions use the generic resolver.
- No checklist completion state changed in this release.
- Main verified after merge: `APP_VERSION='5.19.56'`, `app-11-checklists.js?v=5.19.56`, `app-13-attachments.js?v=5.19.56`, `app-70-first-start-recorder.js?v=5.19.56`, service-worker shell `n594zs-v5-19-56-shell`.
- Owner acceptance: once Synced, refresh normally and confirm footer **v5.19.56**. Open a source-backed checklist item citing **Rotax 912 ULS Installation Manual** (for example a fuel item on `73-00-00 p.7`) and press **Source**. On phone it should open the in-app PDF viewer directly at the mapped physical page. Also try an EarthX or IVO Source button and confirm it opens the manufacturer document directly.

## v5.19.55 Readiness Overview navigation fix (September 28)

- Owner reported the **Readiness Overview** button inside commissioning gate modals did nothing.
- Root cause: `openCommissioningReadiness()` independently called `closeModal()` and `navTo('readiness')`, while the navigation layer also scheduled modal-history cleanup. The delayed modal-history transition could race with and undo the explicit page navigation.
- PR #33 `v5.19.55: fix Readiness Overview navigation` merged to `main` at `b8fec2422ad25a7ca96ec30ad0c68cc7a5c52172`.
- Final workflow run `36487342337` passed JavaScript syntax and the complete regression suite.
- `app-35-navigation-ux.js` now exposes `goToTrackerPageFromModal(page)`, which treats popup→page navigation as one intentional transition:
  - confirms unsaved modal edits if needed;
  - consumes the active modal history entry first;
  - then lands on the requested tracker page;
  - when launched from another page, creates a proper page history state so browser/in-app Back returns to the originating page.
- `Readiness Overview` now uses `goToTrackerPageFromModal('readiness')` rather than separate close + nav calls.
- Regression coverage proves:
  - Readiness → gate → Readiness Overview closes the gate and remains on Readiness;
  - Dashboard → gate → Readiness Overview lands on Readiness and Back returns to Dashboard;
  - commissioning readiness code calls the atomic navigation helper.
- No production Supabase data or checklist state changed.
- Main verified after merge: `APP_VERSION='5.19.55'`, `app-35-navigation-ux.js?v=5.19.55`, `app-69-commissioning-readiness.js?v=5.19.55`, service-worker shell `n594zs-v5-19-55-shell`.
- Owner acceptance: once Synced, refresh normally and confirm footer **v5.19.55**. Open **Readiness → First Start** and click **Readiness Overview**. The gate modal should close and the Readiness page should remain visible.

## v5.19.54 sticky bottom-right recorder Save Progress (September 28)

- Owner reviewed the live Preview screenshot and requested **Save Progress** be moved to the bottom-right of the recorder, where the cursor naturally rests after reviewing the current step.
- PR #32 `v5.19.54: move Save Progress to sticky bottom-right recorder footer` merged to `main` at `57583736d589470a5b80c032ce781d3f6c2ce3c5`.
- Workflow run `36486454363` passed JavaScript syntax and the complete regression suite. Recorder regression now verifies the footer renders after the guided-step content and Save Progress is the rightmost real-run footer action.
- Recorder layout change:
  - removed the Save Progress row from the upper measurement area;
  - added a **sticky bottom footer** inside the recorder modal;
  - left side of footer shows save state/explanatory text;
  - right side contains actions with **Save Progress all the way on the right**;
  - real runs place **Abort Run**, **Finish Session**, then **Save Progress** in the footer;
  - Preview shows disabled **Save Progress — real run only** in the same bottom-right location;
  - footer remains visible while scrolling through the recorder;
  - mobile footer stacks cleanly and keeps the Save Progress action prominent.
- Save/Log/Complete/Finding/Abort/Finish behavior did not change in this release.
- No production Supabase rows or checklist completion states changed.
- Main verified after merge: `APP_VERSION='5.19.54'`, `app-70-first-start-recorder.js?v=5.19.54`, service-worker shell `n594zs-v5-19-54-shell`.
- Owner acceptance: once Synced, refresh normally and confirm footer **v5.19.54**. Open **Readiness → Commissioning Readiness → Preview Recorder** and verify the disabled **Save Progress — real run only** appears in the sticky bottom-right footer where requested.

## v5.19.53 preview exposes Save Progress control (September 28)

- Owner could not see the new Save Progress button because the current recorder is only available in **Preview** while the First Start gate remains blocked. v5.19.52 intentionally hid the durable-save control in Preview, which made the preview incomplete and confusing.
- PR #31 `v5.19.53: show Save Progress in recorder preview` merged to `main` at `4e6110c286b58da677f5f5e43a8f0b91eafb6978`.
- Workflow run `36485875914` passed JavaScript syntax and the complete regression suite. The recorder regression now verifies Preview creates no Run/Test, changes no checklist state, and visibly includes the disabled Save Progress control.
- Preview recorder now shows:
  - save-state text **Preview • nothing is saved**;
  - explanatory copy that Preview never writes tracker data;
  - disabled primary button **Save Progress — real run only**;
  - the rest of the recorder layout remains unchanged.
- Real-run Save Progress behavior from v5.19.52 is unchanged.
- No production Supabase rows or checklist completion states changed.
- Main verified after merge: `APP_VERSION='5.19.53'`, `app-70-first-start-recorder.js?v=5.19.53`, service-worker shell `n594zs-v5-19-53-shell`.
- Owner acceptance: once Synced, refresh normally and confirm footer **v5.19.53**. Open **Readiness → Commissioning Readiness → Preview Recorder** and confirm the disabled **Save Progress — real run only** button is visible next to the preview save-state text.

## v5.19.52 explicit recorder Save Progress state (September 28)

- Owner suggested a visible Save control so users know in-progress recorder work is actually saved before closing the modal. This was adopted as a UX/safety improvement rather than relying on invisible local draft behavior.
- PR #30 `v5.19.52: add explicit Save Progress to commissioning recorder` merged to `main` at `d36f3dfaca242efc22342911e742047d36bfaa2e`.
- Final workflow run `36484213779` passed JavaScript syntax and the complete regression suite. The existing `tests/first-start-recorder.test.mjs` now also proves **Save Progress** persists working state without completing the checklist, creating a formal measurement snapshot, creating a Squawk, or creating a Work Log.
- Recorder UX changes:
  - adds a prominent **Save Progress** button in real commissioning sessions;
  - adds visible **Saved to Run/Test ✓** vs **Unsaved changes • kept locally on this device** status;
  - renames **Save Reading Snapshot** to **Log Reading** to make the distinction clear;
  - adds explanatory copy: Save Progress syncs current fields/step note without completing the step; Log Reading creates a timestamped measurement snapshot;
  - on mobile the Save Progress button expands full width.
- Save Progress writes the current measurement-field values, engine-hours start/end values, current step note and `lastSavedAt` timestamp into the durable Run/Test record. It deliberately does **not** change checklist status or step position.
- Local input draft is cleared only after the durable tracker save succeeds.
- Existing behavior remains:
  - Complete & Next = save + checklist completion;
  - Finding = save + Before Flight Squawk + checklist remains incomplete;
  - Abort/Finish = session finalization + linked Work Log.
- No production Supabase rows or checklist completion states were changed by this release.
- Main verified after merge: `APP_VERSION='5.19.52'`, `app-70-first-start-recorder.js?v=5.19.52`, service-worker shell `n594zs-v5-19-52-shell`.
- Owner acceptance: once Synced, refresh normally and confirm footer **v5.19.52**. Open **Readiness → Commissioning Readiness → Preview Recorder** to inspect layout; in a real future run the Save Progress control/status appears and distinguishes durable save from local unsaved draft.

## v5.19.51 guided First Start / Ground Run Recorder (September 28)

- PR #29 `v5.19.51: add guided first-start / ground-run recorder` merged to `main` at `ad56d91e65dbbe22cdca2a45dedc8e0bc5ffe2f2`.
- Final workflow run `36483472253` passed JavaScript syntax and the complete regression suite. New `tests/first-start-recorder.test.mjs` passed durable Run/Test creation, Complete → checklist update, Finding → unresolved Squawk, Finish/Abort → exactly one linked Work Log, and no duplicate Work Log on repeated Finish. Existing commissioning-readiness, nested modal-navigation, source-backed checklist, Kitfox desktop/mobile PDF and atomic-inventory suites remained green.
- New `app-70-first-start-recorder.js` extends the v5.19.49 Commissioning Readiness panel. It does not create a parallel database or new Supabase schema.
- Data model:
  - primary session record = existing `run` / Runs & Tests record;
  - source checklist = existing **ROTAX 912 ULS — First Start / Initial Ground Run** checklist;
  - unresolved discrepancy = existing `squawk` record;
  - final narrative = existing `log` / Work Log record;
  - photos/files attach to the Run/Test record.
- Gate behavior:
  - a real commissioning run can start only when the cumulative **First Start** gate is clear;
  - while First Start is blocked, **Preview Recorder** is available and does not write data, create a Run/Test, change a checklist item or create a Squawk;
  - if an unfinished guided run already exists, Readiness shows **Resume Recorder** instead of allowing a duplicate active session.
- Starting a real session immediately creates a durable Run/Test record with `commissioningRun.kind='first-start'`, Run number, start timestamp, checklist-step snapshot, post-purge flag, current step, measurement history and finding links. This means the session survives refresh/device changes once synced.
- Recorder UI:
  - session elapsed timer;
  - engine-run timer;
  - **ENGINE STARTED — START TIMER** action;
  - **Oil Pressure Confirmed** action;
  - post-purge 5-second or general 10-second oil-pressure cue (workflow cue only; manufacturer/aircraft procedure controls);
  - **Engine Stopped** action;
  - readings for RPM, oil pressure, oil temp, coolant temp, CHT, fuel pressure, bus voltage, ignition A/B drops, idle RPM, static RPM and engine-hours start/end;
  - explicit reading snapshots;
  - Previous / Source / Finding / Complete & Next / Next;
  - phone-friendly two-column measurement layout;
  - local unsaved input draft between explicit saves.
- Persistence behavior:
  - **Complete & Next** writes the Run/Test step result + measurement snapshot and checks the source checklist item in one synchronous `trackerStore.batch`;
  - **Finding** requires a note, creates an unresolved **Before Flight** Squawk linked to the Run/Test/checklist item, records the finding in the session, and deliberately leaves the checklist item incomplete;
  - **Abort Run** requires a reason, creates an unresolved Before Flight Squawk, marks the Run/Test Aborted and creates one linked Work Log;
  - **Finish Session** records Satisfactory only if all guided steps are complete and no findings remain; otherwise it records Follow-up Needed and leaves readiness blockers intact;
  - finalization creates one and only one linked Work Log with structured run measurements/summary;
  - completed source checklist items feed the existing commissioning-readiness counts automatically.
- Recorder Run/Test detail exposes **Resume/View Guided Session** and the linked Work Log when available. Attachment upload on an active commissioning Run returns to the recorder rather than kicking the user out to the generic Run detail.
- CI found and fixed a real pre-merge bug in minimum-reading aggregation: blank prior minima were being coerced to numeric zero. v5.19.51 correctly treats blank as unset while preserving a genuine measured zero. This affects oil-pressure minimum, fuel-pressure minimum and bus-voltage minimum.
- No production Supabase rows or checklist completion states were changed by this release.
- Main verified after merge: `APP_VERSION='5.19.51'`, `app-70-first-start-recorder.js?v=5.19.51`, service-worker shell `n594zs-v5-19-51-shell`.
- Owner acceptance: once Synced, refresh normally and confirm footer **v5.19.51**. Open **Readiness → Commissioning Readiness**. Because First Start is still blocked in live data, verify the new **Guided run recorder** row shows **Preview Recorder** plus the blocked/start action. Open Preview and confirm the phone/desktop layout, measurement fields, guided step card and navigation. Preview must not change any checklist counts or create a Run/Test.

## v5.19.50 nested modal Back / Esc navigation (September 28)

- Owner requested that drilling from **Readiness → commissioning gate → checklist** should allow **Esc / X / Back** to return to the previous popup rather than dropping directly back to the Readiness page.
- PR #28 `v5.19.50: make Esc/X return to previous modal` merged to `main` at `926f8182dd716fe2019c467342a1734cdc076761`.
- Final workflow run `36480975885` passed JavaScript syntax and the complete regression suite. The nested modal-navigation regression passed together with commissioning readiness, source-backed checklist, Kitfox manual/mobile PDF viewer and atomic inventory tests.
- Existing core modal history in `app-03-core.js` was reused; no second stack was invented.
- `app-35-navigation-ux.js` now checks whether the current popup has a saved internal parent (`data-modal-back`). If so, `trackerBack()` calls `modalBack()` first instead of browser `history.back()`.
- Because Esc, the floating universal X, the small modal-header X and in-app Back all route through `trackerBack()`, they now share the same nested behavior:
  - Readiness → First Start gate → checklist;
  - Esc/X/Back once → First Start gate;
  - Esc/X/Back again → underlying Readiness page.
- Unsaved-edit protection remains in force. The first Escape while an input is actively being edited still only blurs the editor; a deliberate second Escape/Back/X follows the normal discard-confirmation logic if the form is dirty.
- Commissioning pack rows and Continue buttons now use actual `openChecklistDetail(...)` inline detail navigation so the existing core parent-snapshot mechanism captures the gate popup before opening the checklist.
- Ordinary top-level popup behavior is unchanged.
- No production Supabase records or checklist completion states changed in this release.
- Main verified after merge: `APP_VERSION='5.19.50'`, `app-35-navigation-ux.js?v=5.19.50`, `app-69-commissioning-readiness.js?v=5.19.50`, service-worker shell `n594zs-v5-19-50-shell`.
- Owner acceptance: once Synced, refresh normally and confirm footer **v5.19.50**. Open **Readiness → First Start → any checklist**. Press **Esc** once and confirm the First Start gate breakdown returns; press Esc again and confirm the gate popup closes to Readiness. The X buttons should behave the same way.
- **OWNER ACCEPTANCE COMPLETE:** Mike confirmed v5.19.50 works great, including nested Esc/X/Back behavior.

## v5.19.49 commissioning readiness dashboard / dependency gates (September 28)

- PR #27 `v5.19.49: commissioning readiness gates` merged to `main` at `b638ed58a01121f1040cdb9d19c7b2385037988e`.
- Final workflow run `36479435633` passed JavaScript syntax and the complete regression suite. New `tests/commissioning-readiness.test.mjs` proves cumulative gate math/dependencies; source-backed checklist, Kitfox manual/mobile viewer, atomic inventory, update/recovery and all existing workflow regressions remained green.
- All 181 items in the eight commissioning checklists now carry explicit item-level `requiredBefore` metadata:
  - `first-start` = must be complete before the first engine start;
  - `full-power` = additional item that must be complete before the full-power ground-run gate;
  - `flight` = additional item that must be complete before Flight Release.
- Gates are intentionally **cumulative**. A First-Start blocker automatically remains a blocker for Full-Power and Flight Release.
- Live production verification after merge:
  - overall commissioning: **3 / 181 complete**;
  - **First Start: 3 / 94** required items complete (**91 open**);
  - **Full-Power Ground Run: 3 / 125** cumulative required items complete (**122 open**);
  - **Flight Release: 3 / 181** cumulative required items complete (**178 open**);
  - **0 untagged commissioning items**.
- No completion/checkmark state was changed while adding gate metadata. The three complete items are still the owner’s original three completed Pre-Trial items.
- New `app-69-commissioning-readiness.js` extends the existing Project Readiness page rather than creating a competing workflow:
  - adds a **Commissioning Readiness** panel with overall 3/181-style progress;
  - three live cards: **First Start**, **Full-Power Ground Run**, **Flight Release**;
  - later cards show upstream dependency status when an earlier gate is still open;
  - clicking a gate opens a checklist-by-checklist blocker breakdown;
  - each pack row shows progress and the first unresolved item;
  - **Continue** jumps directly into the next blocking checklist;
  - dashboard gets a compact 912 Commissioning strip with live open counts.
- Generic checklist UI now displays commissioning dependency badges directly on each source-backed item: **Before First Start**, **Before Full-Power**, or **Before Flight**. Commissioning checklist cards also show how many items belong to each gate.
- This remains a workflow/readiness aid only. A green tracker Flight Release gate does not itself constitute an airworthiness approval, maintenance release, return-to-service signoff, or authorization to fly; actual N594ZS Operating Limitations and applicable legal authority still control.
- Main verified after merge: `APP_VERSION='5.19.49'`, `app-11-checklists.js?v=5.19.49`, `app-69-commissioning-readiness.js?v=5.19.49`, service-worker shell `n594zs-v5-19-49-shell`.
- Owner acceptance required: once Synced, refresh normally and confirm footer **v5.19.49**. Open **Readiness** and verify the Commissioning Readiness panel shows approximately **3/181 overall**, **3/94 First Start**, **3/125 Full-Power**, **3/181 Flight Release**. Click First Start and verify it opens the blocking checklist breakdown. Do not clear site data.

## v5.19.48 source-backed commissioning checklists + first-flight master gate (September 28)

- PR #26 `v5.19.48: source-backed generic checklists` merged to `main` at `dfd1080b344dc42c186b3ba59c5ecf732628c786`.
- Final PR workflow run `36471158439` passed JavaScript syntax and the complete regression suite. New coverage verified stable string Document IDs and visible source-backed generic checklist rendering; existing Kitfox manual/mobile viewer/atomic inventory regressions remained green.
- Generic checklists now visibly render item group, manufacturer/source Document, page/section, acceptance detail and review note. Item-level **Source** buttons open the applicable source Document. Checklists can show multiple source Documents. Core `docById()` and Document detail/edit/upload/update flows now support stable string IDs as well as legacy numeric IDs.
- Production tracker commissioning pack created/expanded:
  - **ROTAX 912 Installation Manual — Pre-Trial-Run Closeout**: 17 items; existing state preserved at **3 complete / 14 incomplete**; all 17 now have item-level source metadata.
  - **ROTAX 912 ULS — Oil-System Purge / First-Start Prerequisite**: 19 new unchecked source-backed items.
  - **ROTAX 912 ULS — First Start / Initial Ground Run**: existing start checklist upgraded in place to 29 source-backed items; original checkmarks/notes preserved (currently 0 complete). Sequence corrected to put pneumatic carb sync before ignition/full-power checks and cooling run after the controlled full-power check.
  - **N594ZS — Custom Fuel System Commissioning / First-Start Closeout**: 22 new unchecked items.
  - **N594ZS — EarthX ETX680 / Electrical Commissioning**: 24 new unchecked items.
  - **N594ZS — IVO Ultralight Propeller Installation / Ground-Run Closeout**: 17 new unchecked items.
  - **N594ZS — Custom 321 Stainless Exhaust Commissioning / Heat-Cycle Closeout**: 19 new unchecked items.
  - **N594ZS — Post-Run / Flight-Release Closeout**: 34 new unchecked master-gate items.
- Total across this commissioning set: **181 checklist items**. Integrity verification on 2026-09-28 showed every item has a source Document, source-page/section reference and acceptance/detail text. The only pre-checked items in the entire set are the same original 3 Pre-Trial items; no new commissioning item was auto-completed.
- All source-document references were verified live and resolve successfully: Kitfox 912 install manual, Kitfox #1442 POH, current ROTAX MML, ROTAX Installation Manual, N594ZS W&B, Wiring Diagram, Fuel System Schematic, EarthX ETX manual, IVO Ultralight instructions, custom-exhaust as-built reference, actual-operating-limitations placeholder, current ROTAX OM, and SI-912-018R4.
- New source Document records created:
  - `rotax-si-912-018-r4-2021` — ROTAX SI-912-018R4 oil-system purge source.
  - `rotax-om-912-ed4-r2-2025` — current ROTAX 912 Series Operators Manual source record.
  - `earthx-etx-manual-111017-ae-2025` — current ETX-series manual source record.
  - `ivo-ultralight-quick-adjust-instructions` — IVO Ultralight manufacturer instructions.
  - `n594zs-custom-321ss-exhaust-asbuilt` — N594ZS custom exhaust as-built reference.
  - `n594zs-operating-limitations-airworthiness-records` — **placeholder only** for the actual N594ZS Operating Limitations / airworthiness record set. It explicitly does not recreate or infer those documents.
- Important hard-stop state preserved in the master gate:
  - live aircraft status remains **PROJECT / NOT RETURNED TO SERVICE**;
  - active `current-912` W&B still contains the old 523 lb / 12.235 in values with the note **Pending final post-912 weighing**;
  - W&B Document 304 still says **Replace with post-conversion W&B when completed**;
  - final master closeout therefore requires actual post-conversion empty weight/moment/CG before flight and requires intended loading to remain at or below 1050 lb gross and within 10.2–16.0 in CG using the final measured W&B;
  - master closeout also requires the **actual** N594ZS Operating Limitations to be attached/reviewed and their major-change / flight-test requirements satisfied. Do not infer Phase I duration/notification/test-area rules from generic guidance.
- The commissioning checklists are verification/workflow aids only. Completion does not by itself constitute an airworthiness approval, maintenance release, return-to-service signoff, or authorization to fly.
- Owner acceptance still required for v5.19.48 UI: once Synced, refresh normally and confirm footer **v5.19.48**. Open any new ROTAX/N594ZS commissioning checklist and confirm its item-level source badges/detail and **Source** buttons are visible.

## v5.19.47 mobile in-app manual PDF viewer (September 28)

- Owner acceptance on v5.19.46 was split: Mike confirmed the requested source page works perfectly on desktop, but his phone still opened the manual without honoring the requested page. Treat v5.19.46 as desktop-accepted / mobile-not-accepted.
- PR #25 `v5.19.47: add mobile in-app manual PDF viewer` merged to `main` at `7a0a2039bace25286329a8afbfbd2931a6ad0b21`.
- PR workflow run `36468495235` passed JavaScript syntax and the complete regression suite. The updated `tests/manual-source-page.test.mjs` passed both the desktop native blob viewer path and the phone in-app PDF.js viewer path; `tests/kitfox-manual-ui.test.mjs` remained green.
- Root cause: mobile OS/native PDF viewers can ignore page fragments even on local blob URLs. Desktop Chrome/Edge honored the blob `#page=N` path; the phone did not.
- v5.19.47 keeps the already-working desktop native behavior unchanged.
- On phone/tablet environments (mobile UA or coarse-pointer / narrow display), source-page opening now uses the PDF.js library already loaded by the tracker:
  - the private PDF is downloaded through the authenticated Supabase Storage client;
  - PDF.js loads it in memory and renders the exact requested source page into a canvas inside a wide tracker modal;
  - the viewer includes Previous, editable page number, page count, and Next controls;
  - canvas rendering is sized to the mobile viewport and capped at 2x device-pixel-ratio for clarity/performance;
  - if PDF.js cannot render, the code falls back to the existing native blob viewer instead of dead-ending.
- No checklist records, review statuses, Supabase schema, Storage objects, or aircraft records were changed by this release.
- Main verified after merge: `APP_VERSION='5.19.47'`, `app-13-attachments.js?v=5.19.47`, service-worker shell `n594zs-v5-19-47-shell`, mobile detection + PDF.js renderer + Previous/Next controls present.
- Owner acceptance required: once Synced, refresh phone normally and confirm footer **v5.19.47**. Tap any Kitfox **Open PDF p.X** button. On the phone it should now open an in-app **Mobile source viewer** already rendered at page X, not hand off to the native PDF viewer. Do not clear site data.
- **OWNER ACCEPTANCE COMPLETE:** Mike confirmed v5.19.47 works great on the phone and the requested Kitfox source page opens correctly in the in-app viewer.

## v5.19.46 manual PDF page-jump correction (September 28)

- User acceptance on v5.19.45 was PARTIAL: Mike confirmed the private manual PDF opened successfully, but the browser ignored the requested `#page=N` fragment and opened at the beginning. Do NOT treat v5.19.45 source-page navigation as accepted.
- PR #24 `v5.19.46: fix manual PDF page jumps with blob URLs` merged to `main` at `d79b57ea106aa4330d20b786b03570f030a8dabb`.
- PR workflow run `36467759111` passed JavaScript syntax and the complete regression suite. `tests/manual-source-page.test.mjs` passed the new authenticated-download → blob URL → `#page=N&zoom=page-width` path; `tests/kitfox-manual-ui.test.mjs` remained green.
- Root cause addressed: native browser PDF viewers may ignore page fragments on signed cross-origin Supabase Storage URLs even when the PDF itself opens correctly.
- `openAttachmentPage(id,page)` now downloads the already-private PDF through the authenticated Supabase Storage client, creates a local browser blob URL, then navigates the synchronously opened tab to `blob:...#page=<N>&zoom=page-width`.
- The old signed-URL page-jump path is removed. Normal attachment opening/downloading is otherwise unchanged.
- No checklist records, review statuses, Supabase schema, Storage objects, or aircraft records were modified by this corrective release.
- Main verified after merge: `APP_VERSION='5.19.46'`, `app-13-attachments.js?v=5.19.46`, service-worker shell `n594zs-v5-19-46-shell`, authenticated Storage `download(id)` path present, old `createSignedUrl(id,15*60)` page path absent.
- Owner acceptance required: once Synced, refresh normally and confirm footer **v5.19.46**. Open a Kitfox checklist item and tap **Open PDF p.X**. Confirm the PDF opens directly at the requested page. Do not clear site data.

## v5.19.45 direct Kitfox manual source-page access (September 28)

- PR #23 `v5.19.45: direct private manual source-page links` merged to `main` at `dc2002cdad3989b94007f172af3534615a4290b9`.
- PR workflow run `36467107441` passed JavaScript syntax and the complete regression suite. New coverage specifically passed `tests/kitfox-manual-ui.test.mjs` for checklist → attached PDF page routing and `tests/manual-source-page.test.mjs` for private signed-URL + `#page=N` behavior.
- The existing cloud Document `1789567365526` (**Kitfox Model 4 912 Install Manual**) was already linked by all 13 A–M manual checklist records and already had the actual PDF attached in the private `n594zs-files` Supabase Storage bucket:
  `n594zs/document/1789567365526/3e6793a7-2f8e-4133-bf53-a48d8cd76595__3_Newer_Engine_install_912_64825-000.pdf`.
- v5.19.45 reuses that private attachment; the PDF is NOT published with the public GitHub Pages application. The bucket was verified `public=false`.
- `app-13-attachments.js` adds `openAttachmentPage(id,page)`: cloud attachments receive a 15-minute authenticated signed URL and append `#page=<sourcePage>`; a blank tab opens synchronously before the async signing call to reduce Safari/iOS popup blocking. Local attachment fallback still uses a temporary blob URL.
- `app-68-kitfox-manual-checklists.js` now resolves the linked source Document's expected PDF filename (then any attached PDF as fallback). Each manual checklist row gets **Open PDF p.X**, each chapter Source card gets **Open source PDF at this section**, and the review-note modal gets **Open source PDF p.X**. Lookup/open failures fall back to the tracker Document record instead of dead-ending.
- No checklist review state was changed by this release. Post-change verification remained exactly **13 chapters / 159 items / 44 Verified / 115 Pending**, with all 13 chapters still linked to Document `1789567365526`.
- One production Document metadata cleanup was intentionally made: only that Document's `location` field changed from Mike's obsolete local Windows Downloads path to **Private shared attachment in tracker storage**. Record version moved 1 → 2; no notes, project links, checklist statuses, or aircraft records were changed.
- Main verified: `APP_VERSION='5.19.45'`; `app-13-attachments.js` and `app-68-kitfox-manual-checklists.js` are cache-busted to 5.19.45; service-worker shell is `n594zs-v5-19-45-shell`.
- Owner acceptance required: once Synced, refresh normally and confirm footer **v5.19.45**. Open any Kitfox manual chapter and tap **Open PDF p.X**; verify the private manual opens and lands on (or very near, depending on the device PDF viewer) the requested source page. Do not clear site data.

## v5.19.44 Advanced / Troubleshooting UX cleanup (September 28)

- PR #22 `v5.19.44: move recovery controls into Advanced / Troubleshooting` merged to `main` at `68a785ee7f422303f586cbf7ac4ae43ece417c86`.
- PR workflow run `36466053314` passed JavaScript syntax and the full regression suite. Specific coverage kept app-update safety, atomic receipt replay/crash recovery, pending atomic Work Log locks, Reserve → Use, real Order receipt reliability, zero-stock linkage/receipt behavior, sync/versioning and the new `tests/troubleshooting-ux.test.mjs` green.
- Normal Cloud Account now shows a calm **Inventory protection active** status card. It no longer exposes the full transaction-recovery panel unless a transaction is actually pending; pending transactions still surface a prominent **Review Pending Inventory Transaction** button.
- Added one consolidated **Advanced / Troubleshooting** modal for:
  - Data Integrity Check;
  - Inventory Transaction Safety / pending atomic recovery;
  - Force Latest Version + fresh-version link;
  - cloud conflict resolution;
  - creating/verifying cloud snapshots;
  - snapshot restore manager (with an extra destructive-action warning);
  - local browser recovery when one exists.
- System & Sync keeps ordinary actions only (Reload Shared Data, Export JSON, Install App when available, Create Snapshot) plus a single **Advanced / Troubleshooting** entry. Force Latest/Fresh and direct Snapshot Restore buttons were removed from the normal System screen.
- Settings → **App & Deployment** is now informational and links to Advanced / Troubleshooting. The old duplicated repository/update controls and local-data-key implementation detail were removed from this card.
- The former front-and-center **Reliability & Recovery** block is now **System Health**: integrity/sync/conflict status, Run Integrity Check, Advanced / Troubleshooting, and Resolve Conflict only when needed.
- Stale production-facing `Atomic Receipt Testing` wording was removed. Pending Work Log guidance now points to System → Advanced / Troubleshooting → Inventory Transaction Safety.
- All recovery capabilities remain available; this release changes discoverability/organization only, not the atomic transaction architecture or safety semantics.
- No Supabase schema/data changes and no production aircraft-record mutations were made by this release.
- Main verified after merge: `APP_VERSION='5.19.44'`, service-worker shell `n594zs-v5-19-44-shell`, and all touched UI modules are cache-busted to 5.19.44.
- Owner acceptance still required: once Synced with no pending atomic transaction, refresh normally and confirm footer **v5.19.44**. Normal System/Settings screens should look calmer; Advanced / Troubleshooting should contain the moved recovery/update controls.
- **OWNER ACCEPTANCE COMPLETE:** Mike confirmed the live tracker footer shows **v5.19.44** on 2026-09-28.

## v5.19.43 inventory-neutral purchase/equipment linking (September 28)

- PR #21 `v5.19.43: keep equipment linking inventory-neutral` merged to `main` at `6b582c5dd63a63ef2fe5f4add555de1e13322773`.
- PR workflow run `36463983962` passed JavaScript syntax and the complete regression suite. The suite kept atomic receipt replay/recovery, Reserve → Use, linked-order blockers, real Order receiving, zero-stock linking/receiving, sync/versioning and core workflow regressions green.
- Repo-wide stock-mutation audit found one remaining bypass in the older Purchase → Equipment/link reconciliation helper. Before v5.19.43, an explicit Track Purchase as Equipment / createPart path for an On Hand Purchase could create the Part and credit positive physical stock as a side effect, bypassing the explicit Purchase → Stock Received transaction.
- v5.19.43 removes that bypass:
  - relationship/equipment linking may create/link Part + Equipment identity records but creates the Part at `stockQty:0`;
  - an On Hand Purchase remains `inventoryApplied=false` until the explicit Record Stock Received workflow;
  - repeated purchase/equipment reconciliation cannot credit or double-credit stock;
  - Installed Purchase lifecycle links remain stock-neutral (`stockQty:0`) while preserving installed/applied provenance with `remainingQty:0`;
  - the obsolete direct `ensurePurchaseInInventory` stock mutator was removed from `app-24-data-polish.js`.
- Positive physical stock inflow is now intentionally separated from identity/linking. Existing-stock inflow should come through explicit protected receipt workflows (Order receipt or Purchase → Stock Received); existing Part count corrections go through ± Adjust Inventory; only a brand-new manually created Part may establish an initial stock baseline.
- No Supabase schema/function/policy changes and no production aircraft-record mutations were made by this release.
- Release metadata verified on main: `APP_VERSION='5.19.43'`; `app-24-data-polish.js` and `app-29-equipment.js` cache-busted to 5.19.43; service-worker shell `n594zs-v5-19-43-shell`.
- Owner acceptance: only refresh/update while the tracker reports Synced and no pending atomic transaction. Footer should read **v5.19.43**. Do not clear site data to force an update.
- **OWNER ACCEPTANCE COMPLETE:** Mike confirmed on 2026-09-28 that the live tracker footer shows **v5.19.43**. Treat the production atomic inventory coverage / final stock-credit-bypass cleanup as deployed and accepted.

## v5.19.42 complete atomic inventory coverage (September 28)

- PR #20 `v5.19.42: complete atomic inventory coverage` merged to `main` at `24652700dc8fc944135393c5fdf1e2bc06364dc6`.
- Final PR regression workflow run `36463323611` passed JavaScript syntax and the complete regression suite. New/updated coverage explicitly passed production atomic receipt replay/crash recovery, Reserve → Use, Assigned → Used, Quick Part Used, Work Log consumed-item additions, Purchase stock receipts, linked-order blockers, real Order receiving, sync/versioning, zero-stock linking/receiving, and existing Part stock-baseline protection.
- Core physical-inventory mutations are now production-default atomic operations whenever the device is connected to an authenticated editable cloud workspace. The protected families are:
  - Order receipts, including grouped receipts and receipt-driven Project blocker updates;
  - manual inventory adjustments and reversals;
  - Reserved → Used;
  - Assigned → Used;
  - Quick Part Used;
  - adding an inventory-linked consumed item to an existing Work Log;
  - Purchase → Stock Received for an already linked Part.
- These workflows share the existing durable one-at-a-time browser journal and `sync_tracker_records_atomic` RPC. They retain operation-ID idempotency, expected-version checks, all-or-nothing server conflict handling, exact-cloud comparison/recovery, crash/reload recovery, and pending-Work-Log protection.
- Old per-device receipt/adjustment/consumption testing toggles no longer control production routing. Compatibility shim methods remain only so older cached UI cannot disable the new production paths. The visible Cloud Account surface is **Inventory Transaction Safety**, not an experimental testing screen.
- Legitimate unlinked Order-only receipts remain permitted and are atomically journaled as a one-record Order operation; they do not credit inventory. If an Order names a linked Part, that Part must be updated in the same transaction or staging fails closed.
- Physical-use flows now preview Installed-Purchase provenance credits without side effects. An overdraw warning can be cancelled without having already materialized Purchase receipt history or changed Part stock.
- Edit Part no longer rewrites an existing Part's recorded `stockQty` baseline. Existing stock corrections must use the permanent ± Adjust Inventory ledger. A brand-new Part may still be created with an initial on-hand quantity.
- Purchase stock receipt deliberately requires an existing linked Part. Creating/linking a zero-stock Part stays separate from physically receiving quantity, preventing accidental identity creation + receipt double counting.
- Single-record/custom-no-Part edits may still use `trackerStore.batch` rather than the cloud atomic journal because there is no multi-record inventory transaction to split. Removing a consumed-item row from a Work Log remains a single-record guarded edit.
- No Supabase schema/function/policy changes and no production aircraft-record mutations were made for this release.
- Release metadata: `APP_VERSION='5.19.42'`; changed modules `app-07-parts.js`, `app-09-logbook.js`, `app-24-data-polish.js`, `app-42-inventory-workflow.js`, and `app-66-atomic-receipt-outbox.js` are cache-busted to 5.19.42; service-worker shell is `n594zs-v5-19-42-shell`.
- Owner acceptance: only update when the device reports Synced and no pending atomic transaction. Footer should read **v5.19.42**. Cloud Account → **Inventory Transaction Safety** should report Atomic protection active for Order receipts, Inventory adjustments, Part use / consumption, and Purchase stock receipts. Never clear site data to force the update.

## v5.19.41 production atomic order receipts (September 28)

- PR #19 `v5.19.41: productionize atomic order receipts` merged to `main` at `ce1aa5e1731ce61422c9a7bff3ba9353d94883b7`.
- PR regression workflow run `36460645953` passed JavaScript syntax and the full existing/new regression suite. Specific production receipt coverage passed in `tests/atomic-receipt-outbox.test.mjs`, `tests/order-receipt-transaction.test.mjs`, and linked-order-blocker tests; Reserve → Use, sync/versioning and transaction reliability regressions also stayed green.
- Order receipts are no longer behind the old per-device `n594zs_atomic_receipts_opt_in_v1` testing toggle. In an authenticated editable cloud workspace, `atomicReceiptOutbox.shouldHandle('receipt')` now routes receipts through the durable atomic journal automatically.
- The old receipt toggle is ignored for routing and removed from the visible settings UI. A compatibility shim remains so an older cached UI calling `atomicReceiptOutbox.toggle()` cannot disable production receipts.
- Legitimate Order-only receipts with no linked inventory Part are allowed and journaled as a single atomic Order operation. If an Order DOES have `partId`, the corresponding Part must be changed in the same operation; otherwise staging fails closed before persistence.
- Linked Order + Part receipts, grouped receipts, and receipt-driven Project blocker updates continue to share the same durable operation ID / exact payload / expected-version transaction. Pending operations remain serialized one-at-a-time per device; offline retry uses the same operation ID; conflicts block rather than partially acknowledge.
- The settings surface is now labeled **Inventory Transaction Safety**. Production receipts show as automatic when cloud-connected; manual Part adjustments and Reserve → Use remain separate opt-in experimental extensions for now.
- No Supabase schema, function, policy, or production aircraft record was changed by this release. The existing `sync_tracker_records_atomic` RPC remains authenticated-only, permission checked, idempotent and all-or-nothing on version conflict.
- Release metadata: `APP_VERSION='5.19.41'`; `app-08-orders.js` and `app-66-atomic-receipt-outbox.js` cache-busted to 5.19.41; service-worker shell is `n594zs-v5-19-41-shell`.
- Owner acceptance: only refresh/update when the device says Synced and no pending atomic operation is shown. Footer should read **v5.19.41**. Under Cloud Account, the button now reads **Inventory Transaction Safety** and should report **Order receipts: Atomic protection active** when connected. Do not clear site data to update.

## v5.19.40 Kitfox manual review-state hardening (September 28)

- During read-only production verification of the 13 source-backed Kitfox manual checklists, all 13 chapters A–M, all 159 review items, source pages/manualInstruction fields, deterministic IDs, source-document links and the single L.3 source-gap placeholder were confirmed present. No production aircraft data was changed during verification.
- Found one real compatibility issue from an older/stale client path: Section A had seven items with `done:true` but `reviewStatus:'Pending'` and blank `reviewedDate`. Activity history shows those seven were toggled one-by-one from client `7a82c9cb-6610-45da-9b56-567458b13edf` shortly after import on September 26/27. This was NOT the v5.19.39 specialized manual-review path. Later B.8 and F.1–F.5 were reviewed through the proper specialized UI and have `reviewStatus:'Verified'` plus review dates; preserve those owner reviews.
- v5.19.40 changes only UI/release code: manual checklist progress now counts ONLY explicit `reviewStatus:'Verified'` as verified. Legacy `done:true + Pending` no longer appears reviewed. Clicking such a stale item once converts it into a proper dated Verified state; normal verified items still toggle back to Pending. Standard Checklists list progress uses the same status-driven rule. Existing cloud checklist records were deliberately left untouched.
- Added regression coverage simulating stale `done:true/Pending` state and proving it is not counted as verified and normalizes correctly with one click. PR #18 `v5.19.40: harden Kitfox manual review state` merged at `e40f5c8eee1e7192cd541775eba52b540b27aae1`. PR workflow run `36442156334` passed JavaScript syntax and the complete existing/new regression suite, including atomic receipt/consumption, pending-log lock, real order receipt, sync/versioning, transaction reliability, zero-stock inventory and Kitfox manual UI tests.
- Release metadata confirmed on merged `main`: `APP_VERSION='5.19.40'`; `app-01-seed.js`, `app-11-checklists.js` and `app-68-kitfox-manual-checklists.js` are cache-busted to 5.19.40; service-worker shell cache is `n594zs-v5-19-40-shell`.
- GitHub Pages workflow `.github/workflows/pages.yml` triggers on every push to `main`, runs JavaScript syntax plus all `tests/*.test.mjs`, then deploys using `actions/deploy-pages@v5`. The current tool environment could not directly fetch the public `github.io` page or enumerate push-triggered Pages runs, so do NOT claim independent live-site observation. Final owner acceptance is to load the normal tracker only when Synced/no pending journal and confirm the footer reports `v5.19.40`.
- For Section A, do NOT bulk-reset or auto-migrate the seven stale items. They are intentionally shown as not verified until the owner personally reviews them. B.8 and F.1–F.5 remain valid explicit owner reviews unless the owner changes them.


## v5.19.39 owner-supplied Kitfox 912 manual checklists (September 26)

- User uploaded `3_Newer_Engine_install_912_64825-000.pdf`, a 77-page SkyStar Aircraft Corporation **Kitfox Lite Squared ROTAX 912/912S Engine Assembly** document P/N **64825.000, December 2001**, and states Kitfox confirmed this is the updated manual applicable to his aircraft N594ZS. Preserve exactly the source manual label, model and vintage while acknowledging owner's Kitfox applicability confirmation. The user specifically wanted each MANUAL CHAPTER built as a persistent, individually checkable checklist inside his tracker, NOT a standalone PDF or answer-only list.
- PR #17 `https://github.com/mtm951/N594ZS-Tracker/pull/17` merged at `bfe7e665d8344eed726bf5dd35a36dc5102ac7a1`; full branch CI `36285319587`, PR CI `36285394807`, main Pages deployment `36285433860` succeeded. New `app-68-kitfox-manual-checklists.js` provides chapter modal, expandable ORIGINAL source step, printed-page references, Verified/N-A/Needs-Attention status, dated checkoff, individual owner evidence notes, previous/next chapter navigation, explicit confirmation to mark entire alternate round/smooth cowl chapter N/A, direct link to existing user's document record, and source-gap guard. `app-11-checklists.js` dispatches owner-specific sourcePack records into this UI and shows badges in standard Checklists list; footer is dynamic APP_VERSION and now 5.19.39. New VM regression `tests/kitfox-manual-ui.test.mjs` proves source page, checkoff/N-A/finding status, L.3 gap gating and no mutations to other checklists. No manual PDF or full manual text was published into GitHub repository; private source paragraphs live only in owner Supabase data.
- **PRODUCTION DATA IMPORT COMPLETED and VERIFIED:** Supabase workspace `1ead2eeb-4aeb-443f-bdf7-ad7a1c901bca` now has 13 new actual **checklist** records, deterministic IDs `kitfox64825-section-A` through `kitfox64825-section-M`, `kitfoxManualPack:'kitfox-912-64825-000-dec2001'`, sourceKey with chapter suffix. Each is linked to existing owner document `1789567365526` "Kitfox Model 4 912 Install Manual" (the existing document has a Windows Downloads path to the supplied manual but no cloud attachment; do NOT imply online file bytes are uploaded there). Every manual numbered paragraph is transcribed privately into `item.manualInstruction`; `item.text` gives a concise first-sentence preview and `item.sourcePage` the exact printed page. ALL steps initially NOT VERIFIED (no prechecked work, zero owner statuses altered). Chapter counts: A 7 introduction/un-numbered prerequisites, B12 engine mount, C15 round cowl, D12 smooth cowl, E19 firewall, F6 carburetor, G16 cooling, H9 oil, I15 throttle, J22 fuel (15 numbered + seven extra unnumbered fuel-routing precautions p.58), K8 exhaust, L15 electrical (14 printed numbered plus one explicit L.3 SOURCE GAP), M3 GSC propeller. **TOTAL 159 items**, of which **144 actual printed numbered steps**, 7 intro, 7 J routing, 1 L gap. All step record IDs deterministic `kitfox64825-X.N`, plus `A.PN`, `J.RN`, and `L.3-GAP`.
- CRITICAL PDF GAP: the owner's supplied source displays L.1 and L.2 on p.66, Figure L-1 on p.67, and L.4 onward p.68: there is NO printed L.3. It must not be invented. The cloud checklist includes one clearly labeled, initially unchecked source-gap clarification item (L.3), which cannot be marked Verified without an owner review note and cannot be marked N/A. This is a missing-source placeholder, NOT an installation procedure.
- Conditional source paths preserved in labels: C entire round-cowl chapter, D entire smooth-cowl chapter; E.8–E.14 smooth-cowl oil tank housing; G.8 tricycle vs G.9–G.12 conventional gear; H.1 smooth; J.7 optional left wing tank; I.2–I.8 factory fuel-valve bracket (owner has custom valve); **M all are for a GSC propeller, owner uses IVO**—mark inappropriate source procedures N/A and inspect applicable IVO installation instructions separately. Owner confirmed applicability of the overall manual, not that all stock kit components/procedures match his custom 912 ULS conversion.
- Keep safety caveat: 2001 SkyStar manual does NOT replace current Rotax instructions for owner-specific fuel return, fuel flow/pressure, oil purge, modern EarthX/EFIS wiring, custom exhaust, IVO prop, or actual approved inspection/return-to-service procedures. Marking checklist complete is personal verification only, not a flight clearance.
- Cloud safety snapshots bracketing import: BEFORE `7d1db3ed-e6c4-403f-bc35-682f5b1e52c9`, **1,065 active records**; AFTER `da86d516-79fe-4aa2-9eac-e1e4c50fc74a`, **1,078 active records**. Existing ten checklists were retained unchanged. Read-only post-import SQL verified 13 new records, 159 items, zero done, zero non-pending, one sourceGap in L. No real installed hardware, project status, inventory or Work Log records changed.
- **Owner acceptance:** Before forcing update, owner MUST confirm desktop says Synced and there is NO pending local atomic journal; pending old journal must be resolved first (earlier offline washer transaction was in fact applied to Supabase; browser's local outbox state remains unverified). Then open v5.19.39 → Checklists tab, search `Kitfox 912 Manual` and open chapter B. Verify every numbered B.1–B.12 with page references, expand B.8 to read bushing/contact instructions, verify 0/12 unchecked, try a checkbox ONLY after confirming actual installation details. Check J chapter 22 and L missing L.3 marker. Repeat on phone after Synced. If old tab has .38, refresh only after safe sync; do not clear any local data. The existing doc reference `1789567365526` may open a document record with a local Windows location, NOT the PDF attachment on phone; offer to upload PDF privately via tracker Files if requested.

## v5.19.38 zero-stock Part linkage without receipt (September 26)

- User explicitly wanted to link ordered parts and purchase records to inventory BEFORE delivery, with **0 on hand** and without needing a positive stock quantity. Existing Order → Linked Part → Create New Part already supported stockQty=0, and `partOptions` already included all Part records; UI guidance was inadequate. Purchases “Link Inventory” previously conflated linkage with crediting stock and rejected remainingQty=0, particularly the overriding `applyPurchaseToInventory` function in `app-24-data-polish.js`. Historic Reconcile → On Hand also rejected zero.
- PR #16 merged at main `274a8fe79e68a6b65c65bb419a0c23a8037bd8b4`, branch `zero-stock-inventory-link-v5.19.38`. Branch CI `36274951450` and PR CI `36275027395` succeeded with ALL existing/new regression tests. Verify main GitHub Pages deployment `36275067486` (and any subsequent docs-triggered Pages run) independently. **No production Supabase records or aircraft inventory were modified** by this software work.
- `app-07-parts.js`: new Parts default to actual `stockQty:0` instead of blank/unknown, accept zero, reject negative numeric entry, show guidance about on-order vs on-hand. Existing Parts with blank stock remain blank until explicitly set.
- `app-08-orders.js`: New Order and Linked Part picker explicitly show all existing Parts including those with 0 on hand; Order → Linked Part → Create New Part (0 On Hand) is visible. The Order's `qty` and `orderRemainingQty` remain separate from Part physical `stockQty`; ONLY `applyOrderReceipt` credits actual accepted quantities and records receipt history.
- `app-23-wb-purchases.js`: Purchase details now offer independent `Link Part (0 OK)` and `Record Stock Received` actions. Link-only modal can choose an existing zero-stock Part or create a zero-stock Part; `purchase.inventoryPartId`, reverse `part.purchaseIds`, and optional project links saved with `reconcilePurchaseLinks(p,{suppressCreate:true})`; **never increases stock and never toggles purchase.inventoryApplied**. New Part creation checks duplicate part numbers and asks before same-name/vendor duplicate; created part starts stockQty=0/status Order. Previously credited purchase→Part mapping cannot be re-pointed from this screen without special reconciliation to avoid orphaned stock.
- `app-24-data-polish.js` (loads later, so earlier original function alone is INSUFFICIENT): the authoritative `applyPurchaseToInventory` now routes zero remaining or installed purchases to link-only, requires a Part link and explicit confirmation of positive physical receipt to credit; Purchase Reconcile allows zero On Hand without credit and opens link-only picker. Existing positive On Hand history reconciliation still credits as before; don't confuse a Purchase record for an existing Order receipt or double-count the same physical shipment.
- `tests/zero-stock-inventory.test.mjs` executes REAL production Parts, Orders, Purchases, Data Polish and Equipment reconciliation modules in a disposable VM. Checks creation with stock 0, linking purchase to existing part 0 without credit, linking an Order and showing qty on order 4 separate, partial receipt qty2, Order → create 0, Purchase → create 0, exact-PN duplicate prevention, explicit purchase receipt once and zero historical reconciliation. Full branch + PR test suite passed.
- **Owner device acceptance required**: if **Synced and no pending atomic journal**, load v5.19.38 and check footer. Create disposable Part stock=0, create Order qty=3 link Part, verify 0 On Hand/3 On Order before receipt; if user has imported purchase, Link Part (0 OK) does NOT add stock; receive only via the actual workflow used to receive physical delivery and avoid crediting same shipment through BOTH Orders and Purchases. Existing owner’s prior offline atomic operation was committed to Supabase; old tab's journal status still unknown. NEVER force a reload if that device reports pending/blocked journal.

## v5.19.37 protect pending atomic Work Logs (September 26)

- Owner's real offline Atomic Reserve → Use test created one pending journal with a NEW Work Log, then edited that Work Log's `work` field to append `Offline atomic test — used 1 washer.` while pending. `recoverLocal()` correctly rejected this divergent new record rather than inventing state. Owner uploaded pending safety JSON (exported 2026-09-26T21:21:39Z) containing exact journal payload plus edited local Work Log; preserve this file. The issue exposed that v5.19.36 permitted changing newly staged pending journal Work Logs.
- PR #15 merged at main `15760be4a2d119e8b0ef489ad9527cde6830663d`, branch `atomic-pending-log-lock-v5.19.37`. Branch CI `36273696625`, PR CI `36273763307` and main Pages deployment `36273794910` all succeeded. UI/code only; NO production Supabase aircraft record writes by ChatGPT.
- `app-66-atomic-receipt-outbox.js` exports `isPendingRecord(type,id)`, validates journal ownership/readability; unreadable/foreign journal fails closed for all Work Log editing. `app-09-logbook.js` displays prominent read-only pending banner; disables Edit, Add/Remove Consumed Item for precisely the locked log, and guards open/edit/save/delete/add/remove entrypoints (including forms opened prior to pending). `app-17a-data-store.js` forbids direct `trackerStore.write/update/remove('log',pendingId)`. Independent Work Logs remain editable and lock clears when acknowledgement removes pending journal.
- Backup-first escape hatch for legacy text-only drift from pre-v5.19.37: `System → Cloud Account → Atomic Inventory Testing → Backup and Restore Staged Work Log Text` shows ONLY when the newly staged pending log differs solely in text fields. It verifies identity, original null baseline and all other operation members in original/staged shape; downloads full pending safety JSON (including extra local notes), then requires user to explicitly CONFIRM file was saved before replacing only local log text with original staged journal data. Never changes journal/op ID or submits an RPC automatically. User must explicitly Retry Pending once; altered consumed quantities/IDs or other structural drift FAIL CLOSED and require supervised review. Do NOT use this if current browser reports Synced.
- `tests/atomic-consumption.test.mjs` now checks pending mutability lock, fail-closed local drift, backup-first recovery, no cloud RPC before explicit retry, structural-drift/cancel paths and post-ack unlock. `tests/atomic-pending-log-lock.test.mjs` loads production modules in VM to test UI and store guards, corrupt/foreign journals and text-only recovery button. Bumped index script version tags, APP_VERSION and service-worker cache to v5.19.37.
- **CRITICAL NEW CLOUD FACT:** A read-only Supabase check after PR merge verified that the OWNER'S SAME offline operation `e487cd51-ee32-4545-b4a6-aecfb177187e` WAS SUCCESSFULLY APPLIED at 2026-09-26T21:27:22Z, `replayed:false`, zero conflicts. Cloud now has TWO distinct test Work Logs (2 washers and 1 washer), Project with both `partsUsed` records and zero remaining reservations, Part `stockQty=4` (recorded original stock; calculated 1 physical on hand after 3 log-consumed units). Project and Part record_version 4 and new Log version 1. **DO NOT ask owner to re-consume the last washer or imply this cloud transaction remains unapplied.** The earlier failure snapshot and previous cloud query occurred BEFORE the owner's apparent correction/retry.
- Owner browser/local pending journal status has NOT been verified after cloud acknowledgement. The old tab may already say Synced. First ask user to check its status; if Synced and shows 1 On Hand / 0 Reserved / 3 Used / 2 Work Logs, then test passed and owner can safely update to v5.19.37. If old tab still says pending, keep safety file and DO NOT reload/clear site data; open Atomic Inventory Testing and review. The server has already recorded the operation ID idempotently, so retrying the **same queued operation** should replay without doubling physical consumption ONLY after verifying local staged records match; if blocked/conflicted, use Compare with Cloud Safely or supervised review, never stage another transaction. Once both desktop and phone agree, owner can add their saved extra offline-test note back to the synced Work Log.
- If user happens to load v5.19.37 before resolving a legacy divergent local journal, pending Work Log edit is blocked intentionally; use guided backup-first text-only restore on the original browser/device, then retry or exact-match review. Do not advise Force Latest with pending journal.

## v5.19.36 true runtime version footer (September 26)

- User reported STILL seeing `v5.19.32` even after visiting cache-busted root and v5.19.35 successful deployment. Inspection found the concrete root cause: `index.html` FOOTER WAS HARDCODED to `N594ZS Tracker v5.19.32 • Purchases metrics follow your filters …` despite actual canonical `const APP_VERSION='5.19.35'` in `app-01-seed.js` and successful GitHub Pages deployments. The footer's .32 did **not** prove the browser was loading .32. Previous guidance incorrectly assumed all .32 footer screenshots were stale app shells. We cannot remotely verify the exact browser's loaded code, but the hardcoded footer unequivocally misreported the version in the published source.
- Fix PR #14 merged at `ae8c748781cc76fb8e99f3e0bff146814c90a41d`; `index.html` footer now has `<span id="appVersionFooter">Version loading…</span>` and updates to the **actual loaded** `APP_VERSION` immediately after `app-01-seed.js` executes. Do not hardcode UI version strings again. If entry JS doesn't load, footer visibly says 'Version unavailable'. Set APP_VERSION/script query/SW cache to v5.19.36. Regression `tests/release-indicator.test.mjs` proves footer dynamically tracks running versions old, current and future, entry query matches canonical version, and rejects hardcoded version in footer. Branch CI `36269008068` and PR CI `36269057979` passed. Confirm main GitHub Pages Actions run `36269104653` after deploy.
- After v5.19.36 load, footer reliably tells which JS actually ran. If user still sees `v5.19.32`, ask to compare Settings → GitHub / Deployment App version, and evaluate tab cache/SW using browser site storage *without deleting local unsynced data*. If footer shows v5.19.36 but filters still reset, debug UI filter behavior separately from deployment/caching. Main v5.19.35 already persists Projects/Parts/Purchases filters per tab. No production Supabase data edits in this release.

## v5.19.35 persistent UI filters and improved Force Latest (September 26)

- User reported browser tab away/return or live refresh resets Projects status filter (e.g. Done) and Force Latest Version apparently does nothing. Root of filter issue: original `app-05-views.js` `renderProjects()` and `renderParts()` replace DOM with new blank filter controls on every rerender including Supabase live reload, losing user-selected filters.
- PR #13 merged at main `857d0c319615807b3efb76c195b7f1499a5c63e6`. Branch `sticky-filters-update-v5.19.35` full CI `36268215620`, PR CI `36268255396` passed. Changes UI scripts/tests only; **no production Supabase data modifications**.
- `app-05-views.js`: capture/restores Projects (search, status, system, priority) and Parts (search, system, status, inventory) via per-tab `sessionStorage` on every render and input/change. Retains selections across cloud refresh, switching pages and same-tab full refresh. Explicit dashboard quick links (e.g. Active projects) still intentionally override filters. Project sort state remains in memory.
- `app-25-multivendor.js`: existing Purchases vendor/search/date/system/disposition state now also persists in per-tab sessionStorage. Existing Orders page already saves order status in module state during same-tab rerenders; not modified here. Independent UI filter state is NOT synchronized to cloud or other devices.
- `app-19-pwa.js`: existing Force Latest function was not known definitively to fail on the owner's exact browser, but had no stage feedback and awaited SW/cache/network promises without timeouts. Now visible progress and actionable error, preserves pending-cloud safety, preflights latest published tracker HTML using no-store bounded fetch, performs best-effort time-bounded SW/cache cleanup and then cache-busting navigation. `app-05-views.js` Settings deployment card and `app-18-enhancements.js` System & Sync card both offer Force Latest and **native Fresh version** link opening the site's fresh query URL in a new tab when an old build's update button is inoperative. System app version now displays real `APP_VERSION` rather than stale v4.0. `app-19-pwa.js` script version tag bumped to v5.19.35 to avoid serving old cached updater.
- `tests/sticky-list-filters.test.mjs` exercises REAL project/parts renderers and dashboard quick link in disposable VM with shared sessionStorage; `tests/purchase-filtered-metrics.test.mjs` verifies purchase session state; `tests/app-update.test.mjs` verifies stalled SW, network timeout, invalid HTML, valid HTML with visible feedback, old pending cloud safety. Full CI passed.
- Owner acceptance: if old v5.19.32/34 update button doesn't react, make sure cloud says Synced, save typed form text, open `https://mtm951.github.io/N594ZS-Tracker/?forceUpdate=20260926-2005` in a NEW tab (or use native Fresh version link if available), and close old tab after new one loads and says Synced. New footer must read v5.19.35. Set Projects status Done, switch browser tab and return; filter must remain Done, also after other device cloud refresh. Test Purchases vendor Amazon retained after returning. If new v5.19.35 button still fails, visible feedback should reveal stage/reason. Do not assume old already-open tabs hot-swap JS.

## v5.19.34 stable popups and unsaved-form protection (September 26)

- Owner screenshot still displayed v5.19.32 after v5.19.33 was already deployed; old **already-open browser tabs do not hot-swap app code**, even though cloud *data* syncs live. Existing **System → GitHub / Deployment → Force Latest Version** safely checks pending cloud writes, clears old N594ZS caches/service workers, reloads with a cache-busting URL. Ensure status is Synced, not Conflict/Pending, before forcing an update. New version after release should be v5.19.34. Do not assume owner device has upgraded until checked.
- Owner reports modal popups unexpectedly/easily closing during entry (Project PTT example); root code had duplicate document-level Escape/backdrop dismissal listeners (app-03-core, app-15-init) and specialized app-35 backdrop and popstate guards **only** for order receiving, leaving Project/Purchase/other forms exposed.
- PR #12, merge SHA `48d2a907a0e18ed62eebeae553fff220a250166a`, reuses existing `app-35-navigation-ux.js` rather than adding another UI layer. All popups now ignore backdrop taps, blur focused inputs instead of closing on first Escape, guard entered input/select/textarea values and ask for confirmation before discarding via explicit X, in-app Back, Cancel or browser history Back; unsolicited history events while actively editing preserve popup. Existing save-success `closeModal()` remains automatic without a confirmation. Preserve old receipt popstate race protection. Existing duplicate Escape/backdrop handlers are intercepted by capture-phase handlers, not removed (fallback if navigation module absent).
- `tests/order-modal-navigation.test.mjs` updated with genuine new expected behavior: ordinary popup backdrop no longer closes, Project notes survive inadvertent Escape/popstate, dirty X/Back/Cancel require confirmation, confirmed exit closes, programmatic saves still close. Branch CI `36267184907` and PR CI `36267270672` succeeded. No production cloud data modifications; this release only changes UI JavaScript, version tags, service-worker shell.
- Acceptance: After Force Latest, verify footer v5.19.34; open PTT project/Edit fields, enter temporary notes (do **not** save), click outside the modal (must stay open), press Escape while field focused (must only blur), click X then choose Stay/Cancel (draft remains), finally click X and confirm discard (closes). Test same with Purchase and Order edits. Do not run Repair Safe Links if still on v5.19.32 truncated load; v5.19.33+ cloud loader is required.

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
