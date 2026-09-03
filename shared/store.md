# Shared job store

Source of truth for jobs. **`/schedule` is the writer. `/td` is not wired yet.**

- Scheduling App = **writer**
- Technician Dashboard = **reader**
- Records are canonical ([`job-model.md`](job-model.md))
- `time` is free-form. Do not reintroduce required slots.

Default adapter is **local** (memory + `localStorage` key `be-ops-jobs`). That is not the old Scheduling App key `be-scheduler-v2-roster`. Do not reuse the old key as the final store.

Firestore is a **stub** only. TD Firebase is Google auth, not the job store. Google Sheet roster backup comes later.

## Files

| File | Role |
| --- | --- |
| `store.js` | `createStore` — list / get / upsert / remove / subscribe |
| `store-local.js` | Memory + `be-ops-jobs` adapter (default) |
| `store-firestore.js` | Stub interface for a later jobs collection |
| `store-import.js` | Load schedule seed + TD JSON, normalise, merge by `job_id` |

## `createStore(options?)`

```js
import { createStore } from './store.js';

const store = createStore();        // local adapter
await store.ready;                  // needed if the adapter load is async
```

Options: `adapter`, `now` (timestamp factory), and local-adapter pass-through `persist`, `storage`, `storageKey`.

Swap later: `createStore({ adapter: createFirestoreAdapter() })`. The stub throws on load/save until a later slice implements it.

## Methods

| Method | Behaviour |
| --- | --- |
| `listJobs({ includeDeleted } = {})` | Canonical jobs. Soft-deleted rows are hidden unless `includeDeleted: true`. |
| `getJob(job_id)` | One job, including if it is soft-deleted. `null` if missing. |
| `upsertJob(input)` | `normalizeJob`, merge onto an existing id, set `updated_at`, persist, notify. Missing `job_id` is assigned. |
| `removeJob(job_id)` | Soft-delete: `deleted: true` (so sheet sync can follow later). |
| `removeJob(job_id, { hard: true })` | Drop the row. Only for matching old schedule cancel if a later wiring slice needs it. Default is soft-delete. |
| `importJobs(rawJobs)` | Bulk insert/merge. Skips rows with no `job_id` or no `client_name` (does not invent clients). |
| `subscribe(callback)` | Fires on local `load` / `upsert` / `remove` / `import`. Payload: `{ type, job, jobs, adapter }`. Returns unsubscribe. Remote adapters implement `subscribeRemote` so live snapshots can reuse this hook. |

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

## What this slice does not do

- Does not switch `/td` onto this store
- Does not implement Firestore
- Does not implement Google Sheet sync
- Does not change booking UX or TD UX
