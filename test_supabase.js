import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    console.log('Testing shops...');
    const { data: shops, error: shopsErr } = await supabase.from('shops').select('*').limit(1);
    console.log('Select shops:', { count: shops?.length, error: shopsErr?.message || shopsErr });

    console.log('Testing tickets SELECT...');
    const { data, error } = await supabase.from('tickets').select('*').limit(1);
    console.log('Select tickets:', { count: data?.length, error: error?.message || error });

    console.log('Testing tickets INSERT...');
    const shopId = shops?.[0]?.id || '00000000-0000-0000-0000-000000000000';
    const { data: insertData, error: insertError } = await supabase.from('tickets').insert({
        shop_id: shopId,
        customer_name: 'Test',
        phone_number: '123456789',
        people_count: 1,
        ticket_number: 999,
        user_session_id: 'test_session',
        status: 'waiting'
    }).select();
    console.log('Insert tickets:', { data: insertData, error: insertError?.message || insertError });
}

test();
