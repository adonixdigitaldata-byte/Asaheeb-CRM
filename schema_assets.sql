-- ============================================================
-- ASAHEEB CRM — COMPANY ASSETS & EQUIPMENT MANAGEMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS company_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_tag TEXT UNIQUE, -- E.g. AST-1001
  name TEXT NOT NULL, -- E.g. "MacBook Pro M3", "iPhone 15 Pro", "STC 5G Data SIM"
  category TEXT NOT NULL DEFAULT 'Laptop', -- Laptop, Phone, SIM Card, Vehicle, Key / Access, Tablet, Monitor, Other
  model_number TEXT,
  serial_number TEXT,
  sim_number TEXT, -- SIM Card ICCID or Phone Number
  sim_carrier TEXT, -- STC, Mobily, Zain, Salam, Red Bull Mobile, Virgin, etc.
  status TEXT NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, ASSIGNED, MAINTENANCE, LOST, RETIRED
  condition TEXT NOT NULL DEFAULT 'GOOD', -- NEW, EXCELLENT, GOOD, FAIR, DAMAGED
  
  -- Possession / Assignment info
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,
  assignment_notes TEXT,
  
  -- Financial & Life-cycle specs
  purchase_date DATE,
  purchase_cost NUMERIC(12,2),
  warranty_expiry DATE,
  notes TEXT,
  
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for lightning fast searching and filtering
CREATE INDEX IF NOT EXISTS idx_company_assets_status ON company_assets(status);
CREATE INDEX IF NOT EXISTS idx_company_assets_category ON company_assets(category);
CREATE INDEX IF NOT EXISTS idx_company_assets_assigned_to ON company_assets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_company_assets_serial ON company_assets(serial_number);
CREATE INDEX IF NOT EXISTS idx_company_assets_sim ON company_assets(sim_number);

-- 2. Asset Assignment History & Audit Trail
CREATE TABLE IF NOT EXISTS asset_assignment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES company_assets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'ASSIGNED', 'RETURNED', 'MAINTENANCE', 'STATUS_CHANGE', 'CREATED'
  condition_at_time TEXT,
  notes TEXT,
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_assignment_logs_asset ON asset_assignment_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_assignment_logs_user ON asset_assignment_logs(user_id);

-- RLS Policies
ALTER TABLE company_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_assignment_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view company assets
CREATE POLICY "Allow authenticated read company_assets" 
  ON company_assets FOR SELECT 
  TO authenticated 
  USING (true);

-- Allow authenticated users with role ADMIN or SALES_MANAGER to modify
CREATE POLICY "Allow staff managers to modify company_assets" 
  ON company_assets FOR ALL 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('ADMIN', 'SALES_MANAGER')
    )
  );

CREATE POLICY "Allow authenticated read asset_assignment_logs" 
  ON asset_assignment_logs FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Allow staff managers to insert asset_assignment_logs" 
  ON asset_assignment_logs FOR INSERT 
  TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('ADMIN', 'SALES_MANAGER')
    )
  );
