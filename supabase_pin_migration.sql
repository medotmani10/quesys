-- 1. إضافة عمود الحماية pin_code إلى جدول التذاكر (إن لم يكن موجوداً)
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS pin_code text;

-- 2. فهرس لتسريع البحث باستخدام الرابط
CREATE INDEX IF NOT EXISTS idx_tickets_pin_code ON public.tickets(pin_code);

-- 3. إسقاط الدالة القديمة لضمان عدم وجود تضارب في التوقيع (Signature)
DROP FUNCTION IF EXISTS public.create_ticket(uuid, uuid, text, text, integer, text);

-- 4. تحديث دالة إنشاء التذكرة (create_ticket) لتوليد وتخزين الـ PIN عشوائياً ולتجنب خطأ 409 (Unique Constraint)
CREATE OR REPLACE FUNCTION public.create_ticket(
    p_shop_id uuid,
    p_barber_id uuid,
    p_name text,
    p_phone text,
    p_people integer,
    p_session_id text
)
RETURNS SETOF public.tickets
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ticket_number integer;
    v_has_active boolean;
    v_pin_code text;
    v_new_ticket public.tickets;
BEGIN
    -- 1. Check if the shop is currently open
    IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id AND is_open = true) THEN
        RAISE EXCEPTION 'shop_closed';
    END IF;

    -- 2. Prevent the same session from booking again if they already have an active ticket
    SELECT EXISTS (
        SELECT 1 
        FROM public.tickets 
        WHERE shop_id = p_shop_id 
          AND user_session_id = p_session_id 
          AND status IN ('waiting', 'serving')
    ) INTO v_has_active;

    IF v_has_active THEN
        RAISE EXCEPTION 'duplicate_active_ticket';
    END IF;

    -- 3. Generate the next ticket_number safely and atomically
    -- Lock the specific barber's row in the barbers table to prevent race conditions for the same queue
    PERFORM 1 FROM public.barbers WHERE id = p_barber_id AND shop_id = p_shop_id FOR UPDATE;
    
    -- FIXED 409 ERROR: Ensure we also check max ticket number of any currently ACTIVE ticket
    -- so that we never duplicate an active ticket_number if it's from yesterday.
    SELECT COALESCE(MAX(ticket_number), 0) + 1
    INTO v_ticket_number
    FROM public.tickets
    WHERE shop_id = p_shop_id
      AND barber_id = p_barber_id
      AND (
          DATE(created_at AT TIME ZONE 'UTC') = (now() AT TIME ZONE 'UTC')::date
          OR status IN ('waiting', 'serving')
      );

    -- 4. Generate a random and secure 8-character PIN code (alphanumeric uppercase)
    v_pin_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));

    -- 5. Insert the new ticket and return the newly created row
    INSERT INTO public.tickets (
        shop_id, 
        barber_id, 
        customer_name, 
        phone_number, 
        people_count, 
        ticket_number, 
        user_session_id, 
        pin_code,
        status
    ) VALUES (
        p_shop_id,
        p_barber_id,
        p_name,
        p_phone,
        p_people,
        v_ticket_number,
        p_session_id,
        v_pin_code,
        'waiting'
    )
    RETURNING * INTO v_new_ticket;

    RETURN NEXT v_new_ticket;
END;
$$;
