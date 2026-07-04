-- Default terms on the user record (pre-populates new estimate forms)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS default_terms text;

-- Extra fields on estimates
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS tax_rate    numeric,   -- e.g. 7 = 7%
  ADD COLUMN IF NOT EXISTS deposit_amount numeric, -- dollar amount or percent value
  ADD COLUMN IF NOT EXISTS deposit_type   text,   -- 'fixed' | 'percent'
  ADD COLUMN IF NOT EXISTS terms          text;   -- per-estimate terms text
