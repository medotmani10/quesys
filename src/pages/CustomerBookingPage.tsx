import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, getOrCreateSessionId } from '@/lib/supabase';
import type { Shop, Barber, Ticket } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, User, Phone, Users, Scissors, AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import ActiveTicketCard from '@/components/booking/ActiveTicketCard';
import ShopClosedScreen from '@/components/booking/ShopClosedScreen';

/** Returns the per-barber display code, e.g. "A1" for the 1st barber, "B1" for the 2nd. */
export function getTicketCode(barberIndex: number | undefined, ticketNumber: number): string {
  const prefix = barberIndex !== undefined && barberIndex >= 0
    ? String.fromCharCode(65 + (barberIndex % 26))
    : '#';
  return `${prefix}${ticketNumber}`;
}

export default function CustomerBookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [shop, setShop] = useState<Shop | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [barberQueueCounts, setBarberQueueCounts] = useState<Record<string, number>>({});
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [peopleAhead, setPeopleAhead] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [peopleCount, setPeopleCount] = useState(1);
  const [selectedBarber, setSelectedBarber] = useState<string>('');

  useEffect(() => { if (slug) loadShopData(); }, [slug]);

  useEffect(() => {
    if (activeTicket) return subscribeToTicketUpdates();
  }, [activeTicket?.id]);

  useEffect(() => {
    if (!shop) return;

    // Update barber list + queue counts + shop status in realtime
    const channel = supabase.channel(`customer_booking_${shop.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barbers', filter: `shop_id=eq.${shop.id}` }, async () => {
        const { data: barbersData } = await supabase.from('barbers').select('*').eq('shop_id', shop.id).eq('is_active', true).order('created_at', { ascending: true });
        if (barbersData) {
          setBarbers(barbersData as Barber[]);
          setSelectedBarber(current => {
            if (current && !barbersData.find(b => b.id === current)) {
              toast.error('عذراً، هذا الحلاق لم يعد متاحاً الآن');
              return '';
            }
            return current;
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shops', filter: `id=eq.${shop.id}` }, (payload) => {
        setShop(payload.new as Shop);
      })
      // Refresh queue counts whenever any ticket in the shop changes
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `shop_id=eq.${shop.id}` }, async () => {
        const { data: waitingTickets } = await supabase
          .from('tickets')
          .select('barber_id, people_count')
          .eq('shop_id', shop.id)
          .eq('status', 'waiting');
        const counts: Record<string, number> = {};
        (waitingTickets || []).forEach((t: any) => {
          if (t.barber_id) {
            counts[t.barber_id] = (counts[t.barber_id] || 0) + (t.people_count || 1);
          }
        });
        setBarberQueueCounts(counts);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shop?.id]);

  const loadShopData = async () => {
    if (!slug) return;
    try {
      const { data: shopData, error: shopError } = await supabase.from('shops').select('*').eq('slug', slug).single();
      if (shopError || !shopData) { toast.error('الصالون غير موجود'); navigate('/'); return; }
      setShop(shopData as Shop);

      const { data: barbersData } = await supabase.from('barbers').select('*').eq('shop_id', shopData.id).eq('is_active', true).order('created_at', { ascending: true });
      const bList = (barbersData as Barber[]) || [];
      setBarbers(bList);

      // Queue counts — only fetch barber_id + people_count (no PII)
      const { data: waitingTickets } = await supabase.from('tickets').select('barber_id, people_count').eq('shop_id', shopData.id).eq('status', 'waiting');
      const counts: Record<string, number> = {};
      bList.forEach(b => { counts[b.id] = 0; });
      (waitingTickets || []).forEach((t: any) => {
        if (t.barber_id && counts[t.barber_id] !== undefined) counts[t.barber_id] += (t.people_count || 1);
      });
      setBarberQueueCounts(counts);

      // Check for existing active ticket for this session
      const sessionId = getOrCreateSessionId();
      const { data: ticketsData } = await supabase.from('tickets').select('*').eq('shop_id', shopData.id).eq('user_session_id', sessionId).in('status', ['waiting', 'serving']).order('created_at', { ascending: false }).limit(1);
      if (ticketsData && ticketsData.length > 0) {
        const ticket = ticketsData[0] as Ticket;
        setActiveTicket(ticket);
        await calculatePeopleAhead(ticket);
      }
    } catch { toast.error('حدث خطأ في تحميل البيانات'); }
    finally { setLoading(false); }
  };

  // FIX 4: Use server-side aggregation RPC instead of fetching all rows (N+1 fix)
  const calculatePeopleAhead = async (ticket: Ticket) => {
    const { data, error } = await supabase.rpc('get_people_ahead', {
      p_shop_id: ticket.shop_id,
      p_barber_id: ticket.barber_id,
      p_created_at: ticket.created_at,
    });
    if (!error) setPeopleAhead(data ?? 0);
  };

  const subscribeToTicketUpdates = () => {
    if (!activeTicket) return;
    const subscription = supabase.channel(`ticket_${activeTicket.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `id=eq.${activeTicket.id}` }, (payload) => {
        const updatedTicket = payload.new as Ticket;
        setActiveTicket(updatedTicket);
        if (updatedTicket.status === 'serving') toast.success('دورك الآن! تفضل للحلاق');
        else if (updatedTicket.status === 'completed') { toast.info('تم إنهاء الخدمة، شكراً!'); setActiveTicket(null); }
        else if (updatedTicket.status === 'canceled') { toast.error('تم إلغاء التذكرة'); setActiveTicket(null); }
      }).subscribe();
    return () => { supabase.removeChannel(subscription); };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    if (!name.trim() || !phone.trim()) { toast.error('يرجى ملء جميع الحقول'); return; }
    if (!/^[+]?[\d\s()-]{5,15}$/.test(phone.trim())) { toast.error('رقم الهاتف غير صحيح'); return; }
    if (!selectedBarber) { toast.error('يرجى اختيار الحلاق أولاً'); return; }

    setSubmitting(true);
    try {
      const sessionId = getOrCreateSessionId();

      // FIX 3: Single atomic RPC — eliminates race condition on ticket_number
      const { data: ticket, error } = await supabase.rpc('create_ticket', {
        p_shop_id: shop.id,
        p_barber_id: selectedBarber,
        p_name: name.trim(),
        p_phone: phone.trim(),
        p_people: peopleCount,
        p_session_id: sessionId,
      });

      if (error) {
        if (error.message.includes('shop_closed')) toast.error('عذراً — الصالون مغلق حالياً');
        else if (error.message.includes('duplicate_active_ticket')) toast.error('لديك حجز نشط بالفعل');
        else toast.error('فشل في إنشاء التذكرة');
        setSubmitting(false);
        return;
      }

      // create_ticket returns SETOF tickets — first row is the new ticket
      const newTicket = (Array.isArray(ticket) ? ticket[0] : ticket) as Ticket;
      setActiveTicket(newTicket);
      await calculatePeopleAhead(newTicket);
      toast.success('تم إنشاء التذكرة!');
    } catch { toast.error('حدث خطأ غير متوقع'); }
    finally { setSubmitting(false); }
  };

  const handleCancelTicket = async () => {
    if (!activeTicket) return;
    const confirmed = window.confirm('هل أنت متأكد من إلغاء الحجز؟');
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('tickets').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', activeTicket.id);
      if (error) throw error;
      toast.success('تم إلغاء التذكرة');
      setActiveTicket(null);
    } catch { toast.error('فشل إلغاء التذكرة'); }
  };

  // ─── LOADING ───
  if (loading) return (
    <div className="min-h-[100dvh] bg-black flex items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-yellow-400" />
    </div>
  );

  // ─── NOT FOUND ───
  if (!shop) return (
    <div className="min-h-[100dvh] bg-black flex items-center justify-center p-4">
      <div className="text-center max-w-sm w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-10">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-black text-white mb-3">الصالون غير موجود</h2>
        <p className="text-zinc-400 mb-8">الرابط غير صحيح أو الصالون لم يعد متاحاً</p>
        <Button onClick={() => navigate('/')} className="w-full h-12 bg-yellow-400 hover:bg-yellow-300 text-black font-black rounded-xl">العودة للرئيسية</Button>
      </div>
    </div>
  );

  // ─── CLOSED ─── (extracted component)
  if (!shop.is_open) return <ShopClosedScreen shopName={shop.name} />;

  // ─── ACTIVE TICKET ─── (extracted component)
  if (activeTicket) return (
    <ActiveTicketCard
      ticket={activeTicket}
      peopleAhead={peopleAhead}
      barbers={barbers}
      onCancel={handleCancelTicket}
    />
  );

  // ─── BOOKING FORM ───
  return (
    <div className="min-h-[100dvh] bg-black p-4 flex flex-col" dir="rtl">
      <div className="w-full max-w-xl mx-auto pt-6 pb-10 flex-1 flex flex-col">

        {/* Shop Header */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-5">
          <div className="h-1 bg-yellow-400 w-full" />
          <div className="p-6 text-center">
            {shop.logo_url
              ? <img src={shop.logo_url} alt={shop.name} className="w-20 h-20 object-contain rounded-xl border border-zinc-700 mx-auto mb-4 p-2 bg-zinc-800" />
              : <div className="w-20 h-20 bg-yellow-400 rounded-xl flex items-center justify-center mx-auto mb-4"><Scissors className="w-10 h-10 text-black" /></div>
            }
            <h1 className="text-2xl font-black text-white mb-3">{shop.name}</h1>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {shop.maps_url && (
                <Button variant="ghost" size="sm" onClick={() => window.open(shop.maps_url!, '_blank')}
                  className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 rounded-xl font-bold text-xs">
                  <MapPin className="w-4 h-4 mr-1" /> الموقع
                </Button>
              )}
              {shop.phone && (
                <Button variant="ghost" size="sm" onClick={() => window.open(`tel:${shop.phone}`, '_self')}
                  className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 rounded-xl font-bold text-xs">
                  <Phone className="w-4 h-4 mr-1" /> {shop.phone}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-zinc-800">
            <h2 className="text-xl font-black text-white">احجز مكانك</h2>
            <p className="text-zinc-500 text-sm mt-1">انضم لقائمة الانتظار بسرعة</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Barber selection */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-zinc-300 text-sm font-bold">
                <Scissors className="w-4 h-4 text-yellow-400" />
                اختر الحلاق
                <span className="text-red-400 text-xs font-black">*</span>
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {barbers.filter(b => b.is_active !== false).map((barber) => {
                  const isSelected = selectedBarber === barber.id;
                  const queueCount = barberQueueCounts[barber.id] ?? 0;
                  return (
                    <button
                      key={barber.id}
                      type="button"
                      onClick={() => setSelectedBarber(barber.id)}
                      className={`relative flex items-center gap-4 p-4 rounded-xl border-2 text-right transition-all duration-200 ${isSelected
                        ? 'bg-yellow-400/10 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.15)]'
                        : 'bg-black border-zinc-800 hover:border-zinc-600'
                        }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-black text-xl transition-all ${isSelected ? 'bg-yellow-400 text-black' : 'bg-zinc-900 text-zinc-400'}`}>
                        {(barber.name?.trim() || 'X')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-black text-base leading-tight truncate ${isSelected ? 'text-yellow-400' : 'text-white'}`}>
                          {barber.name}
                        </p>
                        <p className={`text-xs mt-0.5 font-bold ${queueCount === 0 ? 'text-green-400' : 'text-zinc-500'}`}>
                          {queueCount === 0 ? 'لا انتظار ✓' : `${queueCount} ${queueCount === 1 ? 'شخص' : 'أشخاص'} بالانتظار`}
                        </p>
                      </div>
                      {isSelected && <CheckCircle className="w-5 h-5 text-yellow-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {barbers.length === 0 && (
                <p className="text-zinc-500 text-sm text-center py-4">لا يوجد حلاقون نشطون حالياً</p>
              )}
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-zinc-300 text-sm font-bold">
                <User className="w-4 h-4 text-yellow-400" /> الاسم الكامل
              </Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="محمد أحمد"
                className="rounded-xl h-12 bg-black border-zinc-700 focus-visible:ring-yellow-400 text-white placeholder:text-zinc-600" required />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-zinc-300 text-sm font-bold">
                <Phone className="w-4 h-4 text-yellow-400" /> رقم الهاتف
              </Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xxxxxxxx"
                className="rounded-xl h-12 bg-black border-zinc-700 focus-visible:ring-yellow-400 text-white placeholder:text-zinc-600 text-left"
                dir="ltr" required type="tel" />
            </div>

            {/* People count */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-zinc-300 text-sm font-bold">
                <Users className="w-4 h-4 text-yellow-400" /> عدد الأشخاص
              </Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button key={num} type="button" onClick={() => setPeopleCount(num)}
                    className={`flex-1 h-12 rounded-xl font-black text-lg transition-all ${peopleCount === num
                      ? 'bg-yellow-400 text-black scale-105'
                      : 'bg-black text-zinc-500 border border-zinc-700 hover:border-yellow-400/50 hover:text-yellow-400'}`}>
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <Button type="submit"
              className="w-full rounded-xl h-14 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-lg mt-2 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100"
              disabled={submitting || !selectedBarber}>
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد الحجز ✂️'}
            </Button>
            {!selectedBarber && (
              <p className="text-center text-red-400/70 text-xs font-bold animate-pulse">
                اختر الحلاق أولاً لتفعيل زر الحجز
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
