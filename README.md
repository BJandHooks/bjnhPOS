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
- `DISCOGS_TOKEN` — (optional) from Discogs for trade valuations

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
| Consignors | POST /api/imports/consignors | name, email, phone, split_percentage, booth_fee_monthly, payout_schedule, minimum_payout_balance, contract_start |
| Inventory | POST /api/imports/inventory | title, description, condition, category, price, barcode, consignor_id, expiration_date |
| Customers | POST /api/imports/customers | name, email, phone |
| Sales History | POST /api/imports/sales | customer_id, user_id, total, status, created_at |

CSV templates are available in the app under "Import Data" section.

---

## Phase 1 — Core Register (Built)

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

---

## Phase 2 — Services & Work Orders (Built)

- ✅ Work order creation at intake (drop-off jobs)
- ✅ Job types: repair, custom work
- ✅ Optional deposit collection at intake
- ✅ Staff assignment per work order
- ✅ Status tracking (received, in progress, ready, picked up)
- ✅ Text and email notifications when job is ready
- ✅ Pickup workflow
- ✅ Work order history per customer
- ✅ Work order list view for staff with filters
- ✅ Admin UI for managing work orders

---

## Phase 3 — Trading System with Discogs Integration (Built)

- ✅ Trade-in workflow on the register
- ✅ For lots >25 items: random sample of 10, calculate offer at 30% × estimated sale value × total count
- ✅ For lots ≤25 items: evaluate every item individually
- ✅ Discogs API integration for estimated sale value lookup
- ✅ Trade offer display and customer accept/reject flow
- ✅ Trade credit as cash or store credit
- ✅ Trade + purchase in single transaction
- ✅ Trade rejection logging
- ✅ Trade history per customer
- ✅ Duplicate detection
- ✅ Customer trade limits (per visit or per period)
- ✅ Banned customer list
- ✅ Popular trade item alerts
- ✅ Fraud detection rules

---

## Phase 4 — Data Import Tools (Built)

- ✅ Four import types: consignors, inventory, customers, sales history
- ✅ Pre-made CSV templates for each
- ✅ Upload UI with validation and preview before import
- ✅ Error highlighting and detailed reporting
- ✅ Import confirmation step
- ✅ Import history log
- ✅ No technical knowledge required

---

## Phase 5 — Events, Calendar, and Ticketing (Built)

- ✅ Event types: off-site event, in-store class, in-store performance, recurring event, workshop
- ✅ Free and paid events
- ✅ Capacity limits per event
- ✅ Online registration with reserved spots; remaining sold at door
- ✅ No cancellations or refunds
- ✅ Door check-in (mark attendees as arrived)
- ✅ Sell products and services during an event
- ✅ Recurring event support (weekly, monthly, etc.)
- ✅ Event host and performer profiles
- ✅ Multi-way revenue splits per event
- ✅ Digital tickets only (email delivery)
- ✅ Staff-managed calendar view
- ✅ Capacity tracking in real time
- ✅ Attendance tracking per event
- ✅ Host and performer payout system
- ✅ Retail sales linked to events

---

## Phase 6 — Media Hub (Built)

- ✅ Single photo upload at item intake
- ✅ Content queue for social media
- ✅ Two-track posting system per platform:
  - Track 1 (Autopilot): scheduled posting times, random photo + caption pulled from pre-approved pool
  - Track 2 (Prime time): reserved manual slots with reminders for live custom content
- ✅ Platforms: Facebook, Instagram, TikTok
- ✅ Bulk caption upload
- ✅ Reels and TikTok video scheduling
- ✅ Google My Business photo uploads
- ✅ Content approval workflow
- ✅ Post history and performance tracking (views/likes fields)
- ✅ Platform connection setup UI

---

## Phase 7 — Online Store and Cross-Platform Inventory Sync (Built)

- ✅ Online store toggle (off by default, switchable on per item or globally)
- ✅ Cross-platform sync framework — pluggable architecture
- ✅ Discogs listing integration
- ✅ Automatic removal of sold items from all active listings
- ✅ Google Shopping product feed generation
- ✅ Event calendar auto-sync (export iCal)
- ✅ Website uptime monitoring (basic ping check)
- ✅ Broken link checker
- ✅ Image optimization pipeline
- ✅ SSL certificate renewal alerts
- ✅ 404 error monitoring dashboard
- ✅ Automatic sitemap generation
- ✅ Security scanning placeholder
- ✅ Backup automation (scheduled database backup)

---

## Architecture Overview

### Backend
- **Framework**: Express.js (Node.js)
- **Database**: PostgreSQL with UUID primary keys
- **Authentication**: JWT tokens
- **File Structure**:
  - `/backend/routes/` — API endpoints
  - `/backend/db/` — Database schema and initialization
  - `/backend/middleware/` — Authentication, logging, error handling
  - `/backend/server.js` — Express app setup

### Frontend
- **Framework**: React with React Router
- **State Management**: React Context API
- **UI**: CSS Grid and Flexbox (no build-in framework)
- **File Structure**:
  - `/frontend/src/pages/` — Page components
  - `/frontend/src/components/` — Reusable UI components
  - `/frontend/src/utils/` — API client, helpers
  - `/frontend/src/context/` — Global state (Auth, etc.)
  - `/frontend/src/hooks/` — Custom React hooks

### Database Schema
- **Users** — staff accounts with role-based permissions
- **Customers** — customer profiles, loyalty points, store credit
- **Inventory** — one-of-a-kind items with condition tracking
- **Consignors** — consignor profiles with split percentages and booth fees
- **Sales** — point-of-sale transactions
- **Work Orders** — service jobs with status tracking
- **Trades** — trade-in evaluations with Discogs integration
- **Events** — event management with ticketing and revenue splits
- **Media** — photos, captions, and social media scheduling
- **Imports** — bulk data import tracking

---

## Key Features Across All Phases

### Retail
- One-of-a-kind item tracking with individual SKUs
- Condition grading (mint, excellent, good, fair, poor)
- Price history and markdown tracking
- Inventory valuation over time
- Dead stock identification
- Rare record alerts

### Consignment
- Configurable flat split percentages
- Monthly booth rental fees
- Item expiration dates with return/donate workflow
- Auto-markdown rules
- Contract-based payout schedules
- Payout options: cash or store credit

### Services
- Drop-off work order intake
- Deposit collection
- Staff assignment and tracking
- Status workflow (received → in progress → ready → picked up)
- Customer notifications (SMS/email)

### Trading
- Lot-based evaluation (sample or full depending on size)
- Discogs integration for market valuations
- Offer calculation at 30% of estimated value
- Trade credit as cash or store credit
- Duplicate detection
- Fraud pattern detection
- Customer banning

### Events & Ticketing
- Multiple event types with flexible pricing
- Online registration and door check-in
- Digital ticket delivery
- Multi-way revenue splits
- Recurring event support
- Real-time capacity tracking

### Social Media
- Content queue management
- Two-track scheduling (autopilot + prime time)
- Multi-platform support (Facebook, Instagram, TikTok)
- Caption pool with approval workflow
- Post performance tracking

### Online Sales
- Cross-platform inventory sync
- Automatic delisting of sold items
- Google Shopping feed
- Platform integration framework

### Operations
- Role-based staff permissions
- Activity logging for all actions
- Time clock with payroll export
- Task management and assignments
- Staff scheduling
- Detailed reporting and analytics

---

## Support

This software was built specifically for BJ & Hooks. For questions or issues, refer back to the build chat on claude.ai.
