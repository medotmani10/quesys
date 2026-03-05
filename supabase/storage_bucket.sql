-- Create storage bucket for shop logos
INSERT INTO storage.buckets (id, name, public) VALUES ('shop-logos', 'shop-logos', true) ON CONFLICT DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Shop logos are viewable by everyone" 
    ON storage.objects FOR SELECT 
    USING (bucket_id = 'shop-logos');

CREATE POLICY "Shop logos are uploadable by authenticated users" 
    ON storage.objects FOR INSERT 
    WITH CHECK (bucket_id = 'shop-logos' AND auth.role() = 'authenticated');
    
CREATE POLICY "Shop logos are updatable by authenticated users"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'shop-logos' AND auth.role() = 'authenticated');
    
CREATE POLICY "Shop logos are deletable by authenticated users"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'shop-logos' AND auth.role() = 'authenticated');
