# bjnhPOS — Namecheap cPanel Deployment Guide

## Step 1 — Build the frontend on your local Windows machine

Run this from the repo root:

```
build-and-deploy.bat
```

This produces `backend/public/` containing the built React app.
If you prefer running commands manually:

```
cd frontend
npm install
set GENERATE_SOURCEMAP=false
set CI=false
npm run build
cd ..
xcopy /E /I /Y frontend\build backend\public
```

---

## Step 2 — Upload backend\ to cPanel

1. Open cPanel → **File Manager**
2. Navigate to your **Application Root** directory (the folder you set when creating the Node.js App, e.g., `bjnhpos`)
3. Upload everything inside the `backend\` folder to that directory:
   - `server.js`
   - `package.json`
   - `db/`
   - `middleware/`
   - `routes/`
   - `public/` ← built React frontend
4. Do **not** upload `node_modules/` — cPanel installs these for you
5. Do **not** overwrite `.env` if it already exists on the server

---

## Step 3 — Create .env on the server

In File Manager, create a new file named `.env` in your Application Root with:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=nerdapbr_sandbox
DB_PASSWORD=YOUR_DB_PASSWORD_HERE
DB_NAME=nerdapbr_sandbox

PORT=3000
NODE_ENV=production
JWT_SECRET=CHANGE_THIS_TO_A_LONG_RANDOM_STRING

BASE_URL=https://sandbox.nerdcoremaine.com

META_APP_ID=
META_APP_SECRET=
TIKTOK_CLIENT_KEY=
TIKTOK_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

---

## Step 4 — Set up the database tables

1. Open cPanel → **phpMyAdmin**
2. Select the `nerdapbr_sandbox` database
3. Click the **SQL** tab
4. Open `backend/db/schema.sql` in a text editor, copy the full contents, paste into phpMyAdmin's SQL box, click **Go**

---

## Step 5 — cPanel Node.js App settings

Go to cPanel → **Setup Node.js App** → Edit your app:

| Setting | Value |
|---|---|
| Node.js version | **18** |
| Application mode | **production** |
| Application root | `bjnhpos` (or whatever folder you uploaded to) |
| Application URL | `sandbox.nerdcoremaine.com` |
| Application startup file | `server.js` |

Click **Save**.

---

## Step 6 — Install dependencies and start

1. In the Node.js App panel, click **Run NPM Install**
   - This installs all packages listed in `package.json` on the server
   - Wait until it says "successfully completed"
2. Click **Restart** (or **Start** if not running)

---

## Step 7 — Verify

Open `https://sandbox.nerdcoremaine.com` in a browser.
You should see the bjnhPOS login screen.

---

## File map summary

```
cPanel Application Root (e.g., bjnhpos/)
├── server.js            ← startup file
├── package.json
├── .env                 ← create manually on server, never upload
├── db/
│   ├── index.js
│   ├── schema.sql       ← run once in phpMyAdmin, then can delete
│   └── setup.js
├── middleware/
│   ├── auth.js
│   └── logger.js
├── routes/
│   └── *.js             ← all 23 route files
└── public/              ← built React frontend (from build-and-deploy.bat)
    ├── index.html
    ├── static/
    │   ├── css/
    │   └── js/
    └── ...
```

---

## Do NOT upload

- `node_modules/` — installed by cPanel's NPM Install button
- `.env` — create it manually on the server
- `frontend/` — only the built output in `backend/public/` is needed

---

## If you update the app later

1. Make changes locally
2. If you changed frontend source: run `build-and-deploy.bat` again
3. Upload changed files via File Manager
4. In Node.js App panel, click **Restart**

