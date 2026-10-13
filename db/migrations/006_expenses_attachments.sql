CREATE TABLE attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id),
  entity_type text NOT NULL, entity_id uuid NOT NULL, object_key text NOT NULL, original_name text NOT NULL,
  mime_type text NOT NULL, byte_size bigint NOT NULL CHECK(byte_size>0), uploaded_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cash_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), expense_no text NOT NULL,
  expense_date date NOT NULL, expense_account_id uuid NOT NULL REFERENCES accounts(id), payment_account_id uuid NOT NULL REFERENCES accounts(id),
  cost_center_id uuid REFERENCES cost_centers(id), party_id uuid REFERENCES parties(id), description text NOT NULL,
  amount_before_tax numeric(19,4) NOT NULL CHECK(amount_before_tax>=0), tax_amount numeric(19,4) NOT NULL DEFAULT 0 CHECK(tax_amount>=0),
  status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','POSTED','VOID')), journal_entry_id uuid REFERENCES journal_entries(id), UNIQUE(company_id,expense_no)
);
CREATE TABLE other_incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), income_no text NOT NULL,
  income_date date NOT NULL, income_account_id uuid NOT NULL REFERENCES accounts(id), receipt_account_id uuid NOT NULL REFERENCES accounts(id),
  cost_center_id uuid REFERENCES cost_centers(id), party_id uuid REFERENCES parties(id), description text NOT NULL,
  amount_before_tax numeric(19,4) NOT NULL CHECK(amount_before_tax>=0), tax_amount numeric(19,4) NOT NULL DEFAULT 0 CHECK(tax_amount>=0),
  status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','POSTED','VOID')), journal_entry_id uuid REFERENCES journal_entries(id), UNIQUE(company_id,income_no)
);
