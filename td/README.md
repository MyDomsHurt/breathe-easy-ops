# Breathe-Easy Scheduler

Internal scheduling & operations viewer for **Breathe-Easy** (Hong Kong AC cleaning).

Built from the August 2026 Excel schedule. Clean jobs are distinguished from **returns** by an empty `ACs` field.

**Repo:** https://github.com/MyDomsHurt/breathe-easy-scheduler  
**Status:** UI is live. Full 389-job dataset is ready and will be added next (data payload is large for the current connector; UI code is complete).

## Features (MVP)

- Filter by week, team (Josh / Matthew / Tiago / Nick / Alun / Iggi), clean vs return, date
- Live search across client name, mobile, address, notes, invoice
- View by date or by team
- Revenue totals update with filters
- Job detail modal with full notes, payment, invoice info
- Mobile-friendly layout
- Rule: empty ACs column = Return

## Quick start (once data is in place)

```bash
npx serve .
# or
python3 -m http.server 8080
```

Open the URL it prints. The app must be served over HTTP (not `file://`) because it fetches JSON.

## Files

| Path | Purpose |
|------|--------|
| `index.html` | Main UI |
| `css/app.css` | Extra styles |
| `js/app.js` | Filtering, views, modal |
| `data/jobs.json` | *Coming next* — 389 cleaned jobs |

## Next steps

1. Add `data/jobs.json` (full August dataset already extracted and cleaned).
2. Optional: enable GitHub Pages for a live link you can open on your phone.
3. Iterate features: edit/reschedule, capacity view, client history, HubSpot link.

## Tech

Vanilla HTML + Tailwind CSS (CDN) + plain JS. No build step.

---

Breathe-Easy · August 2026
