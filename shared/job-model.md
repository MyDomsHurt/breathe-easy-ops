# Canonical job record

One job shape both faces will share. **`/schedule` writes it through `shared/store.js`. `/td` does not read it yet.**

- `/schedule` persists canonical jobs in `be-ops-jobs`
- `/td` still reads `td/data/jobs.json` / `jobs_part_*.json`
- This file is the contract. `shared/job.js` maps today’s records into it.

Do not treat `localStorage` or static `jobs.json` as the final source of truth.

## Sheet constraint

A later off-repo Google Sheet backup must stay possible in the office master-roster layout:

- **Week tabs**
- **Team rows**
- **Day columns**
- **Vertical job strips** in each team-day cell

Each strip is this record, not a different object:

| Sheet column | Canonical field |
| --- | --- |
| Name | `client_name` |
| Time | `time` (free-form text — never a required fixed slot) |
| Mobile | `mobile` |
| Address | `address` |
| ACs | `acs` (empty when `job_type` is `return`) |
| Notes | `notes` |
| Amount | `amount` |
| Invoice | `invoice` |
| Receipt | `receipt` |
| Payment | `payment` |

Placement on that grid also needs `date`, `week` (optional/derived), `team_lead`, `team_members`, `district`, `job_type` / `is_return`, and `stack_order` (order inside the cell).

## Canonical fields

| Field | Core | Type | Meaning |
| --- | --- | --- | --- |
| `job_id` | yes | string | Stable id. Keep the existing id when mapping old jobs. |
| `date` | yes | `YYYY-MM-DD` | Day of the job. |
| `time` | yes | string | Free-form. Empty string if unknown. Never a required `morning`/`afternoon` slot. |
| `team_lead` | yes | string | Row on the week board (Josh, Matthew, Tiago, Nick, Alun, Iggi). |
| `team_members` | optional | string \| null | Who is on the van that day. |
| `client_name` | yes | string | Sheet **Name**. |
| `mobile` | yes | string \| null | Sheet **Mobile**. |
| `address` | yes | string \| null | Sheet **Address**. |
| `district` | yes | string \| null | Area code (`HKN`, `KLN`, `N-T`, …). |
| `acs` | yes | string \| null | Unit label (`3S`, `1S 2W`). Empty / missing means return **when** `job_type` is `return`. Do not infer return from empty ACs if `job_type` is already `cleaning` or `influencer`. |
| `notes` | yes | string \| null | Sheet **Notes**. |
| `amount` | yes | number \| null | Sheet **Amount**. `0` is allowed (free / influencer). |
| `invoice` | yes | string \| null | Sheet **Invoice**. |
| `receipt` | yes | string \| null | Sheet **Receipt**. |
| `payment` | yes | string \| null | Sheet **Payment** — method (`FPS`, `Payme`, `BT`, …). |
| `payment_status` | optional | `PAID` \| `UNPAID` \| null | From TD. Not the same as `payment`. |
| `job_type` | yes | `cleaning` \| `return` \| `influencer` | |
| `is_return` | yes | boolean | Always `job_type === 'return'`. |
| `status` | yes | `confirmed` \| `tentative` | Office booking state. TD has no equivalent today → `confirmed`. |
| `stack_order` | yes | number \| null | Staff-controlled order inside a team-day. Missing → `null` (UI may fall back to time). |
| `week` | optional | number \| null | Derived from `date` if missing. Keep an incoming value. |
| `month` | optional | number \| null | Calendar month `1–12`. Derived from `date` if missing. |
| `updated_at` | yes | ISO timestamp \| null | For later sync. Do not stamp “now” unless the caller asks. |
| `deleted` | yes | boolean | Default `false` so later deletes can sync without disappearing locally first. |

### Legacy — map, do not require

| Field | Type | Meaning |
| --- | --- | --- |
| `slot` | string \| null | Old v2 capacity leftover (`morning` / `afternoon`). Present on `schedule/data/job-shape.json`, not on live seed jobs. Map if present. Not used to infer `time`. |
| `source` | string \| null | Schedule seed tag (`schedule-master-2026-08-17`) or later writer tag. Keep if present. |

Unknown keys on an old record are copied through so nothing is dropped.

## What each face uses today

### Scheduling App (`/schedule`)

Writer of bookings. Board, booking drawer, job modal.

| Uses | Fields |
| --- | --- |
| Place on the board | `date`, `team_lead`, `time`, `stack_order`, `status` |
| Strip / search / modal | `client_name`, `mobile`, `address`, `district`, `acs`, `notes`, `amount`, `invoice`, `receipt`, `payment`, `job_type`, `is_return`, `team_members`, `job_id` |
| Derived on save | `week` |
| Seed-only extra | `source` |
| Example leftover | `slot` in `schedule/data/job-shape.json` |
| Booking form only | `units` `{S,W,B,…}` — collapsed to `acs` on save. Not a stored field. |

