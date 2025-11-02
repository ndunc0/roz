-- Add unique constraint to company.website
-- This makes website the primary identifier for companies
ALTER TABLE company
ADD CONSTRAINT company_website_key UNIQUE (website);
