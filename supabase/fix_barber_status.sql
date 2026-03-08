-- 1. Accept updates from the barber themselves
CREATE POLICY "Barbers can update their own profile" 
    ON barbers FOR UPDATE 
    USING (auth.uid() = auth_id);

-- 2. Make sure barbers is in the realtime publication
BEGIN;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE barbers;
    EXCEPTION
      WHEN duplicate_object THEN
        -- already in publication
    END;
  END IF;
END $$;
COMMIT;

-- 3. Ensure replica identity is full so that before/after images are broadcasted if needed
ALTER TABLE barbers REPLICA IDENTITY FULL;
