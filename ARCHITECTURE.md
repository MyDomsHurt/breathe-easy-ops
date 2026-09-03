# Architecture (constraints for later work)

This file is a fence, not a design of the next slice. `/schedule` writes canonical jobs through [`shared/store.js`](shared/store.js). `/td` reads the same store when signed in (Firestore). Local adapter is fallback only.

## One product, two faces

- **Scheduling App** (`/schedule`) — office places, edits, moves, and deletes bookings.
- **Technician Dashboard** (`/td`) — technicians view their jobs and performance.

They must share **one job record**. Do not grow two incompatible shapes.

## Writer / reader

- Scheduling App is the **writer**.
- Technician Dashboard is the **reader**.
- [`shared/store.js`](shared/store.js) is the **source of truth**. See [`shared/store.md`](shared/store.md) and [`FIRESTORE.md`](FIRESTORE.md).
- **Live adapter:** Firestore collection `jobs` on project `breathe-easy-performance`, when Firebase is initialised and an allowlisted user is signed in.
- **Fallback adapter:** local `be-ops-jobs`. Do not reuse `be-scheduler-v2-roster`.
- `/td` reads Firestore after sign-in (`onSnapshot`). If Firestore is empty it falls back to `jobs.json` and does not upload the archive.
- Google Sheet roster backup comes later. The sheet is not the live database.
- Firebase Auth on `/td` and `/schedule` is the existing Google allowlist. It is not a new user system.

## Job record must still render as the office master sheet

A later off-repo Google Sheet backup must stay possible, in the existing master-roster format. Do not invent a job shape that cannot be laid out as:

- **Week tabs**
- **Team rows**
- **Day columns**
- **Vertical job strips** inside each team-day cell

Each strip must still be able to carry:

| Sheet field | Typical record field |
| --- | --- |
| Name | `client_name` |
| Time | `time` (free-form text, not a fixed slot) |
| Mobile | `mobile` |
| Address | `address` |
| ACs | `acs` (empty ACs = return) |
| Notes | `notes` |
| Amount | `amount` |
| Invoice | `invoice` |
| Receipt | `receipt` |
| Payment | `payment` |

Also keep the fields both UIs already use to place a job on that grid: `date`, `week`, `team_lead`, `team_members`, `district`, `job_type` / `is_return`.

Canonical record: [`shared/job-model.md`](shared/job-model.md) and mapper [`shared/job.js`](shared/job.js). `/schedule` writes it; `/td` reads it when Firestore has jobs.
Old snapshots: `schedule/data/job-shape.json`, `td/data/jobs.json`.

## Out of scope until a later prompt

- Google Sheet sync
- Merging the two front-ends onto one page
- Changing booking UX or TD card UX
- Auto-migrating the historical archive on every page load
