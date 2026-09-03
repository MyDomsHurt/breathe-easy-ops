# Breathe-Easy Scheduler v2

Scheduler-first prototype for office booking. This is a **new repository** and is not the live ops viewer.

- Live viewer (do not change): https://github.com/MyDomsHurt/breathe-easy-scheduler
- This prototype: https://github.com/MyDomsHurt/breathe-easy-scheduler-v2

## What this is for

Answer “When can we do your ACs?” by reading a **team × day roster**, then book it.

The home view is a spreadsheet-style week board:

- Rows = teams (Josh, Matthew, Tiago, Nick, Alun, Iggi)
- Columns = days (Mon–Sat)
- Each cell is that team’s ordered appointments for the day (free-form times)
- Empty cells are clearly open; click **+ Add** (or the cell) to book that team + date
- Returns are hatched amber. Influencer jobs are dashed violet
- **+ New booking** opens the same form from anywhere

There are **no fixed time slots** and **no unit-capacity quotas**. Times stay free text, as in the Schedule Master.

## Seed data (real week)

The board is seeded from a real operational week taken from the Schedule Master:

- **17–22 August 2026**
- Dates, team leads, times, AC counts, job types, amounts and payment status are **real**
- Client names, mobiles and street addresses are **anonymised**
- Source files: `data/day-2026-08-17.json` … `data/day-2026-08-22.json`

## Run locally

Serve the **ops repo root** over HTTP (this app imports `../shared/`):

```bash
python3 -m http.server 8080
```

Open http://localhost:8080/schedule/ and sign in with an allowlisted Google account. Writes go to Firestore. Use **Import existing jobs** once if you need the archive copied up; it does not run on boot.

## Prototype notes

- Job shape matches the live viewer (`date`, `time`, `team_lead`, `client_name`, `mobile`, `address`, `district`, `acs`, `amount`, `payment`, `is_return`, plus `job_type`).
- Click a job to open details, then **Edit / move** or **Cancel job**.
- New and edited bookings persist in the shared job store (`be-ops-jobs`). Use **Reset demo data** to go back to the seed week.
- The board loads `data/week-2026-08-17.json` first (108 jobs) so a missing day file cannot empty the view.
- Booking time is free-form. Team suggestion uses how busy that day already is and district clustering — never a hard block.
- A soft warning appears if the typed time is close to another job on the same team-day.
- No Google auth in this pass.
- Stack is vanilla HTML / CSS / JS. No build step.

## Next

- Shared backend instead of localStorage
- Import additional weeks / rolling live feed
- Edit / move jobs on the roster
- Auth and technician day view
