ALTER TABLE companies ADD COLUMN code text;
CREATE UNIQUE INDEX companies_code_unique ON companies(code) WHERE code IS NOT NULL;
