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
