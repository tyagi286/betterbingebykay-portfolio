# Better Binge by Kay — GitHub Pages setup

Your portfolio now runs as a plain static site (`index.html` + `css/` + `js/`)
instead of a Google Apps Script web app. Same look, same "just add photos to
a Drive folder" workflow — it just runs in the visitor's browser instead of
on Google's servers.

## Why an API key is now needed

Apps Script could read your Drive folders directly because it ran *as you*,
on Google's own servers. A static GitHub Pages site has no server at all —
the page itself, sitting in someone's browser, has to ask Google "what's in
this folder?" For that, Google requires a (free) API key. This is a one-time
setup, and photos still update automatically after that — you just add or
remove them in Drive like before.

---

## Step 1 — Get your files into a GitHub repo

1. Create a free GitHub account if you don't have one: https://github.com/signup
2. Click **New repository** (top right → the `+` icon).
   - Name it whatever you like, e.g. `better-binge-portfolio`.
   - Set it to **Public** (required for free GitHub Pages).
   - Don't add a README/gitignore — you already have files to upload.
3. On the new repo page, click **uploading an existing file**, and drag in:
   - `index.html`
   - the whole `css/` folder
   - the whole `js/` folder
   - `README.md`
4. Commit the files (green **Commit changes** button).

*(If you're comfortable with git/command line, `git init`, `git remote add origin ...`,
`git push` works the same way — the file layout doesn't change.)*

## Step 2 — Get a free Google Drive API key

1. Go to https://console.cloud.google.com/ and sign in with the same Google
   account your Drive folders live in.
2. Top left → **Select a project** → **New Project**. Name it anything
   (e.g. "Better Binge Site") → **Create**.
3. With that project selected, go to **APIs & Services → Library**, search
   for **Google Drive API**, open it, click **Enable**.
4. Go to **APIs & Services → Credentials** → **Create Credentials** →
   **API key**. Copy the key it gives you.
5. Click **Edit API key** (or find it in the credentials list and edit it) to
   restrict it — this keeps it safe to put in public code:
   - **Application restrictions** → **Websites** → add:
     `https://YOUR-GITHUB-USERNAME.github.io/*`
     (and `http://localhost/*` too, if you want to test locally first)
   - **API restrictions** → **Restrict key** → select **Google Drive API**.
   - Save.
6. Open `js/config.js` in your repo and replace:
   ```js
   driveApiKey: 'PASTE_YOUR_DRIVE_API_KEY_HERE',
   ```
   with your actual key.

The free quota (1 billion requests/day for `files.list`) is far more than a
small portfolio site will ever use, so there's no cost here.

## Step 3 — Make sure your Drive folders are public

Same as before: each folder (Packaging, the 4 tiers, Hampers, and the logo
file) needs **Share → General access → Anyone with the link → Viewer**.
This was already required for the old Apps Script version, so if it worked
there, it'll work here.

## Step 4 — Turn on GitHub Pages

1. In your repo, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Under **Branch**, choose `main` and folder `/ (root)` → **Save**.
4. Wait ~1 minute, then refresh — GitHub shows your live URL, something like:
   `https://YOUR-GITHUB-USERNAME.github.io/better-binge-portfolio/`

That URL is now your permanent link — share it directly, or run it through
a shortener once, same as you did with the old Apps Script URL.

## Updating the site later

- **Add/remove photos** → just edit the Drive folder. No code changes, no
  redeploy — the site reads the folder live every time someone visits.
- **Change prices, notes, names, folder IDs** → edit `js/config.js` in
  GitHub (click the file → pencil icon → edit → commit). Changes go live
  within a minute or two automatically.
- **Change colors/layout** → edit `css/style.css`.

## If photos don't show up

Open the site, right-click → **Inspect** → **Console** tab, and look for
errors. Common causes, in order of likelihood:
- `driveApiKey` in `js/config.js` is still the placeholder, or restricted to
  the wrong website.
- A folder isn't shared as "Anyone with the link."
- The Drive API isn't enabled on the Google Cloud project the key belongs to.

The page will also show an on-screen warning under any section whose folder
it couldn't read, so you don't have to open the console to notice.
