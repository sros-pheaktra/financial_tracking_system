-- ============================================================
-- FinTrack – Supabase Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- 1. PROFILES  (extends auth.users)
-- ─────────────────────────────────────────────
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT,
  avatar_url    TEXT,
  currency      TEXT    NOT NULL DEFAULT 'USD',
  theme         TEXT    NOT NULL DEFAULT 'light',   -- 'light' | 'dark'
  monthly_budget NUMERIC(12,2) DEFAULT 6000,
  savings_goal  NUMERIC(12,2) DEFAULT 5000,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 2. CATEGORIES
-- ─────────────────────────────────────────────
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,  -- NULL = system default
  name       TEXT    NOT NULL,
  icon       TEXT,            -- emoji or icon name
  color      TEXT,            -- hex color for charts
  type       TEXT    NOT NULL CHECK (type IN ('income','expense')),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default categories
INSERT INTO categories (id, user_id, name, icon, color, type, is_default) VALUES
  (uuid_generate_v4(), NULL, 'Salary',      '💼', '#4CAF50', 'income',  TRUE),
  (uuid_generate_v4(), NULL, 'Freelance',   '💻', '#8BC34A', 'income',  TRUE),
  (uuid_generate_v4(), NULL, 'Investment',  '📈', '#009688', 'income',  TRUE),
  (uuid_generate_v4(), NULL, 'Rent',        '🏠', '#F44336', 'expense', TRUE),
  (uuid_generate_v4(), NULL, 'Food',        '🍔', '#FF9800', 'expense', TRUE),
  (uuid_generate_v4(), NULL, 'Transport',   '🚗', '#2196F3', 'expense', TRUE),
  (uuid_generate_v4(), NULL, 'Shopping',    '🛍️', '#E91E63', 'expense', TRUE),
  (uuid_generate_v4(), NULL, 'Utilities',   '⚡', '#9C27B0', 'expense', TRUE),
  (uuid_generate_v4(), NULL, 'Healthcare',  '🏥', '#00BCD4', 'expense', TRUE),
  (uuid_generate_v4(), NULL, 'Education',   '📚', '#3F51B5', 'expense', TRUE),
  (uuid_generate_v4(), NULL, 'Entertainment','🎮','#FF5722', 'expense', TRUE),
  (uuid_generate_v4(), NULL, 'Others',      '📦', '#607D8B', 'expense', TRUE);

-- ─────────────────────────────────────────────
-- 3. ACCOUNTS  (bank, wallet, etc.)
-- ─────────────────────────────────────────────
CREATE TABLE accounts (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('checking','savings','credit','cash','investment')),
  balance      NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'USD',
  color        TEXT,
  icon         TEXT,
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 4. TRANSACTIONS
-- ─────────────────────────────────────────────
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
  type            TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description     TEXT,
  merchant        TEXT,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','pending','failed','cancelled')),
  reference_no    TEXT,
  notes           TEXT,
  tags            TEXT[],       -- array of tag strings
  transfer_to     UUID REFERENCES accounts(id) ON DELETE SET NULL,  -- for transfer type
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for common queries
CREATE INDEX idx_transactions_user_date  ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_user_type  ON transactions(user_id, type);
CREATE INDEX idx_transactions_category   ON transactions(category_id);
CREATE INDEX idx_transactions_account    ON transactions(account_id);

-- ─────────────────────────────────────────────
-- 5. BUDGETS
-- ─────────────────────────────────────────────
CREATE TABLE budgets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES categories(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  amount        NUMERIC(12,2) NOT NULL,
  period        TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly','monthly','yearly')),
  start_date    DATE NOT NULL,
  end_date      DATE,
  alert_at_pct  INT DEFAULT 80,    -- send alert when usage hits this %
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 6. SAVINGS GOALS
-- ─────────────────────────────────────────────
CREATE TABLE savings_goals (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  target_amount NUMERIC(12,2) NOT NULL,
  current_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  deadline      DATE,
  icon          TEXT,
  color         TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- 7. ROW-LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals  ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only see/edit their own row
CREATE POLICY "profiles_self" ON profiles
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Accounts
CREATE POLICY "accounts_self" ON accounts
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Transactions
CREATE POLICY "transactions_self" ON transactions
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Budgets
CREATE POLICY "budgets_self" ON budgets
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Savings goals
CREATE POLICY "savings_goals_self" ON savings_goals
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Categories: users can see defaults (user_id IS NULL) + their own
CREATE POLICY "categories_read" ON categories
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "categories_write" ON categories
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─────────────────────────────────────────────
-- 8. HELPER FUNCTIONS & TRIGGERS
-- ─────────────────────────────────────────────

-- Auto-update `updated_at`
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_budgets_updated_at
  BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_savings_goals_updated_at
  BEFORE UPDATE ON savings_goals FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO accounts (user_id, name, type, balance)
  VALUES (
    NEW.id,
    name,
    'cash',
    0
  );

  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_account
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user_account();
