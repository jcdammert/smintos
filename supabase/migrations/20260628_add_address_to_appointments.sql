-- Add job address field to appointments (used for map view pins)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS address TEXT;
