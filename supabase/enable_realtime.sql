-- Enable Realtime for the 'tickets' table
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;

-- Enable Realtime for the 'shops' table (optional, if you want status updates open/closed instantly)
ALTER PUBLICATION supabase_realtime ADD TABLE shops;
