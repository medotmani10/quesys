-- Enable Realtime for the 'barbers' table
BEGIN;

-- Check if the publication exists, and add the table to it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    -- Attempt to add the table to the publication. If it's already there, it catches the error safely.
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE barbers;
    EXCEPTION
      WHEN duplicate_object THEN
        -- Table is already in the publication, do nothing
    END;
  END IF;
END $$;

COMMIT;
