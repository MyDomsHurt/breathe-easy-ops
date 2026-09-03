# Shared job store

Source of truth for jobs. **`/schedule` is the writer. `/td` is the reader.**

- Records are canonical ([`job-model.md`](job-model.md))
- `time` is free-form. Do not reintroduce required slots.
- **Live:** Firestore `jobs` on `breathe-easy-performance` when an allowlisted user is signed in.
- **Fallback:** local `be-ops-jobs`. Not `be-scheduler-v2-roster`.
- Rules and console steps: [`../FIRESTORE.md`](../FIRESTORE.md).

## Files

| File | Role |
| --- | --- |
| `store.js` | `createStore` — list / get / upsert / remove / subscribe |
| `store-local.js` | Memory + `be-ops-jobs` (offline / fallback) |
| `store-firestore.js` | Live collection `jobs`, per-document writes + `onSnapshot` |
| `store-import.js` | Explicit import of seed + TD JSON (never on boot) |
| `firebase-config.js` | Existing web config + allowlist |

## `createStore(options?)`

```js
import { createStore } from './store.js';

const store = createStore({ user }); // Firestore if signed in, else local
await store.ready;
```

Options: `adapter`, `user`, `now`, and local-adapter `persist` / `storage` / `storageKey`.

## Methods

| Method | Behaviour |
| --- | --- |
| `listJobs({ includeDeleted } = {})` | Canonical jobs. Soft-deleted rows are hidden unless `includeDeleted: true`. |
| `getJob(job_id)` | One job, including if it is soft-deleted. `null` if missing. |
| `upsertJob(input)` | `normalizeJob`, merge onto an existing id, set `updated_at`, persist, notify. Missing `job_id` is assigned. |
| `removeJob(job_id)` | Soft-delete: `deleted: true` (so sheet sync can follow later). |
| `removeJob(job_id, { hard: true })` | Drop the row. Only for matching old schedule cancel if a later wiring slice needs it. Default is soft-delete. |
| `importJobs(rawJobs)` | Bulk insert/merge. Skips rows with no `job_id` or no `client_name` (does not invent clients). |
| `subscribe(callback)` | Fires on `load` / `upsert` / `remove` / `import` / `remote`. Firestore `onSnapshot` arrives as `remote` so TD updates without a manual refresh. |

## Import existing jobs

```js
import { combineExistingJobs, loadExistingCanonicalJobs, seedStore } from './store.js';

const { jobs, stats } = combineExistingJobs(scheduleRows, tdRows);
store.importJobs(jobs);

// From the repo files (serve the repo root over HTTP):
await seedStore(store, { baseUrl: '/' });
```

Sources:

- Schedule seed: `schedule/data/week-2026-08-17.json` via `fromScheduleJob`
- TD: `td/data/manifest.json` → `jobs_part_*.json`, else `td/data/jobs.json`, via `fromTdJob`

Same `job_id` is not duplicated. The richer record wins on conflicts; empty fields are filled from the other so TD-only (`payment_status`, `month`) and schedule-only (`status`, `stack_order`, `source`) both remain.

## Example record in the store

```json
{
  "job_id": "2026-08-19-josh-1",
  "date": "2026-08-19",
  "time": "09.00am => 10.45am",
  "team_lead": "Josh",
  "client_name": "Priya Shah",
  "deleted": false,
  "updated_at": "2026-09-03T04:00:00.000Z"
}
```

Full field list: [`job-model.md`](job-model.md). Sheet strip: Name / Time / Mobile / Address / ACs / Notes / Amount / Invoice / Receipt / Payment.

Boot never mass-uploads. Click **Import existing jobs** in `/schedule` (signed in) for a one-time copy.

## What this slice does not do

- Does not use Google Sheet as the live database
- Does not auto-migrate the archive on every page load
- Does not change booking UX or TD cards
