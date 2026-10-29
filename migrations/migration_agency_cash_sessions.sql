-- =====================================================================
-- Migration : Historique et Gestion des Sessions de Caisse Agence
-- À exécuter dans le SQL Editor de Supabase
-- =====================================================================

CREATE TABLE IF NOT EXISTS agency_cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL,
  session_number TEXT,
  reference TEXT,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now()),
  opened_by TEXT NOT NULL,
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by TEXT,
  opening_fund_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  opening_fund_cdf NUMERIC(14, 2) NOT NULL DEFAULT 0,
  expected_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
  expected_cdf NUMERIC(14, 2) NOT NULL DEFAULT 0,
  counted_usd NUMERIC(12, 2),
  counted_cdf NUMERIC(14, 2),
  diff_usd NUMERIC(12, 2) DEFAULT 0,
  diff_cdf NUMERIC(14, 2) DEFAULT 0,
  discrepancy_reason TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  notes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_agency_cash_sessions_agency ON agency_cash_sessions(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_cash_sessions_status ON agency_cash_sessions(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_agency_cash_sessions_created ON agency_cash_sessions(created_at DESC);

-- RLS
ALTER TABLE agency_cash_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agency_cash_sessions_all" ON agency_cash_sessions;
CREATE POLICY "agency_cash_sessions_all" ON agency_cash_sessions FOR ALL USING (true);
