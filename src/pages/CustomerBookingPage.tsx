import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, getOrCreateSessionId } from '@/lib/supabase';
import type { Shop, Barber, Ticket } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [peopleCount, setPeopleCount] = useState(1);
  const [selectedBarber, setSelectedBarber] = useState<string>('any');

  useEffect(() => {
    if (slug) {
      loadShopData();
    }
  }, [slug]);

  useEffect(() => {
    if (activeTicket) {
      subscribeToTicketUpdates();
    }
  }, [activeTicket?.id]);

  const loadShopData = async () => {
    if (!slug) return;

    try {
      // Get shop by slug
      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('slug', slug)
        .single();

      if (shopError || !shopData) {
        toast.error('الصالون غير موجود');
        navigate('/');
        return;
      }

      setShop(shopData as Shop);

      // Get barbers
      const { data: barbersData } = await supabase
        .from('barbers')
        .select('*')
        .eq('shop_id', shopData.id)
        .eq('is_active', true);

      setBarbers((barbersData as Barber[]) || []);

      // Check for active ticket
      const sessionId = getOrCreateSessionId();
      const { data: ticketsData } = await supabase
        .from('tickets')
        .select('*')
        .eq('shop_id', shopData.id)
        .eq('user_session_id', sessionId)
        .in('status', ['waiting', 'serving'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (ticketsData && ticketsData.length > 0) {
        const ticket = ticketsData[0] as Ticket;
        setActiveTicket(ticket);
        calculatePeopleAhead(ticket, shopData.id);
      }
    } catch (error) {
      toast.error('حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const calculatePeopleAhead = async (ticket: Ticket, shopId: string) => {
    let query = supabase
      .from('tickets')
      .select('id', { count: 'exact' })
      .eq('shop_id', shopId)
      .eq('status', 'waiting')
      .lt('created_at', ticket.created_at);

    if (ticket.barber_id) {
      query = query.eq('barber_id', ticket.barber_id);
    }

    const { count } = await query;
    setPeopleAhead(count || 0);
  };

  const subscribeToTicketUpdates = () => {
    if (!activeTicket) return;

    const subscription = supabase
      .channel(`ticket_${activeTicket.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `id=eq.${activeTicket.id}`,
        },
        (payload) => {
          const updatedTicket = payload.new as Ticket;
          setActiveTicket(updatedTicket);

          if (updatedTicket.status === 'serving') {
            toast.success('دورك الآن! يرجى التوجه إلى الحلاق');
          } else if (updatedTicket.status === 'completed') {
            toast.info('تم إنهاء الخدمة، شكراً لزيارتك!');
            setActiveTicket(null);
          } else if (updatedTicket.status === 'canceled') {
            toast.error('تم إلغاء التذكرة');
            setActiveTicket(null);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!shop) return;
    if (!name.trim() || !phone.trim()) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    setSubmitting(true);

    try {
      const sessionId = getOrCreateSessionId();

      // Get next ticket number using the database function
      const { data: ticketNumberData, error: ticketNumError } = await supabase
        .rpc('get_next_ticket_number', { p_shop_id: shop.id });

      if (ticketNumError) {
        toast.error('فشل في إنشاء التذكرة');
        setSubmitting(false);
        return;
      }

      const ticketNumber = ticketNumberData as number;

      const { data: ticket, error } = await supabase
        .from('tickets')
        .insert({
          shop_id: shop.id,
          barber_id: selectedBarber === 'any' ? null : selectedBarber,
          customer_name: name.trim(),
          phone_number: phone.trim(),
          people_count: peopleCount,
          ticket_number: ticketNumber,
          user_session_id: sessionId,
          status: 'waiting',
        })
        .select()
        .single();

      if (error) {
        toast.error('فشل في إنشاء التذكرة');
        setSubmitting(false);
        return;
      }

      const newTicket = ticket as Ticket;
      setActiveTicket(newTicket);
      calculatePeopleAhead(newTicket, shop.id);
      toast.success('تم إنشاء التذكرة بنجاح!');
    } catch (error) {
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelTicket = async () => {
    if (!activeTicket) return;

    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', activeTicket.id);

      if (error) throw error;

      toast.success('تم إلغاء التذكرة');
      setActiveTicket(null);
    } catch (error) {
      toast.error('فشل إلغاء التذكرة');
    }
  };

  const openMaps = () => {
    if (shop?.maps_url) {
      window.open(shop.maps_url, '_blank');
    }
  };

  const getBarberName = (barberId: string | null) => {
    if (!barberId) return 'أي حلاق متاح';
    const barber = barbers.find(b => b.id === barberId);
    return barber?.name || 'غير معروف';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
        <Card className="rounded-[2rem] text-center p-10 bg-slate-900/80 backdrop-blur-xl border-white/5 shadow-2xl relative z-10 max-w-sm w-full">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">الصالون غير موجود</h2>
          <p className="text-slate-400 mb-8 text-lg">عذراً، الرابط الذي تبحث عنه غير صحيح</p>
          <Button onClick={() => navigate('/')} className="w-full rounded-2xl h-14 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-lg shadow-glow">
            العودة للرئيسية
          </Button>
        </Card>
      </div>
    );
  }

  if (!shop.is_open) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
        <div className="max-w-md mx-auto pt-12 relative z-10">
          <Card className="rounded-[2rem] shadow-2xl border border-white/5 bg-slate-900/80 backdrop-blur-xl overflow-hidden">
            <div className="h-40 bg-slate-950 flex items-center justify-center relative border-b border-white/5">
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
              {shop.logo_url ? (
                <img src={shop.logo_url} alt={shop.name} className="w-24 h-24 object-contain rounded-2xl bg-slate-900 border border-white/10 p-2 relative z-10 shadow-lg" />
              ) : (
                <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center relative z-10 shadow-glow">
                  <Scissors className="w-10 h-10 text-slate-950" />
                </div>
              )}
            </div>
            <CardContent className="p-8 text-center">
              <h1 className="text-3xl font-bold text-white mb-3">{shop.name}</h1>
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full text-base font-medium mt-4">
                <AlertCircle className="w-5 h-5" />
                الصالون مغلق حالياً
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Tracking View - Active Ticket
  if (activeTicket) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
        <div className="max-w-md mx-auto pt-8 relative z-10">
          {/* Shop Header */}
          <div className="flex items-center gap-4 mb-8 bg-slate-900/50 p-4 rounded-[2rem] border border-white/5 backdrop-blur-md">
            {shop.logo_url ? (
              <img src={shop.logo_url} alt={shop.name} className="w-14 h-14 object-contain rounded-2xl bg-slate-950 border border-white/10" />
            ) : (
              <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-glow">
                <Scissors className="w-7 h-7 text-slate-950" />
              </div>
            )}
            <div>
              <h2 className="font-bold text-lg text-white">{shop.name}</h2>
              <p className="text-sm text-amber-500">نظام الانتظار الذكي</p>
            </div>
          </div>

          {/* Ticket Card VIP */}
          <Card className="rounded-[2.5rem] shadow-2xl shadow-black/80 border border-amber-500/20 bg-gradient-to-b from-slate-950 via-slate-900 to-black overflow-hidden mb-8 relative group">
            <div className={`absolute top-0 w-full h-2 ${activeTicket.status === 'serving' ? 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'bg-amber-500 shadow-glow'}`} />

            {/* Corner decorations */}
            <div className="absolute top-4 left-4 w-16 h-16 border-t-2 border-l-2 border-amber-500/30 rounded-tl-2xl opacity-50"></div>
            <div className="absolute top-4 right-4 w-16 h-16 border-t-2 border-r-2 border-amber-500/30 rounded-tr-2xl opacity-50"></div>

            <CardContent className="p-8 text-center pt-12 relative z-10">
              <div className="mb-10 relative">
                <p className="text-amber-500/70 text-xs mb-3 font-bold tracking-[0.2em] uppercase">رقم التذكرة الملكية</p>
                <div className="text-6xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-amber-200 via-amber-500 to-amber-700 tracking-tighter drop-shadow-2xl">
                  <span className="text-amber-600/50 mr-2 text-4xl sm:text-6xl">#</span>{activeTicket.ticket_number}
                </div>
              </div>

              <div className={`inline-flex items-center gap-2 px-6 sm:px-8 py-2 sm:py-3 rounded-full text-sm sm:text-base font-bold mb-10 transition-all ${activeTicket.status === 'serving'
                ? 'bg-green-500/10 text-green-400 border border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.2)]'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-glow'
                }`}>
                {activeTicket.status === 'serving' ? (
                  <>
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /> دورك الآن! تفضل للحلاق
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" /> قيد الانتظار
                  </>
                )}
              </div>

              {activeTicket.status === 'waiting' && (
                <div className="bg-black/50 border border-amber-500/10 rounded-3xl p-6 mb-10 transform transition-all group-hover:border-amber-500/30">
                  <p className="text-slate-400 text-sm mb-2 font-medium">الأشخاص أمامك</p>
                  <p className="text-5xl sm:text-6xl font-black text-white drop-shadow-lg">{peopleAhead}</p>
                </div>
              )}

              <div className="space-y-5 text-base text-slate-300 bg-black/40 p-6 rounded-3xl border border-white/5 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-sm font-medium">الاسم</span>
                  <div className="flex items-center gap-2 font-bold text-white">
                    <User className="w-4 h-4 text-amber-500" />
                    <span>{activeTicket.customer_name}</span>
                  </div>
                </div>
                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-sm font-medium">الحلاق</span>
                  <div className="flex items-center gap-2 font-bold text-white">
                    <Scissors className="w-4 h-4 text-amber-500" />
                    <span>{getBarberName(activeTicket.barber_id)}</span>
                  </div>
                </div>
                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-sm font-medium">العدد</span>
                  <div className="flex items-center gap-2 font-bold text-white">
                    <Users className="w-4 h-4 text-amber-500" />
                    <span>{activeTicket.people_count} {activeTicket.people_count === 1 ? 'شخص' : 'أشخاص'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            {/* Live Indicator */}
            <div className="flex items-center justify-center gap-3 text-sm text-amber-500/80 font-bold bg-amber-500/5 py-4 rounded-full border border-amber-500/20 backdrop-blur-sm shadow-glow">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                النظام متصل ويتم التحديث تلقائياً
              </div>
            </div>

            {/* Cancel Button */}
            {activeTicket.status === 'waiting' && (
              <Button
                onClick={handleCancelTicket}
                variant="outline"
                className="w-full rounded-2xl h-14 border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40 transition-all font-bold text-base"
              >
                <X className="w-5 h-5 mr-2" />
                إلغاء الحجز
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Booking Form
  return (
    <div className="min-h-screen bg-slate-950 p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>

      <div className="max-w-md mx-auto pt-6 relative z-10">
        {/* Shop Header */}
        <Card className="rounded-[2rem] shadow-2xl shadow-black/50 border border-white/5 overflow-hidden mb-6 bg-slate-900/80 backdrop-blur-xl">
          <div className="h-28 bg-slate-950 flex items-center justify-center relative border-b border-white/5">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-50"></div>
            {shop.logo_url ? (
              <img src={shop.logo_url} alt={shop.name} className="w-20 h-20 object-contain rounded-2xl bg-slate-900 border border-white/10 p-2 relative z-10 shadow-lg" />
            ) : (
              <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center relative z-10 shadow-glow">
                <Scissors className="w-10 h-10 text-slate-950" />
              </div>
            )}
          </div>
          <CardContent className="p-5 text-center">
            <h1 className="text-2xl font-bold text-white">{shop.name}</h1>
            {shop.maps_url && (
              <Button
                variant="ghost"
                size="sm"
                onClick={openMaps}
                className="mt-3 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-xl"
              >
                <MapPin className="w-4 h-4 mr-1.5" />
                عرض الموقع الجغرافي
              </Button>
            )}
            {shop.phone && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(`tel:${shop.phone}`, '_self')}
                className="mt-2 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-xl w-full sm:w-auto font-bold"
              >
                <Phone className="w-4 h-4 mr-1.5" />
                {shop.phone}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Booking Form */}
        <Card className="rounded-[2.5rem] shadow-2xl shadow-black/80 border border-amber-500/10 bg-gradient-to-b from-slate-950 to-black backdrop-blur-xl overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent opacity-50"></div>

          <CardContent className="p-8 relative z-10">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 mb-2">احجز مكانك</h2>
              <p className="text-sm text-slate-400 font-medium">انضم لقائمة الانتظار بكل سهولة</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-slate-300 font-medium">
                  <User className="w-5 h-5 text-amber-500 max-w-full" />
                  الاسم الكامل
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="محمد أحمد"
                  className="rounded-2xl h-14 bg-black/50 border-white/5 focus-visible:ring-amber-500 focus-visible:border-amber-500/50 text-white placeholder:text-slate-600 text-lg transition-all hover:border-amber-500/30"
                  required
                />
              </div>

              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-slate-300 font-medium">
                  <Phone className="w-5 h-5 text-amber-500 max-w-full" />
                  رقم الهاتف
                </Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                  className="rounded-2xl h-14 bg-black/50 border-white/5 focus-visible:ring-amber-500 focus-visible:border-amber-500/50 text-white placeholder:text-slate-600 text-lg text-left transition-all hover:border-amber-500/30"
                  dir="ltr"
                  required
                  type="tel"
                />
              </div>

              <div className="space-y-4">
                <Label className="flex items-center gap-2 text-slate-300 font-medium">
                  <Users className="w-5 h-5 text-amber-500 max-w-full" />
                  عدد الأشخاص
                </Label>
                <div className="flex gap-3">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPeopleCount(num)}
                      className={`flex-1 h-14 rounded-2xl font-black text-xl transition-all duration-300 ${peopleCount === num
                        ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-110 border-none'
                        : 'bg-black/50 text-slate-400 border border-white/5 hover:bg-amber-500/10 hover:border-amber-500/30 hover:text-amber-500'
                        }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Label className="flex items-center gap-2 text-slate-300 font-medium">
                  <Scissors className="w-5 h-5 text-amber-500 max-w-full" />
                  اختر الحلاق الخاص بك (اختياري)
                </Label>
                <Select value={selectedBarber} onValueChange={setSelectedBarber}>
                  <SelectTrigger className="rounded-2xl h-14 bg-black/50 border-white/5 text-white focus:ring-amber-500 focus:border-amber-500/50 transition-all hover:border-amber-500/30">
                    <SelectValue placeholder="أي حلاق متاح" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-amber-500/20 text-white rounded-2xl shadow-2xl">
                    <SelectItem value="any" className="focus:bg-amber-500/20 focus:text-amber-400 rounded-xl cursor-pointer">أي حلاق متاح</SelectItem>
                    {barbers.map((barber) => (
                      <SelectItem key={barber.id} value={barber.id} className="focus:bg-amber-500/20 focus:text-amber-400 border-t border-white/5 mt-1 pt-1 rounded-xl cursor-pointer">
                        {barber.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="w-full rounded-2xl h-16 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xl font-bold mt-8 shadow-glow transition-all hover:scale-[1.02]"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  'تأكيد الحجز'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
