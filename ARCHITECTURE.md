# Architecture (constraints for later work)

This file is a fence, not a design of the next slice. `/schedule` and `/td` still run as separate apps with their current stores. They are **not wired** to the shared store yet.

## One product, two faces

- **Scheduling App** (`/schedule`) — office places, edits, moves, and deletes bookings.
- **Technician Dashboard** (`/td`) — technicians view their jobs and performance.

They must share **one job record**. Do not grow two incompatible shapes.

## Writer / reader

- Scheduling App is the **writer**.
- Technician Dashboard is the **reader**.
- [`shared/store.js`](shared/store.js) is the **future source of truth** (canonical jobs, list/get/upsert/remove/subscribe). See [`shared/store.md`](shared/store.md).
- Current default adapter is **local**: in-memory plus `localStorage` key `be-ops-jobs`. Do not reuse the old Scheduling App key `be-scheduler-v2-roster` as the final store.
- App-level `localStorage` (schedule) and static `jobs.json` (TD) are still what the UIs use today. They are prototypes only.
- Firestore adapter is a **stub**. Google Sheet roster backup comes later.
- Firebase already present in `/td` is for Google auth (and the existing Performance dashboard). It is **not** the live job store.

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

- Wiring `/schedule` and `/td` onto `shared/store.js`
- Implementing the Firestore jobs collection
- Google Sheet sync
- Merging the two front-ends onto one page
- Changing booking UX or TD UX
