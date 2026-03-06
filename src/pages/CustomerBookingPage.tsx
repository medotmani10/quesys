import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, getOrCreateSessionId } from '@/lib/supabase';
import type { Shop, Barber, Ticket } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, User, Phone, Users, Scissors, AlertCircle, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerBookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [shop, setShop] = useState<Shop | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [peopleAhead, setPeopleAhead] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [peopleCount, setPeopleCount] = useState(1);
  const [selectedBarber, setSelectedBarber] = useState<string>('any');

  useEffect(() => { if (slug) loadShopData(); }, [slug]);
  useEffect(() => { if (activeTicket) subscribeToTicketUpdates(); }, [activeTicket?.id]);

  const loadShopData = async () => {
    if (!slug) return;
    try {
      const { data: shopData, error: shopError } = await supabase.from('shops').select('*').eq('slug', slug).single();
      if (shopError || !shopData) { toast.error('الصالون غير موجود'); navigate('/'); return; }
      setShop(shopData as Shop);
      const { data: barbersData } = await supabase.from('barbers').select('*').eq('shop_id', shopData.id).eq('is_active', true);
      setBarbers((barbersData as Barber[]) || []);
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
    return () => { subscription.unsubscribe(); };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    if (!name.trim() || !phone.trim()) { toast.error('يرجى ملء جميع الحقول'); return; }
    setSubmitting(true);
    try {
      const sessionId = getOrCreateSessionId();
      const { data: ticketNumberData, error: ticketNumError } = await supabase.rpc('get_next_ticket_number', { p_shop_id: shop.id });
      if (ticketNumError) { toast.error('فشل في إنشاء التذكرة'); setSubmitting(false); return; }
      const { data: ticket, error } = await supabase.from('tickets').insert({
        shop_id: shop.id,
        barber_id: selectedBarber === 'any' ? null : selectedBarber,
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
    try {
      const { error } = await supabase.from('tickets').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('id', activeTicket.id);
      if (error) throw error;
      toast.success('تم إلغاء التذكرة');
      setActiveTicket(null);
    } catch { toast.error('فشل إلغاء التذكرة'); }
  };

  const getBarberName = (barberId: string | null) => {
    if (!barberId) return 'أي حلاق متاح';
    return barbers.find(b => b.id === barberId)?.name || 'غير معروف';
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
  if (activeTicket) return (
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
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">رقم التذكرة</p>
            <div className={`text-8xl font-black mb-6 ${activeTicket.status === 'serving' ? 'text-green-400' : 'text-yellow-400'}`}>
              {activeTicket.ticket_number}
            </div>

            <div className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-black mb-8 ${activeTicket.status === 'serving' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/30'}`}>
              <div className={`w-2 h-2 rounded-full animate-pulse ${activeTicket.status === 'serving' ? 'bg-green-400' : 'bg-yellow-400'}`} />
              {activeTicket.status === 'serving' ? 'دورك الآن! تفضل للحلاق' : 'في قائمة الانتظار'}
            </div>

            {activeTicket.status === 'waiting' && (
              <div className="bg-black border border-zinc-800 rounded-xl p-6 mb-8">
                <p className="text-zinc-500 text-xs font-bold mb-2">أشخاص قبلك</p>
                <p className="text-6xl font-black text-white">{peopleAhead}</p>
              </div>
            )}

            <div className="space-y-3 text-sm text-right bg-black/50 border border-zinc-800 rounded-xl p-5 mb-8">
              {[
                { icon: <User className="w-4 h-4 text-yellow-400" />, label: 'الاسم', value: activeTicket.customer_name },
                { icon: <Scissors className="w-4 h-4 text-yellow-400" />, label: 'الحلاق', value: getBarberName(activeTicket.barber_id) },
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

            {/* Barber select */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-zinc-300 text-sm font-bold">
                <Scissors className="w-4 h-4 text-yellow-400" /> اختر الحلاق (اختياري)
              </Label>
              <Select value={selectedBarber} onValueChange={setSelectedBarber}>
                <SelectTrigger className="rounded-xl h-12 bg-black border-zinc-700 text-white focus:ring-yellow-400">
                  <SelectValue placeholder="أي حلاق متاح" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700 text-white rounded-xl">
                  <SelectItem value="any" className="focus:bg-yellow-400/10 focus:text-yellow-400 cursor-pointer">أي حلاق متاح</SelectItem>
                  {barbers.map((barber) => (
                    <SelectItem key={barber.id} value={barber.id} className="focus:bg-yellow-400/10 focus:text-yellow-400 cursor-pointer">{barber.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Submit */}
            <Button type="submit" className="w-full rounded-xl h-14 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-lg mt-2 transition-all hover:scale-[1.02]" disabled={submitting}>
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تأكيد الحجز ✂️'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
