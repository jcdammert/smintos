-- Add estimate_id FK to appointments (links an appointment to the estimate it was created from)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL;

-- Add appointment_id FK to invoices (links an invoice to the appointment it was created from)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL;
