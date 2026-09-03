# Breathe-Easy Ops

Integrated ops repo for **Breathe-Easy**. Two faces of one product. Live jobs live in Firestore when you are signed in.

| Path | Face | What it is today |
| --- | --- | --- |
| [`/schedule`](schedule/) | Office Scheduling App | Place, edit, move, and delete bookings. Board + booking drawer. |
| [`/td`](td/) | Technician Dashboard | Google-auth technician viewer of jobs, plus the Performance link. |

Do **not** treat `localStorage` or static `jobs.json` as the final source of truth. Those are fallbacks. The live store is Firestore collection `jobs` (see [`FIRESTORE.md`](FIRESTORE.md)).

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

Serve the repo root for live Firestore (both apps import `shared/`).

## Live store

- Scheduling App: Google allowlist sign-in, then writes to Firestore via [`shared/store.js`](shared/store.js).
- Technician Dashboard: after sign-in, reads the same `jobs` collection and subscribes to snapshots.
- If Firestore is empty, TD still shows `jobs.json` so the board is not blank. It does **not** upload that archive on boot.
- One-time copy of seed + archive: **Import existing jobs** in `/schedule` (signed in). Do not run it on every load.
- Local adapter (`be-ops-jobs`) is offline / fallback only.

Publish [`firestore.rules`](firestore.rules) in the Firebase console. Steps: [`FIRESTORE.md`](FIRESTORE.md).

Netlify:

- [breathe-easy-dashboard](https://breathe-easy-dashboard.netlify.app/) publishes **`td/` only** (committed `netlify.toml`). Do not publish the repo root there.
- [breathe-easy-schedule](https://breathe-easy-schedule.netlify.app/) publishes **`schedule/` only**, with `shared/` copied into that tree. Add this host in Firebase authorized domains if Google sign-in is blocked.

## Job record and store

The canonical job both faces will share later is defined in [`shared/job-model.md`](shared/job-model.md). [`shared/job.js`](shared/job.js) maps today’s `/schedule` and `/td` jobs into that shape.

[`shared/store.js`](shared/store.js) prefers Firestore when an allowlisted user is signed in. See [`shared/store.md`](shared/store.md). Booking UX and TD cards are unchanged.

## Next work

1. **Google Sheet roster backup later** — off-repo, in the existing master-roster format. That backup must stay possible.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the constraints that future work must keep.

## What this repo is not (yet)

- Not a merged single-page UI
- Not Google Sheet sync
- Not a rewrite of either app’s UX
