-- This script fixes the 409 Conflict Error during ticket creation.
-- The error happens because the previous unique index prevented reusing ticket numbers 
-- (which reset every day) if old tickets from previous days were not canceled.

-- 1. Drop the restrictive unique index
DROP INDEX IF EXISTS tickets_unique_number;

-- 2. (Optional but recommended) Recreation of a safer unique index 
-- that ONLY prevents duplicates among CURRENTLY ACTIVE tickets.
-- This allows ticket numbers (e.g. #1, #2) to be reused on different days
-- once the previous tickets are completed or canceled.
CREATE UNIQUE INDEX tickets_unique_number
    ON tickets (shop_id, barber_id, ticket_number)
    WHERE status IN ('waiting', 'serving');
