# bjnhPOS
Point of Sale system for BJ & Hooks — used music, retail, consignment, services, and events.

---

## What You Need Before Starting

Install these on your PC before anything else:

1. **Node.js** — https://nodejs.org (download the LTS version)
2. **PostgreSQL** — https://www.postgresql.org/download (the database that stores all your data)
3. **Git** — https://git-scm.com/downloads (to download and manage code)

---

## First Time Setup

### Step 1 — Download the code
Open a terminal (search "Terminal" or "Command Prompt" on your PC) and run:
```
git clone https://github.com/BJandHooks/bjnhPOS.git
cd bjnhPOS
```

### Step 2 — Create the database
Open PostgreSQL and run:
```sql
CREATE DATABASE bjnhpos;
```
Then run the schema file to set up all the tables:
```
psql -U postgres -d bjnhpos -f backend/db/schema.sql
```

### Step 3 — Set up the backend
```
cd backend
npm install
cp .env.example .env
```
Open the `.env` file and fill in:
- `DATABASE_URL` — your PostgreSQL connection string
- `JWT_SECRET` — any long random string (like: `xK9mP2vLqR7nT4wY8sA3`)
- `STRIPE_SECRET_KEY` — from your Stripe dashboard at stripe.com

Then start the backend:
```
npm run dev
```
You should see: `bjnhPOS running on port 5000`

### Step 4 — Set up the frontend
Open a second terminal window and run:
```
cd frontend
npm install
npm start
```
Your browser should open to `http://localhost:3000`

### Step 5 — Create your first owner account
In a third terminal window, run this to create your account (replace the values):
```
cd backend
node -e "
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
bcrypt.hash('yourpassword', 10).then(hash => {
  pool.query(
    'INSERT INTO users (name, email, password_hash, role) VALUES (\$1, \$2, \$3, \$4)',
    ['Your Name', 'you@email.com', hash, 'owner']
  ).then(() => { console.log('Owner created.'); pool.end(); });
});
"
```

Then log in at `http://localhost:3000/login`

---

## Daily Use

Start the backend:
```
cd backend && npm run dev
```

Start the frontend (if not already running):
```
cd frontend && npm start
```

Open your browser to your subdomain or `http://localhost:3000`

---

## iPad Setup

Once deployed to Railway (see below), open your subdomain URL in Safari on your iPad. It works as a web app — no App Store needed.

---

## Deploying to Railway (going live on your subdomain)

1. Go to https://railway.app and create a free account
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub account and select `BJandHooks/bjnhPOS`
4. Add a PostgreSQL plugin inside the project
5. Set your environment variables in the Railway dashboard (same as your `.env` file)
6. Point your subdomain's DNS to the Railway URL Railway gives you

---

## Bulk Import

To import existing data, use these endpoints via the API or a tool like Postman:

| What to import | Endpoint | Template columns |
|---|---|---|
| Consignors | POST /api/consignors/bulk-import | name, email, phone, split_percentage, booth_fee_monthly, payout_schedule, minimum_payout_balance, contract_start |
| Inventory | POST /api/inventory/bulk-import | title, description, condition, category, price, barcode, consignor_id, expiration_date |
| Customers | POST /api/customers (one at a time or bulk script) | name, email, phone |
| Sales History | POST /api/sales/bulk-import | customer_id, user_id, total, status, created_at |

Fill in a spreadsheet with those columns, save as CSV, and use the import endpoint.

---

## Phase 1 Features (Built)

- ✅ Register — scan barcodes, add items, split payments, process sales
- ✅ Inventory — add/edit one-of-a-kind items, barcode support, consignor linking
- ✅ Customers — profiles, purchase history, loyalty points, store credit
- ✅ Consignors — profiles, auto payout calculation, booth fee tracking, payout processing
- ✅ Returns — return items, restore inventory, reverse consignor balance
- ✅ Gift Cards — digital gift card issue and balance tracking
- ✅ Staff — roles, permissions, add/edit staff accounts
- ✅ Tasks — assign and complete tasks across staff
- ✅ Schedule — create and view staff shifts
- ✅ Time Clock — clock in/out, hours tracked
- ✅ Reports — sales by hour/day/week/month/quarter/year, inventory, consignors, staff, best sellers, payment methods
- ✅ Activity Log — every action logged by staff member

## Coming Next (Phase 2+)

- Services / Work Orders
- Events, Calendar, and Ticketing
- Consignor Portal
- Online Store
- Auto-markdown rules
- Twilio / SendGrid notifications

---

## Support

This software was built specifically for BJ & Hooks. For questions or issues, refer back to the build chat on claude.ai.
