# N594ZS Tracker

A local-first project, parts, purchasing, documentation, checklist, and work-history dashboard for **N594ZS**, a Kitfox Model 4-1050.

The tracker is built around deep, clickable records rather than shallow tables. Projects, parts, orders, work-log entries, documents, and checklists each open into detailed workspaces with linked records, notes, costs, blockers, next steps, attachments, and history.

## Current version

**v3.1** — dashboard drill-down and fully clickable navigation.

Dashboard metric cards and summary sections navigate directly to the relevant filtered records. Examples: High Priority opens active high-priority projects, Blocked / Held Up opens held-up projects, Open Orders opens active orders, inventory rows open part records, work entries open their detailed log records, and project rows open their individual workspaces.

## Data storage

Core records are stored locally in the browser. Uploaded files are stored in IndexedDB. The Settings page includes Core JSON and Full Backup options.

GitHub hosts and versions the application code; it does not by itself synchronize live aircraft data between devices. Multi-device sync will be a later backend feature.

## Safety / records note

N594ZS Tracker is a project-management aid. It does not replace required aircraft or engine logbook entries, manufacturer instructions, operating limitations, inspections, maintenance requirements, or required signoffs. A completion badge in the app is a project status, not an airworthiness determination.