Does **not** have `payment_status` or `month` on live jobs.

### Technician Dashboard (`/td`)

Reader of jobs. Filters, list, job modal, Performance link.

| Uses | Fields |
| --- | --- |
| Filters | `date`, `month`, `team_lead`, `is_return`, search over name/mobile/address/notes/invoice |
| Card / modal | `client_name`, `time`, `acs`, `address`, `mobile`, `district`, `notes`, `job_id`, `team_members` |
| Paid / unpaid | `payment_status`, fallback: receipt present → paid |
| Type | `job_type` on live data; UI still treats `is_return` as the return flag |
| Live extras vs schedule | `month`, `payment_status` |

Does **not** have `status`, `stack_order`, `slot`, or `source`. Live `td/data/jobs.json` has no `week`. The tiny `jobs-sample.json` has a leftover `week: 1` that is **not** the calendar week — keep it if present; do not treat it as the derived week rule.

## Mapping from old schedule jobs

Sources: `schedule/data/week-*.json`, `day-*.json`, `job-shape.json`, `js/week-data.js`, and `localStorage` extras/overrides.

| Old field | Canonical |
| --- | --- |
| `job_id`, `date`, `time`, `team_lead`, `team_members` | copy |
| `client_name`, `mobile`, `address`, `district` | copy |
| `acs`, `notes`, `amount`, `invoice`, `receipt` | copy |
| `payment` | copy (`Unpaid` stays in `payment`; see status below) |
| `job_type` | copy if `cleaning` \| `return` \| `influencer`; else infer from `is_return`, then notes containing “influencer”, else `cleaning` |
| `is_return` | set from canonical `job_type` |
| `status` | `tentative` only if already that; else `confirmed` |
| `stack_order` | number if present; else `null` |
| `week` | keep if present; else derive from `date` (same helper as `schedule/js/utils.js` `weekNumber`) |
| `month` | derive from `date` |
| `payment_status` | not on schedule jobs. If `payment` is `Unpaid`/`UNPAID` → `UNPAID`. Else if `receipt` is non-empty → `PAID`. Else `null` |
| `slot` | copy if present; do not invent |
| `source` | copy if present |
| `units` | if `acs` missing, build the `acs` label from unit counts |
| `updated_at` | keep if present; else `null` unless caller passes `now` |
| `deleted` | keep if present; else `false` |

`time` stays the original string (`09.00am => 10.45am`, `02.30pm`, `""`). Do not convert it into `slot`.

## Mapping from old TD jobs

Sources: `td/data/jobs.json`, `jobs_part_*.json`, `jobs-sample.json`.

| Old field | Canonical |
| --- | --- |
| `job_id`, `date`, `time`, `team_lead`, `team_members` | copy |
| `client_name`, `mobile`, `address`, `district` | copy |
| `acs`, `notes`, `amount`, `invoice`, `receipt`, `payment` | copy |
| `payment_status` | upper-case `PAID` / `UNPAID` if present |
| `job_type` | copy if valid; `jobs-sample.json` may omit it — infer (return flag, then “influencer” in notes, else cleaning) |
| `is_return` | set from canonical `job_type` |
| `month` | keep if present; else derive from `date` |
| `week` | keep if present (including the sample leftover); else derive from `date` |
| `status` | `confirmed` |
| `stack_order` | `null` |
| `slot` | `null` unless present |
| `updated_at` | keep if present; else `null` unless caller passes `now` |
| `deleted` | `false` unless present |

## Example

```json
{
  "job_id": "2026-08-19-josh-1",
  "date": "2026-08-19",
  "time": "09.00am => 10.45am",
  "team_lead": "Josh",
  "team_members": "Josh + James",
  "client_name": "Priya Shah",
  "mobile": "9881 2204",
  "address": "Flat 12, 5/F, 88 Queens Road East, Wan Chai",
  "district": "HKN",
  "acs": "3S",
  "notes": null,
  "amount": 1740,
  "invoice": "Inv 5448",
  "receipt": "Inv 5448",
  "payment": "Payme",
  "payment_status": "PAID",
  "job_type": "cleaning",
  "is_return": false,
  "status": "confirmed",
  "stack_order": null,
  "week": 34,
  "month": 8,
  "updated_at": null,
  "deleted": false,
  "slot": null,
  "source": null
}
```

## What this slice does not do

- Does not switch `/td` onto this record
- Does not sync Google Sheets
- Does not change booking UX or TD UX

The store that holds these records is [`store.js`](store.js) (see [`store.md`](store.md)). `/schedule` writes it; `/td` does not read it yet.
