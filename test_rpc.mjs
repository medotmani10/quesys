import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
    console.log('Fetching a shop...');
    const { data: shops } = await supabase.from('shops').select('id').limit(1);
    if (!shops || shops.length === 0) return;
    const shopId = shops[0].id;

    const { data: barbers } = await supabase.from('barbers').select('id').eq('shop_id', shopId).limit(1);
    const barberId = barbers?.[0]?.id || null;

    console.log('Attempting multiple ticket creations via RPC to trigger 409...');
    for (let i = 0; i < 3; i++) {
        const sessionId = 'test_manual_' + Date.now();
        const { data, error } = await supabase.rpc('create_ticket', {
            p_shop_id: shopId,
            p_barber_id: barberId,
            p_name: 'Test Manual Ticket ' + i,
            p_phone: '12345678',
            p_people: 1,
            p_session_id: sessionId,
        });

        if (error) {
            console.log(`\n--- ERROR ON ITERATION ${i} ---`);
            console.log('Error Details:', JSON.stringify(error, null, 2));
            return;
        } else {
            console.log(`Iteration ${i} succeeded, Ticket Number:`, data[0].ticket_number);
        }

        // Also try a raw insert with the EXACT same ticket number to trigger the constraint manually
        if (i === 0) {
            console.log('Attempting raw insert with same ticket number to see constraint info...');
            const ticketNumber = data[0].ticket_number;
            const { error: rawError } = await supabase.from('tickets').insert({
                shop_id: shopId,
                barber_id: barberId,
                customer_name: 'Raw Conflict Test',
                phone_number: '0000',
                ticket_number: ticketNumber, // Force conflict
                user_session_id: 'raw_' + Date.now(),
                status: 'waiting'
            });
            console.log('Raw Insert Error:', JSON.stringify(rawError, null, 2));
        }
    }
}

test();
