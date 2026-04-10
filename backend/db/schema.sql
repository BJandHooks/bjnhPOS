-- bjnhPOS Database Schema
-- Phase 1: Core Register

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================
-- USERS (Staff)
-- ========================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'manager', 'cashier')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- CUSTOMERS
-- ========================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  store_credit_balance NUMERIC(10,2) DEFAULT 0,
  loyalty_points INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- INVENTORY
-- ========================
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  condition VARCHAR(50) CHECK (condition IN ('mint', 'excellent', 'good', 'fair', 'poor')),
  category VARCHAR(100),
  price NUMERIC(10,2) NOT NULL,
  original_price NUMERIC(10,2),
  consignor_id UUID REFERENCES consignors(id) ON DELETE SET NULL,
  date_added DATE DEFAULT CURRENT_DATE,
  expiration_date DATE,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'sold', 'expired', 'donated', 'returned')),
  barcode VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- CONSIGNORS
-- ========================
CREATE TABLE consignors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  split_percentage NUMERIC(5,2) NOT NULL DEFAULT 50.00,
  booth_fee_monthly NUMERIC(10,2) DEFAULT 0,
  contract_start DATE,
  payout_schedule VARCHAR(50) CHECK (payout_schedule IN ('weekly', 'biweekly', 'monthly')),
  minimum_payout_balance NUMERIC(10,2) DEFAULT 0,
  balance NUMERIC(10,2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add consignor FK to inventory after consignors table exists
ALTER TABLE inventory ADD CONSTRAINT fk_inventory_consignor
  FOREIGN KEY (consignor_id) REFERENCES consignors(id) ON DELETE SET NULL;

-- ========================
-- SALES
-- ========================
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_id UUID, -- FK added in Phase 4
  total NUMERIC(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'complete' CHECK (status IN ('complete', 'refunded', 'partial_refund')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- SALE ITEMS
-- ========================
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  service_id UUID, -- FK added in Phase 5
  price_at_sale NUMERIC(10,2) NOT NULL,
  consignor_id UUID REFERENCES consignors(id) ON DELETE SET NULL,
  consignor_cut NUMERIC(10,2),
  item_type VARCHAR(50) DEFAULT 'retail' CHECK (item_type IN ('retail', 'consignment', 'service', 'ticket')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- PAYMENTS
-- ========================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  method VARCHAR(50) NOT NULL CHECK (method IN ('cash', 'card', 'store_credit', 'gift_card')),
  amount NUMERIC(10,2) NOT NULL,
  stripe_payment_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- GIFT CARDS
-- ========================
CREATE TABLE gift_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(100) UNIQUE NOT NULL,
  original_balance NUMERIC(10,2) NOT NULL,
  current_balance NUMERIC(10,2) NOT NULL,
  issued_to_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- RETURNS
-- ========================
CREATE TABLE returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  reason TEXT,
  refund_method VARCHAR(50) CHECK (refund_method IN ('cash', 'card', 'store_credit', 'gift_card')),
  refund_amount NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- CONSIGNOR PAYOUTS
-- ========================
CREATE TABLE consignor_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consignor_id UUID REFERENCES consignors(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  method VARCHAR(50) CHECK (method IN ('cash', 'store_credit')),
  triggered_by VARCHAR(50) CHECK (triggered_by IN ('schedule', 'minimum_balance')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- BOOTH RENTAL CHARGES
-- ========================
CREATE TABLE booth_rental_charges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consignor_id UUID REFERENCES consignors(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  deducted_from_payout_id UUID REFERENCES consignor_payouts(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- MARKDOWN RULES
-- ========================
CREATE TABLE markdown_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consignor_id UUID REFERENCES consignors(id) ON DELETE CASCADE,
  days_on_floor INTEGER NOT NULL,
  markdown_percentage NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- LOYALTY TRANSACTIONS
-- ========================
CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  points_change INTEGER NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- ACTIVITY LOG
-- ========================
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- TIME CLOCK
-- ========================
CREATE TABLE time_clock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  clocked_in_at TIMESTAMP NOT NULL,
  clocked_out_at TIMESTAMP,
  total_minutes INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- TASKS
-- ========================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  notes TEXT,
  due_date DATE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- STAFF SCHEDULES
-- ========================
CREATE TABLE staff_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  shift_start TIMESTAMP NOT NULL,
  shift_end TIMESTAMP NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================
-- INDEXES (speeds up common lookups)
-- ========================
CREATE INDEX idx_inventory_status ON inventory(status);
CREATE INDEX idx_inventory_consignor ON inventory(consignor_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_user ON sales(user_id);
CREATE INDEX idx_sales_created ON sales(created_at);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_payments_sale ON payments(sale_id);
CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_created ON activity_log(created_at);
CREATE INDEX idx_time_clock_user ON time_clock(user_id);

-- ========================
-- WORK ORDERS (Phase 2)
-- ========================
CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('repair', 'custom_work')),
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'received' CHECK (status IN ('received', 'in_progress', 'ready', 'picked_up')),
  deposit_collected NUMERIC(10,2) DEFAULT 0,
  deposit_method VARCHAR(50) CHECK (deposit_method IN ('cash', 'card', 'store_credit')),
  estimated_completion_date DATE,
  completed_date DATE,
  notes TEXT,
  assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE work_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE work_order_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status_change VARCHAR(50) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE work_order_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_order_id UUID REFERENCES work_orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('ready', 'update')),
  method VARCHAR(50) NOT NULL CHECK (method IN ('sms', 'email')),
  sent_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for work orders
CREATE INDEX idx_work_orders_customer ON work_orders(customer_id);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_work_orders_assigned_to ON work_orders(assigned_to_user_id);
CREATE INDEX idx_work_orders_created ON work_orders(created_at);
CREATE INDEX idx_work_order_items_work_order ON work_order_items(work_order_id);

-- ========================
-- TRADING SYSTEM (Phase 3)
-- ========================
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  total_items INTEGER NOT NULL,
  items_evaluated INTEGER NOT NULL,
  offer_amount NUMERIC(10,2) NOT NULL,
  offer_accepted BOOLEAN,
  accepted_at TIMESTAMP,
  trade_credit_issued NUMERIC(10,2),
  trade_credit_method VARCHAR(50) CHECK (trade_credit_method IN ('cash', 'store_credit')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE trade_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  condition VARCHAR(50) CHECK (condition IN ('mint', 'excellent', 'good', 'fair', 'poor')),
  category VARCHAR(100),
  estimated_value NUMERIC(10,2),
  discogs_id VARCHAR(100),
  discogs_release_id VARCHAR(100),
  discogs_estimated_price NUMERIC(10,2),
  included_in_offer BOOLEAN DEFAULT true,
  rejection_reason VARCHAR(255),
  is_duplicate BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE trade_rejections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_item_id UUID REFERENCES trade_items(id) ON DELETE CASCADE,
  reason VARCHAR(100) NOT NULL CHECK (reason IN ('condition', 'demand', 'duplicates', 'other')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE trade_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  total_items INTEGER,
  offer_amount NUMERIC(10,2),
  offer_accepted BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE banned_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  reason TEXT,
  banned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE trade_fraud_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID REFERENCES trades(id) ON DELETE CASCADE,
  flag_type VARCHAR(100) NOT NULL CHECK (flag_type IN ('high_value', 'repeat_trader', 'unusual_pattern')),
  severity VARCHAR(50) CHECK (severity IN ('low', 'medium', 'high')),
  description TEXT,
  reviewed BOOLEAN DEFAULT false,
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE popular_trade_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  trade_count INTEGER DEFAULT 1,
  last_traded_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for trading system
CREATE INDEX idx_trades_customer ON trades(customer_id);
CREATE INDEX idx_trades_user ON trades(user_id);
CREATE INDEX idx_trades_created ON trades(created_at);
CREATE INDEX idx_trade_items_trade ON trade_items(trade_id);
CREATE INDEX idx_trade_items_discogs ON trade_items(discogs_id);
CREATE INDEX idx_trade_history_customer ON trade_history(customer_id);
CREATE INDEX idx_banned_customers_customer ON banned_customers(customer_id);
CREATE INDEX idx_trade_fraud_flags_trade ON trade_fraud_flags(trade_id);
CREATE INDEX idx_popular_trade_items_title ON popular_trade_items(title);

-- ========================
-- DATA IMPORT TOOLS (Phase 4)
-- ========================
CREATE TABLE import_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  import_type VARCHAR(50) NOT NULL CHECK (import_type IN ('consignors', 'inventory', 'customers', 'sales')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  total_records INTEGER NOT NULL,
  successful_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TABLE import_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_job_id UUID REFERENCES import_jobs(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  field_name VARCHAR(100),
  error_message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_import_jobs_user ON import_jobs(user_id);
CREATE INDEX idx_import_jobs_type ON import_jobs(import_type);
CREATE INDEX idx_import_jobs_created ON import_jobs(created_at);
CREATE INDEX idx_import_errors_job ON import_errors(import_job_id);

-- ========================
-- EVENTS & TICKETING (Phase 5)
-- ========================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('off_site', 'in_store_class', 'in_store_performance', 'workshop', 'recurring')),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  location VARCHAR(255),
  capacity INTEGER,
  price NUMERIC(10,2) DEFAULT 0,
  is_free BOOLEAN DEFAULT false,
  is_recurring BOOLEAN DEFAULT false,
  recurring_pattern VARCHAR(50) CHECK (recurring_pattern IN ('daily', 'weekly', 'biweekly', 'monthly')),
  recurring_end_date DATE,
  host_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  performer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  reserved_spots_sold INTEGER DEFAULT 0,
  door_registrations INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE event_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  registration_type VARCHAR(50) NOT NULL CHECK (registration_type IN ('reserved', 'door')),
  checked_in BOOLEAN DEFAULT false,
  checked_in_at TIMESTAMP,
  payment_status VARCHAR(50) CHECK (payment_status IN ('paid', 'unpaid', 'free')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE event_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES event_registrations(id) ON DELETE CASCADE,
  ticket_code VARCHAR(100) UNIQUE NOT NULL,
  ticket_type VARCHAR(50) DEFAULT 'general',
  price NUMERIC(10,2),
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE event_revenue_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  recipient_name VARCHAR(255) NOT NULL,
  split_percentage NUMERIC(5,2) NOT NULL,
  split_type VARCHAR(50) CHECK (split_type IN ('flat_percentage', 'per_ticket', 'fixed_amount')),
  amount NUMERIC(10,2),
  paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMP,
  paid_method VARCHAR(50) CHECK (paid_method IN ('cash', 'store_credit')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE event_sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  sale_total NUMERIC(10,2),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE recurring_event_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  instance_start TIMESTAMP NOT NULL,
  instance_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for events
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_host ON events(host_id);
CREATE INDEX idx_events_performer ON events(performer_id);
CREATE INDEX idx_event_registrations_event ON event_registrations(event_id);
CREATE INDEX idx_event_registrations_customer ON event_registrations(customer_id);
CREATE INDEX idx_event_tickets_event ON event_tickets(event_id);
CREATE INDEX idx_event_tickets_code ON event_tickets(ticket_code);
CREATE INDEX idx_event_revenue_splits_event ON event_revenue_splits(event_id);
CREATE INDEX idx_event_sales_event ON event_sales(event_id);

-- ========================
-- MEDIA HUB (Phase 6)
-- ========================
CREATE TABLE media_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('image', 'video')),
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE social_content_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  media_file_id UUID REFERENCES media_files(id) ON DELETE CASCADE,
  title VARCHAR(255),
  caption TEXT,
  approved BOOLEAN DEFAULT false,
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  in_queue BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE social_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('facebook', 'instagram', 'tiktok')),
  track VARCHAR(50) NOT NULL CHECK (track IN ('autopilot', 'prime_time')),
  content_id UUID REFERENCES social_content_queue(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMP,
  posted_at TIMESTAMP,
  post_url VARCHAR(500),
  caption TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'posted', 'failed', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE social_autopilot_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('facebook', 'instagram', 'tiktok')),
  post_time TIME NOT NULL,
  randomize_caption BOOLEAN DEFAULT true,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE social_captions_pool (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caption TEXT NOT NULL,
  platform VARCHAR(50) CHECK (platform IN ('facebook', 'instagram', 'tiktok')),
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE platform_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform VARCHAR(50) NOT NULL UNIQUE CHECK (platform IN ('facebook', 'instagram', 'tiktok', 'google_my_business')),
  access_token VARCHAR(1000),
  access_token_expires_at TIMESTAMP,
  business_account_id VARCHAR(255),
  page_id VARCHAR(255),
  connected BOOLEAN DEFAULT false,
  connected_at TIMESTAMP,
  connected_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for media hub
CREATE INDEX idx_media_files_inventory ON media_files(inventory_id);
CREATE INDEX idx_social_content_queue_approved ON social_content_queue(approved);
CREATE INDEX idx_social_posts_platform ON social_posts(platform);
CREATE INDEX idx_social_posts_status ON social_posts(status);
CREATE INDEX idx_social_posts_scheduled ON social_posts(scheduled_at);
CREATE INDEX idx_social_captions_approved ON social_captions_pool(approved);

-- ========================
-- ONLINE STORE & SYNC (Phase 7)
-- ========================
CREATE TABLE online_store_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_enabled BOOLEAN DEFAULT false,
  store_url VARCHAR(255),
  store_theme VARCHAR(100),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE inventory_online_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT false,
  online_platforms VARCHAR(500), -- comma-separated: discogs,ebay,etsy,shopify
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE platform_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  platform VARCHAR(100) NOT NULL CHECK (platform IN ('discogs', 'ebay', 'etsy')),
  external_listing_id VARCHAR(255),
  listing_title VARCHAR(500),
  listing_url VARCHAR(1000),
  listing_status VARCHAR(50) CHECK (listing_status IN ('active', 'sold', 'delisted', 'archived')),
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE platform_sync_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform VARCHAR(100) NOT NULL,
  sync_type VARCHAR(50) CHECK (sync_type IN ('inventory', 'orders', 'full')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  records_synced INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE inventory_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  action VARCHAR(50) CHECK (action IN ('listed', 'delisted', 'sold', 'updated')),
  platform VARCHAR(100),
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE google_shopping_feed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  product_title VARCHAR(500),
  product_description TEXT,
  price NUMERIC(10,2),
  image_url VARCHAR(1000),
  product_url VARCHAR(1000),
  category VARCHAR(255),
  in_stock BOOLEAN,
  condition VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE website_monitoring (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  check_type VARCHAR(50) NOT NULL CHECK (check_type IN ('uptime', 'ssl_cert', 'broken_links', 'sitemaps')),
  status VARCHAR(50) DEFAULT 'ok' CHECK (status IN ('ok', 'warning', 'error')),
  last_checked_at TIMESTAMP,
  next_check_at TIMESTAMP,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE backups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  backup_type VARCHAR(50) NOT NULL CHECK (backup_type IN ('database', 'files')),
  backup_location VARCHAR(500),
  backup_size INTEGER,
  backup_date TIMESTAMP,
  status VARCHAR(50) DEFAULT 'complete' CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for online store
CREATE INDEX idx_inventory_online_status_inventory ON inventory_online_status(inventory_id);
CREATE INDEX idx_platform_listings_inventory ON platform_listings(inventory_id);
CREATE INDEX idx_platform_listings_platform ON platform_listings(platform);
CREATE INDEX idx_platform_sync_jobs_platform ON platform_sync_jobs(platform);
CREATE INDEX idx_inventory_sync_log_inventory ON inventory_sync_log(inventory_id);
CREATE INDEX idx_google_shopping_feed_inventory ON google_shopping_feed(inventory_id);
CREATE INDEX idx_website_monitoring_type ON website_monitoring(check_type);
CREATE INDEX idx_backups_date ON backups(backup_date);

-- Phase 8: Analytics & BI additions
CREATE TABLE IF NOT EXISTS shrinkage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('theft', 'damage', 'loss', 'admin_error', 'other')),
  cost_basis NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shrinkage_log_recorded_at ON shrinkage_log(recorded_at);
CREATE INDEX IF NOT EXISTS idx_shrinkage_log_inventory ON shrinkage_log(inventory_id);

-- Phase 10: Consignor Portal additions
ALTER TABLE consignors ADD COLUMN IF NOT EXISTS portal_pin_hash VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_consignors_email ON consignors(email);

-- Phase 10: index for portal login
CREATE INDEX IF NOT EXISTS idx_consignors_portal ON consignors(email) WHERE portal_pin_hash IS NOT NULL;

-- Phase 9: Marketing — social posting & local event listings

-- OAuth tokens per platform per store
CREATE TABLE IF NOT EXISTS platform_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('facebook','instagram','tiktok','google_business')),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  page_id VARCHAR(255),        -- FB page id / GMB location id / TT account id
  page_name VARCHAR(255),
  instagram_account_id VARCHAR(255), -- linked IG account from FB
  is_connected BOOLEAN DEFAULT false,
  connected_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(platform)
);

-- Post queue (drafts, scheduled, sent)
CREATE TABLE IF NOT EXISTS marketing_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255),
  caption TEXT NOT NULL,
  media_url TEXT,              -- photo or video URL
  media_type VARCHAR(20) DEFAULT 'image' CHECK (media_type IN ('image','video','reel')),
  platforms TEXT[] NOT NULL,   -- ['facebook','instagram','tiktok','google_business']
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','scheduled','publishing','published','failed')),
  scheduled_at TIMESTAMP,
  published_at TIMESTAMP,
  track VARCHAR(20) DEFAULT 'prime' CHECK (track IN ('autopilot','prime')),
  inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  event_id UUID,               -- optional link to an event
  post_results JSONB,          -- { facebook: {post_id, url}, instagram: {media_id}, ... }
  error_details JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Per-platform post IDs for tracking published posts
CREATE TABLE IF NOT EXISTS marketing_post_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES marketing_posts(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  external_post_id VARCHAR(255),
  external_url TEXT,
  status VARCHAR(30) DEFAULT 'published',
  error_message TEXT,
  published_at TIMESTAMP DEFAULT NOW()
);

-- Local event listings on external platforms
CREATE TABLE IF NOT EXISTS local_event_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID,               -- references internal events table
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('facebook','google_business','eventbrite')),
  external_event_id VARCHAR(255),
  external_url TEXT,
  title VARCHAR(500),
  description TEXT,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  location TEXT,
  cover_image_url TEXT,
  ticket_url TEXT,
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft','published','cancelled','ended')),
  sync_enabled BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Caption pool for autopilot posts
CREATE TABLE IF NOT EXISTS caption_pool (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caption TEXT NOT NULL,
  tags TEXT[],
  approved BOOLEAN DEFAULT false,
  used_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_posts_status ON marketing_posts(status);
CREATE INDEX IF NOT EXISTS idx_marketing_posts_scheduled ON marketing_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_marketing_posts_track ON marketing_posts(track);
CREATE INDEX IF NOT EXISTS idx_local_event_listings_event ON local_event_listings(event_id);
CREATE INDEX IF NOT EXISTS idx_platform_connections_platform ON platform_connections(platform);
