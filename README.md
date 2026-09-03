# Breathe-Easy Ops

Integrated ops repo for **Breathe-Easy**. Two faces of one product, parked together. They are **not data-connected yet**.

| Path | Face | What it is today |
| --- | --- | --- |
| [`/schedule`](schedule/) | Office Scheduling App | Place, edit, move, and delete bookings. Board + booking drawer. |
| [`/td`](td/) | Technician Dashboard | Google-auth technician viewer of jobs, plus the Performance link. |

Do **not** treat `localStorage` (Scheduling App) or static `jobs.json` (Technician Dashboard) as the final source of truth.

## What this pass is

This repo copies the two existing apps **without changing their behaviour**.

- `/schedule` is a byte-for-byte copy of [breathe-easy-scheduler-v2](https://github.com/MyDomsHurt/breathe-easy-scheduler-v2) at `786aae0`.
- `/td` is a byte-for-byte copy of [breathe-easy-scheduler](https://github.com/MyDomsHurt/breathe-easy-scheduler) at `99bbe13`.

Those source repos stay as they are. This is the new home for integrated work.

## Run each app on its own

Both sides are vanilla HTML / CSS / JS. Serve over HTTP (not `file://`).

Scheduling App:

```bash
cd schedule
python3 -m http.server 8080
```

Open http://localhost:8080

Technician Dashboard:

```bash
cd td
python3 -m http.server 8081
```

Open http://localhost:8081

Or serve the repo root and open `/schedule/` and `/td/`. Relative paths inside each app are unchanged.

## What is not connected yet

- Scheduling App writes stay in browser `localStorage`.
- Technician Dashboard reads static `td/data/jobs.json` (and sequential `jobs_part_*.json` via `manifest.json`).
- A booking made in `/schedule` does **not** appear in `/td`.
- Firebase in `/td` is the existing Google sign-in (and dashboard) wiring. It is **not** the live job store.

## Job record and store

The canonical job both faces will share later is defined in [`shared/job-model.md`](shared/job-model.md). [`shared/job.js`](shared/job.js) maps today’s `/schedule` and `/td` jobs into that shape.

[`shared/store.js`](shared/store.js) is the **future source of truth** (local adapter by default; Firestore stub; import helper for existing jobs). See [`shared/store.md`](shared/store.md).

Neither app imports these modules yet. Booking UX and TD UX are unchanged.

## Next work

1. **Wire the store** — Scheduling App writes; Technician Dashboard reads the same canonical jobs.
2. **Google Sheet roster backup later** — off-repo, in the existing master-roster format. That backup must stay possible. Do not design a job shape the sheet cannot render.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the constraints that future work must keep.

## What this repo is not (yet)

- Not a merged single-page UI
- Not a database cutover
- Not Google Sheet sync
- Not a rewrite of either app’s UX
