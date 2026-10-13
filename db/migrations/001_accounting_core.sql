-- Nabd Finance: Phase 1 accounting core (PostgreSQL 16+)
-- All financial document writes must be executed by the application in one DB transaction.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE tenants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE companies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), name text NOT NULL, base_currency char(3) NOT NULL DEFAULT 'ILS', tax_number text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE fiscal_years (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), name text NOT NULL, starts_on date NOT NULL, ends_on date NOT NULL, status text NOT NULL CHECK(status IN ('OPEN','CLOSED')), UNIQUE(company_id,name), CHECK(ends_on>=starts_on));
CREATE TABLE accounting_periods (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), fiscal_year_id uuid NOT NULL REFERENCES fiscal_years(id), starts_on date NOT NULL, ends_on date NOT NULL, status text NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','CLOSED')), UNIQUE(fiscal_year_id,starts_on), CHECK(ends_on>=starts_on));
CREATE TABLE accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), code text NOT NULL, name_ar text NOT NULL, account_type text NOT NULL CHECK(account_type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')), normal_balance text NOT NULL CHECK(normal_balance IN ('DEBIT','CREDIT')), is_postable boolean NOT NULL DEFAULT true, parent_id uuid REFERENCES accounts(id), is_active boolean NOT NULL DEFAULT true, UNIQUE(company_id,code));
CREATE TABLE cost_centers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), code text NOT NULL, name_ar text NOT NULL, is_active boolean NOT NULL DEFAULT true, UNIQUE(company_id,code));
CREATE TABLE journal_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), period_id uuid NOT NULL REFERENCES accounting_periods(id), entry_no text NOT NULL, entry_date date NOT NULL, source_type text NOT NULL, source_id uuid, status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','POSTED','REVERSED')), memo text, posted_at timestamptz, posted_by uuid, reversed_entry_id uuid REFERENCES journal_entries(id), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,entry_no));
CREATE TABLE journal_lines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT, line_no integer NOT NULL, account_id uuid NOT NULL REFERENCES accounts(id), cost_center_id uuid REFERENCES cost_centers(id), debit numeric(19,4) NOT NULL DEFAULT 0 CHECK(debit>=0), credit numeric(19,4) NOT NULL DEFAULT 0 CHECK(credit>=0), description text, UNIQUE(journal_entry_id,line_no), CHECK((debit=0) <> (credit=0)));
CREATE TABLE audit_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id), company_id uuid REFERENCES companies(id), actor_id uuid, action text NOT NULL, entity_type text NOT NULL, entity_id uuid NOT NULL, before_data jsonb, after_data jsonb, correlation_id uuid, occurred_at timestamptz NOT NULL DEFAULT now());

CREATE OR REPLACE FUNCTION assert_postable_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE dr numeric(19,4); cr numeric(19,4); period_state text;
BEGIN
  IF NEW.status = 'POSTED' AND OLD.status <> 'POSTED' THEN
    SELECT status INTO period_state FROM accounting_periods WHERE id=NEW.period_id;
    IF period_state <> 'OPEN' THEN RAISE EXCEPTION 'Cannot post into a closed accounting period'; END IF;
    SELECT COALESCE(sum(debit),0), COALESCE(sum(credit),0) INTO dr,cr FROM journal_lines WHERE journal_entry_id=NEW.id;
    IF dr=0 OR dr<>cr THEN RAISE EXCEPTION 'Journal entry is not balanced'; END IF;
    NEW.posted_at := now();
  END IF;
  IF OLD.status='POSTED' AND NEW.status NOT IN ('POSTED','REVERSED') THEN RAISE EXCEPTION 'Posted journals cannot return to draft'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER journal_posting_guard BEFORE UPDATE OF status ON journal_entries FOR EACH ROW EXECUTE FUNCTION assert_postable_journal();

-- Production deployment: use an application role that sets app.tenant_id after authentication.
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_tenant_isolation ON companies USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
