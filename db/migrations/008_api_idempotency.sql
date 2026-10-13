CREATE TABLE api_idempotency_keys (
  company_id uuid NOT NULL REFERENCES companies(id), key text NOT NULL, method text NOT NULL, route text NOT NULL,
  response_status integer NOT NULL, response_body jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(company_id,key)
);
