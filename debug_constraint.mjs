import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function checkIndexes() {
    console.log('Checking indexes and constraints on the tickets table...');

    // We can use RPC to run arbitrary SQL if we have a function for it, 
    // but usually we don't. We can however try to cause a 409 and see if the message tells us the constraint.

    // Let's try to fetch all columns and maybe some metadata if possible
    // Using a raw query via a temporary function if allowed, or just guessing.

    // Since I can't run arbitrary SQL easily without a helper, 
    // I will try to trigger the 409 and print the FULL error object.
    // PostgREST errors usually include 'details' and 'hint' which name the constraint.

    const { data: shops } = await supabase.from('shops').select('id').limit(1);
    if (!shops || shops.length === 0) { console.log('No shops found'); return; }
    const shopId = shops[0].id;

    const { data: barbers } = await supabase.from('barbers').select('id').eq('shop_id', shopId).limit(1);
    const barberId = barbers?.[0]?.id || null;

    console.log('Triggering intentional conflict...');
    // 1. Insert a ticket
    const { data: t1, error: e1 } = await supabase.from('tickets').insert({
        shop_id: shopId,
        barber_id: barberId,
        customer_name: 'Conflict Test 1',
        phone_number: '123',
        ticket_number: 9999, // High number to avoid collision with real ones
        user_session_id: 'test_' + Date.now(),
        status: 'waiting'
    }).select();

    if (e1) { console.log('Initial insert failed:', e1); return; }

    // 2. Insert another with same barber/number
    const { error: e2 } = await supabase.from('tickets').insert({
        shop_id: shopId,
        barber_id: barberId,
        customer_name: 'Conflict Test 2',
        phone_number: '123',
        ticket_number: 9999,
        user_session_id: 'test_' + (Date.now() + 1),
        status: 'waiting'
    });

    console.log('Conflict Error Object:');
    console.log(JSON.stringify(e2, null, 2));
}

checkIndexes();
