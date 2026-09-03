# Architecture (constraints for later work)

This file is a fence, not a design of the next slice. `/schedule` and `/td` still run as separate apps with their current stores.

## One product, two faces

- **Scheduling App** (`/schedule`) — office places, edits, moves, and deletes bookings.
- **Technician Dashboard** (`/td`) — technicians view their jobs and performance.

They must share **one job record**. Do not grow two incompatible shapes.

## Writer / reader

- Scheduling App is the **writer**.
- Technician Dashboard is the **reader**.
- A later shared live job store is the source of truth. `localStorage` and static `jobs.json` are prototypes only.

Firebase already present in `/td` is for Google auth (and the existing Performance dashboard). Do not treat it as the live job store unless a later slice explicitly chooses that.

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

Canonical record (not wired into either app yet): [`shared/job-model.md`](shared/job-model.md) and mapper [`shared/job.js`](shared/job.js).
Old snapshots: `schedule/data/job-shape.json`, `td/data/jobs.json`.

## Out of scope until a later prompt

- Shared live store implementation
- Google Sheet sync
- Merging the two front-ends onto one page
- Changing booking UX or TD UX
