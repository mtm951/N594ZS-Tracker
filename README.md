# N594ZS Tracker

A shared project, parts, maintenance, documentation, discrepancy, and work-history workspace for **N594ZS**, a Kitfox Model 4-1050 with a Rotax 912 ULS.

Live app: **https://mtm951.github.io/N594ZS-Tracker/**

## Current version

**v4.1** adds an aircraft-oriented workflow on top of the v4 shared-cloud foundation.

### Aircraft workflow

- **Readiness** view with Installation/Build, Before Engine Start, Ground Test, Before Flight, Return-to-Service, and Later/Optional phases.
- Project dependencies, Focus Today, definition-of-done/verification notes, blockers, orders, files, and linked work.
- **Step-by-step task checklist inside every project**, with ordered steps, per-step notes, completion tracking, and optional automatic project-progress calculation.
- **Squawks** for discrepancies, severity/status, linked corrective projects, resolution history, and shared photos/files.
- **Runs / Tests** for structured engine-run, ground/taxi-test, and flight-test observations with recorded indications and attachments.
- Recurring date/hour **Maintenance** tracking.
- Shared project/part/order/work/document/checklist attachments plus a general shared **Files** library.

### Shared cloud foundation

- Supabase authentication and role-based access (Owner / Editor / Viewer).
- Record-level cloud sync across signed-in devices.
- Private shared file storage.
- Activity history, Trash/restore, snapshots/backups, global search, sync/offline status, and PWA installation support.
- GitHub Pages hosts the app; GitHub Actions validates JavaScript syntax before deployment.

## Storage model

Tracker records sync through Supabase as individual cloud records. Local browser storage remains a working cache/offline fallback. Photos, PDFs, screenshots, receipts, manuals, and other uploaded files are stored in private Supabase Storage and are available on any authorized signed-in device.

## Safety / records note

N594ZS Tracker is a project-management and record-organization aid. It does not itself establish airworthiness, replace required aircraft or engine logbook entries, substitute for current manufacturer instructions or operating limitations, satisfy required inspections, or replace required maintenance approvals/signoffs. A project gate or checklist status reflects tracker state only.
