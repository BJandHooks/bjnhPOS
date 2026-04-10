-- bjnhPOS Database Schema — MySQL Version
-- Run this on a fresh database to set up all tables

SET FOREIGN_KEY_CHECKS = 0;

-- ========================
-- USERS (Staff)
-- ========================
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- CUSTOMERS
-- ========================
CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  store_credit_balance DECIMAL(10,2) DEFAULT 0,
  loyalty_points INT DEFAULT 0,
  vip TINYINT(1) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- CONSIGNORS
-- ========================
CREATE TABLE IF NOT EXISTS consignors (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  split_percentage DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  booth_fee_monthly DECIMAL(10,2) DEFAULT 0,
  contract_start DATE,
  payout_schedule VARCHAR(50),
  minimum_payout_balance DECIMAL(10,2) DEFAULT 0,
  balance DECIMAL(10,2) DEFAULT 0,
  active TINYINT(1) DEFAULT 1,
  portal_pin_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- INVENTORY
-- ========================
CREATE TABLE IF NOT EXISTS inventory (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  artist VARCHAR(255),
  genre VARCHAR(100),
  format VARCHAR(100),
  sku VARCHAR(100),
  condition VARCHAR(50),
  category VARCHAR(100),
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2),
  cost_basis DECIMAL(10,2) DEFAULT 0,
  consignor_id CHAR(36),
  date_added DATE DEFAULT (CURRENT_DATE),
  expiration_date DATE,
  sold_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'available',
  barcode VARCHAR(100) UNIQUE,
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ========================
-- SALES
-- ========================
CREATE TABLE IF NOT EXISTS sales (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36),
  user_id CHAR(36),
  event_id CHAR(36),
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'complete',
  voided TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- SALE ITEMS
-- ========================
CREATE TABLE IF NOT EXISTS sale_items (
  id CHAR(36) PRIMARY KEY,
  sale_id CHAR(36),
  inventory_id CHAR(36),
  service_id CHAR(36),
  price_at_sale DECIMAL(10,2) NOT NULL,
  sale_price DECIMAL(10,2),
  consignor_id CHAR(36),
  consignor_cut DECIMAL(10,2),
  item_type VARCHAR(50) DEFAULT 'retail',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- PAYMENTS
-- ========================
CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) PRIMARY KEY,
  sale_id CHAR(36),
  method VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  stripe_payment_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- GIFT CARDS
-- ========================
CREATE TABLE IF NOT EXISTS gift_cards (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  original_balance DECIMAL(10,2) NOT NULL,
  current_balance DECIMAL(10,2) NOT NULL,
  issued_to_customer_id CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- RETURNS
-- ========================
CREATE TABLE IF NOT EXISTS returns (
  id CHAR(36) PRIMARY KEY,
  original_sale_id CHAR(36),
  user_id CHAR(36),
  customer_id CHAR(36),
  reason TEXT,
  refund_method VARCHAR(50),
  refund_amount DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- CONSIGNOR PAYOUTS
-- ========================
CREATE TABLE IF NOT EXISTS consignor_payouts (
  id CHAR(36) PRIMARY KEY,
  consignor_id CHAR(36),
  user_id CHAR(36),
  amount DECIMAL(10,2) NOT NULL,
  method VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  triggered_by VARCHAR(50),
  notes TEXT,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- BOOTH RENTAL CHARGES
-- ========================
CREATE TABLE IF NOT EXISTS booth_rental_charges (
  id CHAR(36) PRIMARY KEY,
  consignor_id CHAR(36),
  amount DECIMAL(10,2) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  deducted_from_payout_id CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- MARKDOWN RULES
-- ========================
CREATE TABLE IF NOT EXISTS markdown_rules (
  id CHAR(36) PRIMARY KEY,
  consignor_id CHAR(36),
  days_on_floor INT NOT NULL,
  markdown_percentage DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- LOYALTY TRANSACTIONS
-- ========================
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36),
  sale_id CHAR(36),
  points_change INT NOT NULL,
  reason VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- ACTIVITY LOG
-- ========================
CREATE TABLE IF NOT EXISTS activity_log (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  action VARCHAR(255) NOT NULL,
  action_type VARCHAR(255),
  entity_type VARCHAR(100),
  entity_id CHAR(36),
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- TIME CLOCK
-- ========================
CREATE TABLE IF NOT EXISTS time_clock (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  clocked_in_at TIMESTAMP NOT NULL,
  clocked_out_at TIMESTAMP,
  total_minutes INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- TASKS
-- ========================
CREATE TABLE IF NOT EXISTS tasks (
  id CHAR(36) PRIMARY KEY,
  assigned_to_user_id CHAR(36),
  assigned_by_user_id CHAR(36),
  title VARCHAR(255) NOT NULL,
  notes TEXT,
  due_date DATE,
  completed TINYINT(1) DEFAULT 0,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- STAFF SCHEDULES
-- ========================
CREATE TABLE IF NOT EXISTS staff_schedules (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  shift_start TIMESTAMP NOT NULL,
  shift_end TIMESTAMP NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- WORK ORDERS (Phase 2)
-- ========================
CREATE TABLE IF NOT EXISTS work_orders (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36),
  user_id CHAR(36),
  job_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'received',
  deposit_collected DECIMAL(10,2) DEFAULT 0,
  deposit_method VARCHAR(50),
  estimated_completion_date DATE,
  completed_date DATE,
  notes TEXT,
  assigned_to_user_id CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_order_items (
  id CHAR(36) PRIMARY KEY,
  work_order_id CHAR(36),
  description TEXT NOT NULL,
  quantity INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_order_timeline (
  id CHAR(36) PRIMARY KEY,
  work_order_id CHAR(36),
  user_id CHAR(36),
  status_change VARCHAR(50) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_order_notifications (
  id CHAR(36) PRIMARY KEY,
  work_order_id CHAR(36),
  customer_id CHAR(36),
  notification_type VARCHAR(50) NOT NULL,
  method VARCHAR(50) NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- TRADING SYSTEM (Phase 3)
-- ========================
CREATE TABLE IF NOT EXISTS trades (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36),
  user_id CHAR(36),
  total_items INT NOT NULL,
  items_evaluated INT NOT NULL,
  offer_amount DECIMAL(10,2) NOT NULL,
  offer_accepted TINYINT(1),
  accepted_at TIMESTAMP,
  trade_credit_issued DECIMAL(10,2),
  trade_credit_method VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trade_items (
  id CHAR(36) PRIMARY KEY,
  trade_id CHAR(36),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  condition VARCHAR(50),
  category VARCHAR(100),
  estimated_value DECIMAL(10,2),
  discogs_id VARCHAR(100),
  discogs_release_id VARCHAR(100),
  discogs_estimated_price DECIMAL(10,2),
  included_in_offer TINYINT(1) DEFAULT 1,
  rejection_reason VARCHAR(255),
  is_duplicate TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trade_rejections (
  id CHAR(36) PRIMARY KEY,
  trade_item_id CHAR(36),
  reason VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trade_history (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36),
  trade_id CHAR(36),
  total_items INT,
  offer_amount DECIMAL(10,2),
  offer_accepted TINYINT(1),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS banned_customers (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36),
  reason TEXT,
  banned_by_user_id CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trade_fraud_flags (
  id CHAR(36) PRIMARY KEY,
  trade_id CHAR(36),
  flag_type VARCHAR(100) NOT NULL,
  severity VARCHAR(50),
  description TEXT,
  reviewed TINYINT(1) DEFAULT 0,
  reviewed_by_user_id CHAR(36),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS popular_trade_items (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  trade_count INT DEFAULT 1,
  last_traded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- DATA IMPORT TOOLS (Phase 4)
-- ========================
CREATE TABLE IF NOT EXISTS import_jobs (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  import_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  total_records INT NOT NULL,
  successful_records INT DEFAULT 0,
  failed_records INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS import_errors (
  id CHAR(36) PRIMARY KEY,
  import_job_id CHAR(36),
  row_number INT NOT NULL,
  field_name VARCHAR(100),
  error_message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- EVENTS & TICKETING (Phase 5)
-- ========================
CREATE TABLE IF NOT EXISTS events (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_type VARCHAR(50) NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  location VARCHAR(255),
  capacity INT,
  price DECIMAL(10,2) DEFAULT 0,
  is_free TINYINT(1) DEFAULT 0,
  is_recurring TINYINT(1) DEFAULT 0,
  recurring_pattern VARCHAR(50),
  recurring_end_date DATE,
  host_id CHAR(36),
  performer_id CHAR(36),
  status VARCHAR(50) DEFAULT 'scheduled',
  reserved_spots_sold INT DEFAULT 0,
  door_registrations INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_registrations (
  id CHAR(36) PRIMARY KEY,
  event_id CHAR(36),
  customer_id CHAR(36),
  registration_type VARCHAR(50) NOT NULL,
  checked_in TINYINT(1) DEFAULT 0,
  checked_in_at TIMESTAMP,
  payment_status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_tickets (
  id CHAR(36) PRIMARY KEY,
  event_id CHAR(36),
  customer_id CHAR(36),
  registration_id CHAR(36),
  ticket_code VARCHAR(100) UNIQUE NOT NULL,
  ticket_type VARCHAR(50) DEFAULT 'general',
  price DECIMAL(10,2),
  used TINYINT(1) DEFAULT 0,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_revenue_splits (
  id CHAR(36) PRIMARY KEY,
  event_id CHAR(36),
  recipient_id CHAR(36),
  recipient_name VARCHAR(255) NOT NULL,
  split_percentage DECIMAL(5,2) NOT NULL,
  split_type VARCHAR(50),
  amount DECIMAL(10,2),
  paid TINYINT(1) DEFAULT 0,
  paid_at TIMESTAMP,
  paid_method VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_sales (
  id CHAR(36) PRIMARY KEY,
  event_id CHAR(36),
  sale_id CHAR(36),
  sale_total DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recurring_event_instances (
  id CHAR(36) PRIMARY KEY,
  parent_event_id CHAR(36),
  instance_start TIMESTAMP NOT NULL,
  instance_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- MEDIA HUB (Phase 6)
-- ========================
CREATE TABLE IF NOT EXISTS media_files (
  id CHAR(36) PRIMARY KEY,
  inventory_id CHAR(36),
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50) NOT NULL,
  file_size INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_content_queue (
  id CHAR(36) PRIMARY KEY,
  media_file_id CHAR(36),
  title VARCHAR(255),
  caption TEXT,
  approved TINYINT(1) DEFAULT 0,
  approved_by_user_id CHAR(36),
  approved_at TIMESTAMP,
  in_queue TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_posts (
  id CHAR(36) PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  track VARCHAR(50) NOT NULL,
  content_id CHAR(36),
  scheduled_at TIMESTAMP,
  posted_at TIMESTAMP,
  post_url VARCHAR(500),
  caption TEXT,
  views INT DEFAULT 0,
  likes INT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_autopilot_schedules (
  id CHAR(36) PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  post_time TIME NOT NULL,
  randomize_caption TINYINT(1) DEFAULT 1,
  enabled TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_captions_pool (
  id CHAR(36) PRIMARY KEY,
  caption TEXT NOT NULL,
  platform VARCHAR(50),
  approved TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- ONLINE STORE & SYNC (Phase 7)
-- ========================
CREATE TABLE IF NOT EXISTS online_store_settings (
  id CHAR(36) PRIMARY KEY,
  store_enabled TINYINT(1) DEFAULT 0,
  store_url VARCHAR(255),
  store_theme VARCHAR(100),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_online_status (
  id CHAR(36) PRIMARY KEY,
  inventory_id CHAR(36) UNIQUE,
  is_online TINYINT(1) DEFAULT 0,
  online_platforms VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_listings (
  id CHAR(36) PRIMARY KEY,
  inventory_id CHAR(36),
  platform VARCHAR(100) NOT NULL,
  external_listing_id VARCHAR(255),
  listing_title VARCHAR(500),
  listing_url VARCHAR(1000),
  listing_status VARCHAR(50),
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_sync_jobs (
  id CHAR(36) PRIMARY KEY,
  platform VARCHAR(100) NOT NULL,
  sync_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  records_synced INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_sync_log (
  id CHAR(36) PRIMARY KEY,
  inventory_id CHAR(36),
  action VARCHAR(50),
  platform VARCHAR(100),
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS google_shopping_feed (
  id CHAR(36) PRIMARY KEY,
  inventory_id CHAR(36),
  product_title VARCHAR(500),
  product_description TEXT,
  price DECIMAL(10,2),
  image_url VARCHAR(1000),
  product_url VARCHAR(1000),
  category VARCHAR(255),
  in_stock TINYINT(1),
  condition VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS website_monitoring (
  id CHAR(36) PRIMARY KEY,
  check_type VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'ok',
  last_checked_at TIMESTAMP,
  next_check_at TIMESTAMP,
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backups (
  id CHAR(36) PRIMARY KEY,
  backup_type VARCHAR(50) NOT NULL,
  backup_location VARCHAR(500),
  backup_size INT,
  backup_date TIMESTAMP,
  status VARCHAR(50) DEFAULT 'complete',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- ANALYTICS (Phase 8)
-- ========================
CREATE TABLE IF NOT EXISTS shrinkage_log (
  id CHAR(36) PRIMARY KEY,
  inventory_id CHAR(36),
  reason VARCHAR(50) NOT NULL,
  cost_basis DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  recorded_by CHAR(36),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- MARKETING (Phase 9)
-- ========================
CREATE TABLE IF NOT EXISTS platform_connections (
  id CHAR(36) PRIMARY KEY,
  platform VARCHAR(50) NOT NULL UNIQUE,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  page_id VARCHAR(255),
  page_name VARCHAR(255),
  instagram_account_id VARCHAR(255),
  is_connected TINYINT(1) DEFAULT 0,
  connected_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketing_posts (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(255),
  caption TEXT NOT NULL,
  media_url TEXT,
  media_type VARCHAR(20) DEFAULT 'image',
  platforms JSON,
  status VARCHAR(30) DEFAULT 'draft',
  scheduled_at TIMESTAMP,
  published_at TIMESTAMP,
  track VARCHAR(20) DEFAULT 'prime',
  inventory_id CHAR(36),
  event_id CHAR(36),
  post_results JSON,
  error_details JSON,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketing_post_results (
  id CHAR(36) PRIMARY KEY,
  post_id CHAR(36),
  platform VARCHAR(50) NOT NULL,
  external_post_id VARCHAR(255),
  external_url TEXT,
  status VARCHAR(30) DEFAULT 'published',
  error_message TEXT,
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS local_event_listings (
  id CHAR(36) PRIMARY KEY,
  event_id CHAR(36),
  platform VARCHAR(50) NOT NULL,
  external_event_id VARCHAR(255),
  external_url TEXT,
  title VARCHAR(500),
  description TEXT,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  location TEXT,
  cover_image_url TEXT,
  ticket_url TEXT,
  status VARCHAR(30) DEFAULT 'draft',
  sync_enabled TINYINT(1) DEFAULT 1,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS caption_pool (
  id CHAR(36) PRIMARY KEY,
  caption TEXT NOT NULL,
  tags JSON,
  approved TINYINT(1) DEFAULT 0,
  used_count INT DEFAULT 0,
  last_used_at TIMESTAMP,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================
-- INDEXES
-- ========================
CREATE INDEX idx_inventory_status ON inventory(status);
CREATE INDEX idx_inventory_consignor ON inventory(consignor_id);
CREATE INDEX idx_sales_customer ON sales(customer_id);
CREATE INDEX idx_sales_created ON sales(created_at);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_payments_sale ON payments(sale_id);
CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_created ON activity_log(created_at);
CREATE INDEX idx_time_clock_user ON time_clock(user_id);
CREATE INDEX idx_work_orders_customer ON work_orders(customer_id);
CREATE INDEX idx_work_orders_status ON work_orders(status);
CREATE INDEX idx_trades_customer ON trades(customer_id);
CREATE INDEX idx_trades_created ON trades(created_at);
CREATE INDEX idx_trade_items_trade ON trade_items(trade_id);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_event_registrations_event ON event_registrations(event_id);
CREATE INDEX idx_event_tickets_event ON event_tickets(event_id);
CREATE INDEX idx_marketing_posts_status ON marketing_posts(status);
CREATE INDEX idx_marketing_posts_scheduled ON marketing_posts(scheduled_at);
CREATE INDEX idx_shrinkage_recorded_at ON shrinkage_log(recorded_at);
CREATE INDEX idx_consignors_email ON consignors(email);
CREATE INDEX idx_platform_connections_platform ON platform_connections(platform);

SET FOREIGN_KEY_CHECKS = 1;
