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

The Scheduling App imports `../shared/`, so serve the **repo root**:

```bash
python3 -m http.server 8080
```

- Scheduling App: http://localhost:8080/schedule/
- Technician Dashboard: http://localhost:8080/td/

`/td` can still be served on its own (`cd td && python3 -m http.server 8081`) because it does not import `shared/` yet.

## What is not connected yet

- Scheduling App writes canonical jobs through [`shared/store.js`](shared/store.js) (`localStorage` key `be-ops-jobs`). The old `be-scheduler-v2-roster` key is unused.
- Technician Dashboard still reads static `td/data/jobs.json` (and sequential `jobs_part_*.json` via `manifest.json`).
- A booking made in `/schedule` does **not** appear in `/td` yet.
- Firebase in `/td` is the existing Google sign-in (and dashboard) wiring. It is **not** the live job store.

## Job record and store

The canonical job both faces will share later is defined in [`shared/job-model.md`](shared/job-model.md). [`shared/job.js`](shared/job.js) maps today’s `/schedule` and `/td` jobs into that shape.

[`shared/store.js`](shared/store.js) is the source of truth for Scheduling App writes (local adapter by default; Firestore stub). See [`shared/store.md`](shared/store.md). `/td` does not read it yet. Booking UX and TD UX are unchanged.

## Next work

1. **Wire TD as the reader** of the same canonical jobs.
2. **Google Sheet roster backup later** — off-repo, in the existing master-roster format. That backup must stay possible. Do not design a job shape the sheet cannot render.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the constraints that future work must keep.

## What this repo is not (yet)

- Not a merged single-page UI
- Not a database cutover
- Not Google Sheet sync
- Not a rewrite of either app’s UX
