CREATE TABLE sales_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id),
  customer_id uuid NOT NULL REFERENCES parties(id), invoice_no text NOT NULL, invoice_type text NOT NULL DEFAULT 'TAX' CHECK(invoice_type IN ('TAX','PROFORMA','CLEARING','CREDIT_NOTE')),
  invoice_date date NOT NULL, due_date date NOT NULL, currency char(3) NOT NULL DEFAULT 'ILS', exchange_rate numeric(19,8) NOT NULL DEFAULT 1 CHECK(exchange_rate>0),
  subtotal numeric(19,4) NOT NULL CHECK(subtotal>=0), discount_total numeric(19,4) NOT NULL DEFAULT 0 CHECK(discount_total>=0),
  tax_total numeric(19,4) NOT NULL CHECK(tax_total>=0), total numeric(19,4) NOT NULL CHECK(total>=0),
  approval_status text NOT NULL DEFAULT 'DRAFT' CHECK(approval_status IN ('DRAFT','PENDING_APPROVAL','POSTED','PARTIALLY_PAID','PAID','OVERDUE','VOID')),
  journal_entry_id uuid REFERENCES journal_entries(id), created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,invoice_no)
);
CREATE TABLE sales_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid NOT NULL REFERENCES sales_invoices(id) ON DELETE RESTRICT,
  line_no integer NOT NULL, item_id uuid REFERENCES items(id), description text NOT NULL, quantity numeric(19,4) NOT NULL CHECK(quantity>0),
  unit_price numeric(19,4) NOT NULL CHECK(unit_price>=0), unit_cost numeric(19,4) NOT NULL DEFAULT 0 CHECK(unit_cost>=0),
  discount_amount numeric(19,4) NOT NULL DEFAULT 0 CHECK(discount_amount>=0), tax_rate numeric(7,4) NOT NULL DEFAULT 0 CHECK(tax_rate>=0),
  line_total numeric(19,4) NOT NULL CHECK(line_total>=0), UNIQUE(invoice_id,line_no)
);
ALTER TABLE receivables ADD CONSTRAINT receivables_invoice_fk FOREIGN KEY(invoice_id) REFERENCES sales_invoices(id);
CREATE TABLE document_sequences (company_id uuid NOT NULL REFERENCES companies(id), document_type text NOT NULL, fiscal_year_id uuid NOT NULL REFERENCES fiscal_years(id), next_value bigint NOT NULL DEFAULT 1 CHECK(next_value>0), PRIMARY KEY(company_id,document_type,fiscal_year_id));
CREATE TABLE approval_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), company_id uuid NOT NULL REFERENCES companies(id), entity_type text NOT NULL, entity_id uuid NOT NULL, requested_by uuid REFERENCES users(id), approved_by uuid REFERENCES users(id), amount numeric(19,4) NOT NULL, status text NOT NULL CHECK(status IN ('PENDING','APPROVED','REJECTED','CANCELLED')), created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz);
CREATE INDEX approval_pending_by_company ON approval_requests(company_id,status,created_at) WHERE status='PENDING';
