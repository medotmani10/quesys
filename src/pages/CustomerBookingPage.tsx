import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, getOrCreateSessionId } from '@/lib/supabase';
import type { Shop, Barber, Ticket } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, User, Phone, Users, Scissors, AlertCircle, Loader2, X, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

/** Returns the per-barber display code, e.g. "A001" for Ahmed, ticket 1.
 *  ✅ FIXED H-1: safe against Arabic names, empty strings, and ticket_number > 999 */
export function getTicketCode(barberName: string | null | undefined, ticketNumber: number): string {
  let prefix = '#';
  if (barberName) {
    const trimmed = barberName.trim();
    if (trimmed.length > 0) {
      const firstChar = trimmed[0];
      // If the first char is a Latin letter, use it uppercase
      if (/[a-zA-Z]/.test(firstChar)) {
        prefix = firstChar.toUpperCase();
      } else {
        // For Arabic/other scripts, map to a safe ASCII prefix via charCode mod 26
        // e.g. 'أ' -> code 65 -> 'A', 'م' -> code 77 -> 'M'
        const code = trimmed.charCodeAt(0) % 26;
        prefix = String.fromCharCode(65 + code); // A-Z
      }
    }
  }
  // Cap at 9999 to avoid overflow — show '####' as error code
  if (ticketNumber > 9999) return `${prefix}####`;
  return `${prefix}${String(ticketNumber).padStart(3, '0')}`;
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
  const [selectedBarber, setSelectedBarber] = useState<string>(''); // '' = none selected (required)

  useEffect(() => { if (slug) loadShopData(); }, [slug]);
  useEffect(() => {
    if (activeTicket) return subscribeToTicketUpdates();
  }, [activeTicket?.id]);

  useEffect(() => {
    if (!shop) return;
    const channel = supabase.channel(`customer_booking_barbers_${shop.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'barbers', filter: `shop_id=eq.${shop.id}` }, async () => {
        const { data: barbersData } = await supabase.from('barbers').select('*').eq('shop_id', shop.id).eq('is_active', true).order('name');
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
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shop?.id]);

  const loadShopData = async () => {
    if (!slug) return;
    try {
      const { data: shopData, error: shopError } = await supabase.from('shops').select('*').eq('slug', slug).single();
      if (shopError || !shopData) { toast.error('الصالون غير موجود'); navigate('/'); return; }
      setShop(shopData as Shop);

      const { data: barbersData } = await supabase.from('barbers').select('*').eq('shop_id', shopData.id).eq('is_active', true).order('name');
      const bList = (barbersData as Barber[]) || [];
      setBarbers(bList);

      // Load queue counts per barber for the visual buttons
      const { data: waitingTickets } = await supabase.from('tickets').select('barber_id').eq('shop_id', shopData.id).eq('status', 'waiting');
      const counts: Record<string, number> = {};
      bList.forEach(b => { counts[b.id] = 0; });
      (waitingTickets || []).forEach((t: any) => {
        if (t.barber_id && counts[t.barber_id] !== undefined) counts[t.barber_id]++;
      });
      setBarberQueueCounts(counts);

      const sessionId = getOrCreateSessionId();
      const { data: ticketsData } = await supabase.from('tickets').select('*').eq('shop_id', shopData.id).eq('user_session_id', sessionId).in('status', ['waiting', 'serving']).order('created_at', { ascending: false }).limit(1);
      if (ticketsData && ticketsData.length > 0) {
        const ticket = ticketsData[0] as Ticket;
        setActiveTicket(ticket);
        calculatePeopleAhead(ticket, shopData.id);
      }
    } catch { toast.error('حدث خطأ في تحميل البيانات'); }
    finally { setLoading(false); }
  };

  const calculatePeopleAhead = async (ticket: Ticket, shopId: string) => {
    let query = supabase.from('tickets').select('id', { count: 'exact' }).eq('shop_id', shopId).eq('status', 'waiting').lt('created_at', ticket.created_at);
    if (ticket.barber_id) query = query.eq('barber_id', ticket.barber_id);
    const { count } = await query;
    setPeopleAhead(count || 0);
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
    // ✅ FIXED C-5: return cleanup so useEffect can unsubscribe on re-run
    return () => { supabase.removeChannel(subscription); };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    if (!name.trim() || !phone.trim()) { toast.error('يرجى ملء جميع الحقول'); return; }
    // ✅ FIXED M-1: validate phone number format (5+ digits, optional + prefix)
    if (!/^[+]?[\d\s()-]{5,15}$/.test(phone.trim())) {
      toast.error('رقم الهاتف غير صحيح'); return;
    }
    if (!selectedBarber) { toast.error('يرجى اختيار الحلاق أولاً'); return; }
    setSubmitting(true);
    try {
      // ✅ FIXED H-7: re-fetch shop is_open status before submitting (stale UI guard)
      const { data: freshShop } = await supabase.from('shops').select('is_open').eq('id', shop.id).single();
      if (!freshShop?.is_open) {
        toast.error('عذراً — الصالون مغلق حالياً');
        setSubmitting(false);
        return;
      }
      const sessionId = getOrCreateSessionId();
      const { data: ticketNumberData, error: ticketNumError } = await supabase.rpc('get_next_ticket_number', { p_shop_id: shop.id });
      if (ticketNumError) { toast.error('فشل في إنشاء التذكرة'); setSubmitting(false); return; }
      const { data: ticket, error } = await supabase.from('tickets').insert({
        shop_id: shop.id,
        barber_id: selectedBarber,
        customer_name: name.trim(),
        phone_number: phone.trim(),
        people_count: peopleCount,
        ticket_number: ticketNumberData as number,
        user_session_id: sessionId,
        status: 'waiting',
      }).select().single();
      if (error) { toast.error('فشل في إنشاء التذكرة'); setSubmitting(false); return; }
      const newTicket = ticket as Ticket;
      setActiveTicket(newTicket);
      calculatePeopleAhead(newTicket, shop.id);
      toast.success('تم إنشاء التذكرة!');
    } catch { toast.error('حدث خطأ غير متوقع'); }
    finally { setSubmitting(false); }
  };

  const handleCancelTicket = async () => {
    if (!activeTicket) return;
    // ✅ FIXED H-4: confirm before cancelling to prevent accidental taps
    const confirmed = window.confirm('هل أنت متأكد من إلغاء الحجز؟');
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('tickets').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', activeTicket.id);
      if (error) throw error;
      toast.success('تم إلغاء التذكرة');
      setActiveTicket(null);
    } catch { toast.error('فشل إلغاء التذكرة'); }
  };

  const getBarberById = (barberId: string | null) => barbers.find(b => b.id === barberId) || null;

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

  // ─── CLOSED ───
  if (!shop.is_open) return (
    <div className="min-h-[100dvh] bg-black flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="h-2 bg-red-500 w-full" />
        <div className="p-8 text-center">
          {shop.logo_url
            ? <img src={shop.logo_url} alt={shop.name} className="w-20 h-20 object-contain rounded-xl border border-zinc-700 mx-auto mb-6 p-2" />
            : <div className="w-20 h-20 bg-yellow-400 rounded-xl flex items-center justify-center mx-auto mb-6"><Scissors className="w-10 h-10 text-black" /></div>
          }
          <h1 className="text-2xl font-black text-white mb-4">{shop.name}</h1>
          <div className="inline-flex items-center gap-2 px-5 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-sm font-bold">
            <AlertCircle className="w-4 h-4" /> الصالون مغلق حالياً
          </div>
        </div>
      </div>
    </div>
  );

  // ─── ACTIVE TICKET ───
  if (activeTicket) {
    const activeBarber = getBarberById(activeTicket.barber_id);
    const ticketCode = getTicketCode(activeBarber?.name, activeTicket.ticket_number);
    return (
      <div className="min-h-[100dvh] bg-black p-4">
        <div className="w-full max-w-xl mx-auto pt-6">
          {/* Shop mini-header */}
          <div className="flex items-center gap-3 mb-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            {shop.logo_url
              ? <img src={shop.logo_url} alt={shop.name} className="w-12 h-12 object-contain rounded-xl border border-zinc-700" />
              : <div className="w-12 h-12 bg-yellow-400 rounded-xl flex items-center justify-center shrink-0"><Scissors className="w-6 h-6 text-black" /></div>
            }
            <div>
              <h2 className="font-black text-white text-lg leading-tight">{shop.name}</h2>
              <p className="text-xs text-zinc-500">نظام الانتظار الرقمي</p>
            </div>
          </div>

          {/* Ticket Card */}
          <div className={`rounded-2xl border-2 overflow-hidden mb-6 ${activeTicket.status === 'serving' ? 'border-green-500' : 'border-yellow-400'}`}>
            <div className={`h-2 w-full ${activeTicket.status === 'serving' ? 'bg-green-500' : 'bg-yellow-400'}`} />
            <div className="bg-zinc-900 p-8 text-center">
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">رقم تذكرتك</p>
              <div className={`text-7xl font-black mb-3 tracking-tighter ${activeTicket.status === 'serving' ? 'text-green-400' : 'text-yellow-400'}`}>
                {ticketCode}
              </div>

              {activeBarber && (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-zinc-800 rounded-full mb-5">
                  <Scissors className="w-3.5 h-3.5 text-yellow-400" />
                  <span className="text-zinc-300 text-sm font-bold">{activeBarber.name}</span>
                </div>
              )}

              <div className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-black mb-8 ${activeTicket.status === 'serving' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/30'}`}>
                <div className={`w-2 h-2 rounded-full animate-pulse ${activeTicket.status === 'serving' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                {activeTicket.status === 'serving' ? 'دورك الآن! تفضل للحلاق' : 'في قائمة الانتظار'}
              </div>

              {activeTicket.status === 'waiting' && (
                <div className="bg-black border border-zinc-800 rounded-xl p-6 mb-8">
                  <p className="text-zinc-500 text-xs font-bold mb-2">أشخاص قبلك عند هذا الحلاق</p>
                  <p className="text-6xl font-black text-white">{peopleAhead}</p>
                </div>
              )}

              <div className="space-y-3 text-sm text-right bg-black/50 border border-zinc-800 rounded-xl p-5 mb-8">
                {[
                  { icon: <User className="w-4 h-4 text-yellow-400" />, label: 'الاسم', value: activeTicket.customer_name },
                  { icon: <Scissors className="w-4 h-4 text-yellow-400" />, label: 'الحلاق', value: activeBarber?.name || 'غير محدد' },
                  { icon: <Users className="w-4 h-4 text-yellow-400" />, label: 'العدد', value: `${activeTicket.people_count} ${activeTicket.people_count === 1 ? 'شخص' : 'أشخاص'}` },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-black text-white">{row.icon}{row.value}</div>
                    <span className="text-zinc-600 text-xs">{row.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live + Cancel */}
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-green-400 bg-green-500/5 border border-green-500/20 rounded-xl py-3 mb-4">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            النظام متصل ويتحدث تلقائياً
          </div>

          {activeTicket.status === 'waiting' && (
            <Button onClick={handleCancelTicket} variant="outline"
              className="w-full rounded-xl h-12 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold">
              <X className="w-4 h-4 mr-2" /> إلغاء الحجز
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ─── BOOKING FORM ───
  return (
    <div className="min-h-[100dvh] bg-black p-4 flex flex-col">
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
            {/* Barber selection — REQUIRED, shown FIRST */}
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
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-black text-xl transition-all ${isSelected ? 'bg-yellow-400 text-black' : 'bg-zinc-900 text-zinc-400'
                        }`}>
                        {/* ✅ FIXED M-2: safe access — guard against empty barber name */}
                        {(barber.name?.trim() || 'X')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-black text-base leading-tight truncate ${isSelected ? 'text-yellow-400' : 'text-white'}`}>
                          {barber.name}
                        </p>
                        <p className={`text-xs mt-0.5 font-bold ${queueCount === 0 ? 'text-green-400' : 'text-zinc-500'}`}>
                          {queueCount === 0 ? 'لا انتظار ✓' : `${queueCount} بالانتظار`}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-yellow-400 shrink-0" />
                      )}
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
