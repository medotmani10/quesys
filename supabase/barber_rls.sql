-- Allow barbers to update their own status
CREATE POLICY "Barbers can update their own profile" 
    ON barbers FOR UPDATE 
    USING (auth.uid() = auth_id);
