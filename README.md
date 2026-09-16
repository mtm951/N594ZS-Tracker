# N594ZS Tracker

A shared project, parts, purchasing, documentation, maintenance, checklist, file, and work-history dashboard for **N594ZS**, a Kitfox Model 4-1050.

## Current version

**v4.0** — persistent multi-device cloud workspace.

The app is hosted on GitHub Pages and uses Supabase for authentication, shared record storage, realtime updates, private file storage, activity history, role-based access, Trash/restore, and point-in-time cloud snapshots.

## Major features

- Deep clickable project, part, order, work-log, document, checklist, and aircraft records
- Record-level cloud sync across signed-in devices
- Private shared file library plus per-record photos/PDFs/screenshots/receipts
- Aircraft photo stored in shared cloud storage
- Maintenance page for recurring date/hour items and return-to-service gates
- Activity history showing what changed and when
- Trash/restore workflow
- Owner / Editor / Viewer access controls
- Global tracker search
- Manual and automatic daily cloud snapshots
- System/sync health page and JSON export
- Installable/offline-capable Progressive Web App shell
- Local browser cache remains available as an offline fallback

## Hosting and data

Application code is versioned in this GitHub repository and deployed with GitHub Pages. Live tracker data is stored in Supabase. Uploaded files are stored in the private `n594zs-files` Supabase Storage bucket and are available to authorized signed-in users on any device.

## Safety / records note

N594ZS Tracker is a project-management aid. It does not replace required aircraft or engine logbook entries, manufacturer instructions, operating limitations, inspections, maintenance requirements, or required signoffs. A completion badge in the app is a project status, not an airworthiness determination.
