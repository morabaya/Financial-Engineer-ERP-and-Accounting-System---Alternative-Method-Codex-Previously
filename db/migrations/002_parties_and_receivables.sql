CREATE TABLE parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id),
  party_no text NOT NULL, display_name text NOT NULL, tax_number text, phone text, email text,
  credit_limit numeric(19,4) NOT NULL DEFAULT 0 CHECK(credit_limit>=0), is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,party_no)
);
CREATE TABLE party_roles (party_id uuid NOT NULL REFERENCES parties(id) ON DELETE RESTRICT, role text NOT NULL CHECK(role IN ('CUSTOMER','SUPPLIER')), PRIMARY KEY(party_id,role));
CREATE TABLE party_addresses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), party_id uuid NOT NULL REFERENCES parties(id) ON DELETE RESTRICT, address_type text NOT NULL DEFAULT 'PRIMARY', city text, address_line text, is_default boolean NOT NULL DEFAULT false);
CREATE TABLE party_opening_balances (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), party_id uuid NOT NULL REFERENCES parties(id), entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT, amount numeric(19,4) NOT NULL CHECK(amount>0), balance_type text NOT NULL CHECK(balance_type IN ('RECEIVABLE','PAYABLE')), effective_date date NOT NULL);
CREATE TABLE receivables (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), party_id uuid NOT NULL REFERENCES parties(id), invoice_id uuid, due_date date NOT NULL, original_amount numeric(19,4) NOT NULL CHECK(original_amount>0), open_amount numeric(19,4) NOT NULL CHECK(open_amount>=0), status text NOT NULL CHECK(status IN ('OPEN','PARTIAL','PAID','VOID')), UNIQUE(invoice_id));
CREATE TABLE cash_receipts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), party_id uuid NOT NULL REFERENCES parties(id), receipt_no text NOT NULL, receipt_date date NOT NULL, amount numeric(19,4) NOT NULL CHECK(amount>0), cash_account_id uuid NOT NULL REFERENCES accounts(id), journal_entry_id uuid REFERENCES journal_entries(id), status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','POSTED','VOID')), UNIQUE(company_id,receipt_no));
CREATE TABLE receipt_allocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), receipt_id uuid NOT NULL REFERENCES cash_receipts(id) ON DELETE RESTRICT, receivable_id uuid NOT NULL REFERENCES receivables(id) ON DELETE RESTRICT, amount numeric(19,4) NOT NULL CHECK(amount>0), UNIQUE(receipt_id,receivable_id));
CREATE INDEX receivables_open_by_party ON receivables(party_id,status,due_date) WHERE status IN ('OPEN','PARTIAL');
