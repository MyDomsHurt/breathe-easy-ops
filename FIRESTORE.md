# Firestore live job store

Project: **breathe-easy-performance** (existing). Collection: **`jobs`**. Document id: **`job_id`**.

`/schedule` writes canonical jobs. `/td` reads the same collection via `onSnapshot`. The Google Sheet is not the live database.

## Deploy rules (console — not from the app)

1. Open [Firebase console](https://console.firebase.google.com/) → project **breathe-easy-performance**.
2. Build → **Firestore Database**. Create the database if it does not exist (production mode).
3. **Rules** tab. Paste [`firestore.rules`](firestore.rules) and **Publish**:

```
match /jobs/{jobId} {
  allow read, write: if request.auth != null;
}
```

4. **Authentication** → Settings → **Authorized domains**. Include:
   - `localhost`
   - your GitHub Pages host (e.g. `mydomshurt.github.io`)
   - any Netlify host you use for this ops repo
5. Enable **Google** sign-in if it is not already on (TD already uses it).

Do not deploy a service account or private key into this repo. The web config in `shared/firebase-config.js` / `td/js/auth.js` is the existing client key.

## First jobs

Boot does **not** upload the 2710-job archive.

1. Sign in to `/schedule` with an allowlisted Google account.
2. Create bookings as usual — each save writes one Firestore document.
3. To copy current seed + TD archive **once**, click **Import existing jobs** and confirm. Do not run that on every computer.

If Firestore is empty, `/td` keeps showing `jobs.json` so technicians are not looking at a blank screen. As soon as live jobs exist, TD uses Firestore and updates from snapshots.

## Local fallback

If Firebase is missing, rules are unpublished, or nobody is signed in, `shared/store.js` uses the local adapter (`be-ops-jobs`). That is offline / preview only.

`/td` on `localhost` still uses the existing preview bypass (`local@preview`) and `jobs.json`. Sign in on a deployed host (or with Google on a non-local hostname) to read Firestore.
