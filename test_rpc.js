import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'YOUR_URL';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_KEY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    const { data: shops } = await supabase.from('shops').select('*').limit(1);
    const shopId = shops?.[0]?.id;
    const { data: barbers } = await supabase.from('barbers').select('*').eq('shop_id', shopId).limit(1);
    const barberId = barbers?.[0]?.id;

    console.log('Calling process_next_customer with:', { p_barber_id: barberId, p_shop_id: shopId });
    const { data, error } = await supabase.rpc('process_next_customer', {
        p_barber_id: barberId,
        p_shop_id: shopId,
    });

    console.log('Result:', { data, error: error ? JSON.stringify(error, null, 2) : null });
}

test();
