ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS call_duration  integer,   -- seconds
  ADD COLUMN IF NOT EXISTS call_status    text,      -- answered, missed, voicemail, no_answer, cancelled
  ADD COLUMN IF NOT EXISTS recording_url  text,      -- URL to the call recording audio file
  ADD COLUMN IF NOT EXISTS transcript     text;      -- call transcript text from GHL
