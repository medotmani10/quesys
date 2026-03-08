import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Shop, Barber, Ticket } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus, LogOut, Archive, Users, Scissors, ChevronLeft, X, Loader2, CheckCircle, Settings, Copy, TrendingUp, Printer, Bell, BellOff, List, AlertCircle, MonitorPlay, Smartphone, ExternalLink, Share2, ListX, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { printThermalTicket } from '@/components/ThermalTicket';
import { playTicketSound } from '@/lib/notificationSound';
import { getTicketCode } from '@/pages/CustomerBookingPage';

/* ─── helpers ─── */
import { cn, getCustomerBaseUrl, getBarberBaseUrl } from '@/lib/utils';

/* ─── StatCard ─── */
function StatCard({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-1 group cursor-default',
      'bg-zinc-950 transition-all duration-300 hover:-translate-y-1',
      color === 'yellow' && 'border-yellow-400/20 hover:border-yellow-400/50 hover:shadow-[0_8px_32px_-4px_rgba(250,204,21,0.25)]',
      color === 'green' && 'border-green-500/20  hover:border-green-500/50  hover:shadow-[0_8px_32px_-4px_rgba(34,197,94,0.2)]',
      color === 'zinc' && 'border-zinc-700/40   hover:border-zinc-500/40   hover:shadow-[0_8px_32px_-4px_rgba(120,120,120,0.15)]',
    )}>
      {/* glow blob */}
      <div className={cn(
        'absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-30 transition-opacity duration-500',
        color === 'yellow' && 'bg-yellow-400',
        color === 'green' && 'bg-green-400',
        color === 'zinc' && 'bg-zinc-400',
      )} />
      <p className="text-xs text-zinc-500 font-semibold uppercase tracking-widest">{label}</p>
      <p className={cn(
        'text-5xl font-black tracking-tight',
        color === 'yellow' && 'text-yellow-400',
        color === 'green' && 'text-green-400',
        color === 'zinc' && 'text-zinc-200',
      )}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  );
}

/* ─── QuickLinks ─── */
function QuickLinks({ shop }: { shop: Shop }) {
  const customerBase = getCustomerBaseUrl();
  const barberBase = getBarberBaseUrl();

  const links = [
    {
      title: 'رابط الزبائن',
      desc: 'للحجز والانضمام للطابور',
      url: `${customerBase}/${shop.slug}`,
      icon: <Users className="w-5 h-5 text-blue-400" />,
      themeClasses: 'hover:border-blue-500/30 hover:shadow-[0_8px_32px_-4px_rgba(59,130,246,0.15)]',
      iconClasses: 'bg-blue-500/10 border-blue-500/20'
    },
    {
      title: 'شاشة العرض (TV)',
      desc: 'لعرض حالة الطابور في الصالون',
      url: `${customerBase}/${shop.slug}/tv`,
      icon: <MonitorPlay className="w-5 h-5 text-purple-400" />,
      themeClasses: 'hover:border-purple-500/30 hover:shadow-[0_8px_32px_-4px_rgba(168,85,247,0.15)]',
      iconClasses: 'bg-purple-500/10 border-purple-500/20'
    },
    {
      title: 'تطبيق الحلاقين',
      desc: 'للوصول إلى لوحة تحكم الحلاق',
      url: `${barberBase}/${shop.slug}/barber/login`,
      icon: <Smartphone className="w-5 h-5 text-emerald-400" />,
      themeClasses: 'hover:border-emerald-500/30 hover:shadow-[0_8px_32px_-4px_rgba(16,185,129,0.15)]',
      iconClasses: 'bg-emerald-500/10 border-emerald-500/20'
    }
  ];

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('تم نسخ الرابط بنجاح ✓');
  };

  const shareLink = async (url: string, title: string, text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (err) {
        console.log('Error sharing', err);
      }
    } else {
      copyLink(url);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {links.map((link, i) => (
        <div key={i} className={cn(
          'flex items-center justify-between p-4 rounded-2xl border bg-zinc-950 transition-all duration-300 hover:-translate-y-1 group border-zinc-800/80',
          link.themeClasses
        )}>
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center border shrink-0', link.iconClasses)}>
              {link.icon}
            </div>
            <div>
              <p className="font-bold text-white text-sm">{link.title}</p>
              <p className="text-xs text-zinc-500">{link.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => shareLink(link.url, link.title, link.desc)} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all" title="مشاركة الرابط">
              <Share2 className="w-4 h-4" />
            </button>
            <button onClick={() => copyLink(link.url)} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all" title="نسخ الرابط">
              <Copy className="w-4 h-4" />
            </button>
            <a href={link.url} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all" title="فتح الرابط">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── TicketRow ─── */
function TicketRow({ ticket, barberIndex, onCancel, onClick }: { ticket: Ticket; barberIndex?: number; onCancel: () => void; onClick?: () => void }) {
  const [pressing, setPressing] = useState(false);
  const code = getTicketCode(barberIndex, ticket.ticket_number);
  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-800',
        'bg-black/60 hover:bg-zinc-900/80 hover:border-yellow-400/20 transition-all duration-200 group/row',
        onClick && 'cursor-pointer',
        pressing && 'scale-[0.98]',
      )}
      onClick={onClick}
      onMouseDown={() => setPressing(true)}
      onMouseUp={() => setPressing(false)}
      onMouseLeave={() => setPressing(false)}
    >
      <div className="flex items-center gap-3">
        <span className="min-w-[2.5rem] h-8 px-1 flex items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-black text-zinc-400 group-hover/row:border-yellow-400/30 group-hover/row:text-yellow-400 transition-colors">
          {code}
        </span>
        <div>
          <p className="text-sm font-bold text-white leading-tight group-hover/row:text-yellow-400 transition-colors">{ticket.customer_name}</p>
          {ticket.people_count > 1 && <p className="text-xs text-zinc-600">{ticket.people_count} أشخاص</p>}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onCancel(); }}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ─── ServingBadge ─── */
function ServingBadge({ ticket, barberIndex, onFinish }: { ticket: Ticket; barberIndex?: number; onFinish: () => void }) {
  const code = getTicketCode(barberIndex, ticket.ticket_number);
  return (
    <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 overflow-hidden relative">
      {/* shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400/5 to-transparent translate-x-[-100%] animate-[shimmer_2.5s_infinite]" />
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs font-bold text-green-400 uppercase tracking-wider">قيد الخدمة</span>
        </div>
        <span className="text-3xl font-black text-white">{code}</span>
      </div>
      <p className="text-sm text-zinc-300 font-semibold mb-3 relative z-10">{ticket.customer_name}</p>
      <Button
        onClick={onFinish}
        size="sm"
        className="w-full rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 hover:border-green-500/40 font-bold h-9 transition-all relative z-10"
        variant="outline"
      >
        <CheckCircle className="w-4 h-4 mr-1.5" /> إنهاء الخدمة
      </Button>
    </div>
  );
}

/* ─── BarberCard ─── */
function BarberCard({
  barber, barberIndex, serving, waiting, processingBarber, onNext, onCancel, onFinish, onTicketClick
}: {
  barber: Barber;
  barberIndex: number;
  serving?: Ticket;
  waiting: Ticket[];
  processingBarber: string | null;
  onNext: () => void;
  onCancel: (id: string) => void;
  onFinish: (id: string) => void;
  onTicketClick: (ticket: Ticket) => void;
}) {
  const isProcessing = processingBarber === barber.id;
  return (
    <div className={cn(
      'flex flex-col bg-zinc-950 border rounded-2xl overflow-hidden transition-all duration-300',
      'hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.8)] hover:-translate-y-1',
      serving ? 'border-green-500/30' : 'border-zinc-800 hover:border-yellow-400/20',
    )}>
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800/80">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg transition-colors',
          serving ? 'bg-green-500/15 text-green-400' : 'bg-yellow-400/10 text-yellow-400'
        )}>
          {String.fromCharCode(65 + (barberIndex % 26))}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-white text-base leading-tight truncate">{barber.name}</h3>
          <p className={cn('text-xs font-semibold', serving ? 'text-green-400' : 'text-zinc-500')}>
            {serving ? 'يخدم عميلاً' : `${waiting.reduce((acc, t) => acc + (t.people_count || 1), 0)} بالانتظار`}
          </p>
        </div>
        {waiting.length > 0 && (
          <span className="bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs font-black px-2.5 py-1 rounded-full">
            {waiting.reduce((acc, t) => acc + (t.people_count || 1), 0)}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        {serving && <ServingBadge ticket={serving} barberIndex={barberIndex} onFinish={() => onFinish(serving.id)} />}

        {/* Next button */}
        <button
          onClick={onNext}
          disabled={isProcessing}
          className={cn(
            'w-full rounded-xl font-black text-base py-3 px-4 flex items-center justify-center gap-2',
            'bg-yellow-400 text-black hover:bg-yellow-300 active:scale-[0.97]',
            'transition-all duration-150 shadow-[0_4px_16px_-2px_rgba(250,204,21,0.4)]',
            'hover:shadow-[0_8px_24px_-2px_rgba(250,204,21,0.5)]',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
          )}
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              استدعاء التالي
            </>
          )}
        </button>

        {/* Waiting list */}
        {waiting.length > 0 && (
          <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-hide mt-1">
            {waiting.map((t) => (
              <TicketRow key={t.id} ticket={t} barberIndex={barberIndex} onCancel={() => onCancel(t.id)} onClick={() => onTicketClick(t)} />
            ))}
          </div>
        )}

        {waiting.length === 0 && !serving && (
          <div className="flex flex-col items-center justify-center py-6 opacity-30">
            <Users className="w-8 h-8 text-zinc-600 mb-2" />
            <p className="text-xs text-zinc-500">لا يوجد عملاء</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [shop, setShop] = useState<Shop | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isManualTicketOpen, setIsManualTicketOpen] = useState(false);
  const [processingBarber, setProcessingBarber] = useState<string | null>(null);

  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualPeople, setManualPeople] = useState(1);
  const [manualBarber, setManualBarber] = useState('');
  const [selectedTicketDetails, setSelectedTicketDetails] = useState<Ticket | null>(null);
  const [autoPrint, setAutoPrint] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // initialise audio context on first user interaction — improves autoplay policy
  const unlockAudio = () => { if (soundEnabled) playTicketSound(); };
  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    return () => window.removeEventListener('pointerdown', unlockAudio);
  }, []);

  useEffect(() => { checkAuth(); }, []);
  useEffect(() => { if (shop) { subscribeToUpdates(); loadTickets(); } }, [shop?.id]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('/'); return; }
    loadShopData(session.user.id);
  };

  const loadShopData = async (userId: string, retries = 3) => {
    try {
      const { data: shopData, error } = await supabase.from('shops').select('*').eq('owner_id', userId).single();
      if (error || !shopData) {
        if (retries > 0) {
          setTimeout(() => loadShopData(userId, retries - 1), 500);
          return;
        }
        navigate('/onboarding');
        return;
      }
      setShop(shopData as Shop);
      // Order by created_at strictly to ensure stable letters A, B
      const { data: barbersData } = await supabase.from('barbers').select('*').eq('shop_id', shopData.id).order('created_at', { ascending: true });
      setBarbers((barbersData as Barber[]) || []);
      setLoading(false);
    } catch {
      toast.error('حدث خطأ في تحميل البيانات');
      setLoading(false);
    }
  };

  const getBarberIndex = (barberId: string | undefined | null) => {
    if (!barberId) return -1;
    return barbers.findIndex(b => b.id === barberId);
  };

  const loadTickets = useCallback(async () => {
    if (!shop) return;
    const { data } = await supabase.from('tickets').select('*').eq('shop_id', shop.id).in('status', ['waiting', 'serving']).order('created_at', { ascending: true });
    setTickets((data as Ticket[]) || []);
  }, [shop]);

  const subscribeToUpdates = () => {
    if (!shop) return;
    const sub = supabase.channel(`admin_shop_${shop.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tickets', filter: `shop_id=eq.${shop.id}` },
        (payload) => {
          // Only chime for customer-created tickets (not manual ones from admin)
          const isManual = (payload.new as any)?.user_session_id?.startsWith('manual_');
          if (!isManual && soundEnabled) playTicketSound();
          loadTickets();
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `shop_id=eq.${shop.id}` },
        () => loadTickets()
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tickets', filter: `shop_id=eq.${shop.id}` },
        () => loadTickets()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'barbers', filter: `shop_id=eq.${shop.id}` },
        async () => {
          const { data: bData } = await supabase.from('barbers').select('*').eq('shop_id', shop.id).order('created_at', { ascending: true });
          if (bData) setBarbers(bData as Barber[]);
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'shops', filter: `id=eq.${shop.id}` },
        (payload) => setShop(payload.new as Shop)
      )
      .subscribe();
    return () => { sub.unsubscribe(); };
  };

  const toggleShopStatus = async () => {
    if (!shop) return;
    const { error } = await supabase.from('shops').update({ is_open: !shop.is_open }).eq('id', shop.id);
    if (error) toast.error('فشل تحديث حالة الصالون');
    else { setShop({ ...shop, is_open: !shop.is_open }); toast.success(shop.is_open ? 'تم إغلاق الصالون' : 'تم فتح الصالون'); }
  };

  const handleManualTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;
    if (!manualBarber) { toast.error('يرجى اختيار الحلاق'); return; }
    const { data: ticketNumberData, error: tErr } = await supabase.rpc('get_next_ticket_number', {
      p_shop_id: shop.id,
      p_barber_id: manualBarber
    });
    if (tErr) { toast.error('فشل في إنشاء التذكرة'); return; }
    const ticketNumber = ticketNumberData as number;
    const barberIndex = getBarberIndex(manualBarber);
    const barberName = barbers.find(b => b.id === manualBarber)?.name;
    const ticketCode = getTicketCode(barberIndex, ticketNumber);
    const { data: insertedTicket, error } = await supabase.from('tickets').insert({
      shop_id: shop.id, barber_id: manualBarber,
      customer_name: manualName.trim(), phone_number: manualPhone.trim(),
      people_count: manualPeople, ticket_number: ticketNumber,
      user_session_id: `manual_${Date.now()}`, status: 'waiting',
    }).select().single();
    if (error) { toast.error('فشل في إنشاء التذكرة'); return; }
    toast.success(`تم إنشاء التذكرة ${ticketCode}`);
    if (autoPrint) {
      printThermalTicket({
        ticketNumber,
        ticketId: insertedTicket.id,
        customerName: manualName.trim(),
        barberName,
        barberIndex,
        shopName: shop.name,
        shopSlug: shop.slug,
        peopleCount: manualPeople,
        createdAt: new Date(),
      });
    }
    setIsManualTicketOpen(false);
    setManualName('');
    setManualPhone('');
    setManualPeople(1);
    setManualBarber('');
  };

  const handleNextCustomer = async (barberId: string) => {
    if (!shop) return;
    setProcessingBarber(barberId);
    try {
      const { data, error } = await supabase.rpc('process_next_customer', { p_barber_id: barberId, p_shop_id: shop.id });
      if (error) toast.info('لا يوجد عملاء في الانتظار');
      else if (data && Array.isArray(data) && data.length > 0) {
        const r = data[0] as { customer_name: string; ticket_number: number };
        toast.success(`${r.customer_name} — #${r.ticket_number}`);
      } else toast.info('لا يوجد عملاء في الانتظار');
    } catch { toast.error('حدث خطأ'); }
    finally { setProcessingBarber(null); }
  };

  const cancelTicket = async (id: string) => {
    const { error } = await supabase.from('tickets').update({ status: 'canceled' }).eq('id', id);
    if (error) toast.error('فشل في إلغاء التذكرة'); else toast.success('تم إلغاء التذكرة');
  };

  const finishTicket = async (id: string) => {
    const { error } = await supabase.from('tickets').update({ status: 'completed' }).eq('id', id);
    if (error) toast.error('فشل في إنهاء الخدمة'); else toast.success('تم إنهاء الخدمة ✓');
  };

  const resetQueue = async () => {
    if (!shop) return;
    const { error: ticketsErr } = await supabase
      .from('tickets')
      .update({ status: 'canceled' })
      .eq('shop_id', shop.id)
      .in('status', ['waiting', 'serving']);

    const { error: shopErr } = await supabase
      .from('shops')
      .update({ last_reset_at: new Date().toISOString() })
      .eq('id', shop.id);

    if (ticketsErr || shopErr) {
      toast.error('فشل تصفير الطابور');
    } else {
      toast.success('تم تصفير الطابور بنجاح');
      loadTickets();
    }
  };



  const getBarberTickets = (barberId: string | null, status: string) => tickets.filter(t => t.barber_id === barberId && t.status === status);
  const getCurrentServing = (barberId: string) => tickets.find(t => t.barber_id === barberId && t.status === 'serving');

  /* ─── Loading ─── */
  if (loading) return (
    <div className="min-h-[100dvh] bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-yellow-400" />
        <p className="text-zinc-500 text-sm font-semibold">جاري التحميل…</p>
      </div>
    </div>
  );

  if (!shop) return null;

  const waitingCount = tickets.filter(t => t.status === 'waiting').reduce((acc, t) => acc + (t.people_count || 1), 0);
  const servingCount = tickets.filter(t => t.status === 'serving').length;

  /* ─── Render ─── */
  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a]" dir="rtl">
      {/* shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-zinc-800/80">
        <div className="w-full px-4 md:px-8 lg:px-12 py-3 flex flex-col md:flex-row justify-between gap-4">

          {/* Top Level: Brand and Mobile Toggle */}
          <div className="flex items-center justify-between w-full md:w-auto">
            {/* Brand */}
            <div className="flex items-center gap-3">
              {shop.logo_url
                ? <img src={shop.logo_url} alt={shop.name} className="w-10 h-10 object-contain rounded-xl border border-zinc-800" />
                : <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center shrink-0 shadow-[0_0_12px_2px_rgba(250,204,21,0.25)]">
                  <Scissors className="w-5 h-5 text-black" />
                </div>
              }
              <div>
                <h1 className="font-black text-white text-base leading-tight truncate max-w-[150px] sm:max-w-[200px]">{shop.name}</h1>
              </div>
            </div>

            {/* Mobile Open/Close Toggle */}
            <div className="flex items-center gap-2 md:hidden">
              <button
                onClick={toggleShopStatus}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-black transition-all duration-300',
                  shop.is_open
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-500'
                )}
              >
                <span className={cn('w-2 h-2 rounded-full transition-colors shrink-0', shop.is_open ? 'bg-green-400 animate-pulse' : 'bg-zinc-600')} />
                {shop.is_open ? 'مفتوح' : 'مغلق'}
              </button>
            </div>
          </div>

          {/* Bottom Level / Desktop Actions */}
          <div className="flex items-center justify-between md:justify-end gap-3 border-t border-zinc-800/50 pt-3 md:border-none md:pt-0 w-full md:w-auto">

            {/* Desktop Open/Close Toggle */}
            <button
              onClick={toggleShopStatus}
              className={cn(
                'hidden md:flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-black transition-all duration-300',
                shop.is_open
                  ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-500 hover:border-zinc-500'
              )}
            >
              <span className={cn('w-2 h-2 rounded-full transition-colors shrink-0', shop.is_open ? 'bg-green-400 animate-pulse' : 'bg-zinc-600')} />
              <span>{shop.is_open ? 'مفتوح' : 'مغلق'}</span>
              <Switch checked={shop.is_open} onCheckedChange={() => { }} onClick={(e) => e.stopPropagation()}
                className="data-[state=checked]:bg-green-500 scale-75 pointer-events-none" />
            </button>

            {/* Common Action Buttons */}
            <div className="flex items-center justify-center gap-2 flex-1 md:flex-none">
              {/* Sound toggle */}
              <button
                onClick={() => setSoundEnabled(v => !v)}
                title={soundEnabled ? 'كتم الصوت' : 'تفعيل الصوت'}
                className={cn(
                  'w-10 h-10 md:w-9 md:h-9 rounded-xl flex items-center justify-center border transition-all',
                  soundEnabled
                    ? 'border-yellow-400/40 text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20'
                    : 'border-zinc-800 text-zinc-600 bg-zinc-950 hover:border-zinc-600'
                )}
              >
                {soundEnabled ? <Bell className="w-5 h-5 md:w-4 md:h-4" /> : <BellOff className="w-5 h-5 md:w-4 md:h-4" />}
              </button>

              <button onClick={() => navigate('/admin/settings')}
                className="w-10 h-10 md:w-9 md:h-9 rounded-xl flex items-center justify-center border border-zinc-800 text-zinc-500 hover:text-yellow-400 hover:border-zinc-600 transition-all bg-zinc-950 hover:bg-zinc-900">
                <Settings className="w-5 h-5 md:w-4 md:h-4" />
              </button>
              <button onClick={() => navigate('/admin/archive')}
                className="w-10 h-10 md:w-9 md:h-9 rounded-xl flex items-center justify-center border border-zinc-800 text-zinc-500 hover:text-yellow-400 hover:border-zinc-600 transition-all bg-zinc-950 hover:bg-zinc-900">
                <Archive className="w-5 h-5 md:w-4 md:h-4" />
              </button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="w-10 h-10 md:w-9 md:h-9 rounded-xl flex items-center justify-center border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-500/30 transition-all bg-zinc-950 hover:bg-zinc-900"
                    title="تصفير الطابور"
                  >
                    <ListX className="w-5 h-5 md:w-4 md:h-4" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-zinc-950 border border-zinc-800 text-white rounded-[2rem] w-[90vw] max-w-[400px]" dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-black text-xl text-white text-right flex items-center gap-2">
                      <ListX className="w-6 h-6 text-red-500" /> تصفير الطابور
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400 text-right mt-2 font-semibold">
                      هل أنت متأكد أنك تريد تصفير الطابور بالكامل؟ سيتم إلغاء جميع التذاكر الحالية وتفريغ الانتظار ولن تتمكن من التراجع عن هذا الإجراء.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-row items-center gap-3 mt-4 sm:justify-start">
                    <AlertDialogCancel className="mt-0 flex-1 rounded-xl border-zinc-800 bg-black/50 text-white hover:bg-white/5 hover:text-white font-bold">إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={resetQueue} className="flex-1 rounded-xl bg-red-500 text-white hover:bg-red-600 font-bold border-none shadow-lg shadow-red-500/20">
                      نعم، صفّر الطابور
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="w-10 h-10 md:w-9 md:h-9 rounded-xl flex items-center justify-center border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-500/30 transition-all bg-zinc-950 hover:bg-zinc-900">
                    <LogOut className="w-5 h-5 md:w-4 md:h-4" />
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-zinc-950 border border-zinc-800 text-white rounded-[2rem] w-[90vw] max-w-[400px]" dir="rtl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-black text-xl text-white text-right">تسجيل الخروج</AlertDialogTitle>
                    <AlertDialogDescription className="text-zinc-400 text-right mt-2">
                      هل أنت متأكد أنك تريد تسجيل الخروج؟ ستحتاج لتسجيل الدخول مرة أخرى للوصول إلى لوحة التحكم.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-row items-center gap-3 mt-4 sm:justify-start">
                    <AlertDialogCancel className="mt-0 flex-1 rounded-xl border-zinc-800 bg-black/50 text-white hover:bg-white/5 hover:text-white">إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={async () => {
                      await supabase.auth.signOut();
                      navigate('/');
                    }} className="flex-1 rounded-xl bg-red-500 text-white hover:bg-red-600 font-bold border-none shadow-lg shadow-red-500/20">
                      تسجيل الخروج
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ─── STATS ─── */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="في الانتظار" value={waitingCount} color="yellow" sub={waitingCount > 0 ? 'بحاجة للخدمة' : 'الطابور فارغ'} />
          <StatCard label="قيد الخدمة" value={servingCount} color="green" sub={servingCount > 0 ? 'حلاقون نشطون' : 'لا أحد يُخدم'} />
          <StatCard label="الحلاقون" value={barbers.filter(b => b.is_active).length} color="zinc" sub="مسجلون ونشطون" />
        </div>

        {/* ─── Live indicator ─── */}
        <div className="flex items-center gap-2 text-xs font-semibold text-green-400/80">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>لوحة حية — تتحدث فور كل تغيير</span>
          <span className="flex h-1.5 w-1.5 relative mr-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
        </div>

        {/* ─── QUICK LINKS ─── */}
        <QuickLinks shop={shop} />

        {/* ─── ADD TICKET ─── */}
        <Sheet open={isManualTicketOpen} onOpenChange={setIsManualTicketOpen}>
          <SheetTrigger asChild>
            <button
              disabled={!shop.is_open}
              className={cn(
                'w-full rounded-2xl h-14 flex items-center justify-center gap-3 font-black text-lg transition-all duration-150',
                shop.is_open
                  ? 'text-black bg-yellow-400 hover:bg-yellow-300 active:scale-[0.98] shadow-[0_4px_24px_-4px_rgba(250,204,21,0.5)] hover:shadow-[0_8px_32px_-4px_rgba(250,204,21,0.6)]'
                  : 'text-zinc-500 bg-zinc-800 cursor-not-allowed opacity-80'
              )}>
              <Plus className="w-5 h-5" />
              {shop.is_open ? 'إضافة تذكرة يدوياً' : 'الصالون مغلق (لا يمكن الإضافة)'}
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-[2rem] h-auto max-h-[92vh] bg-zinc-950 border-zinc-800 p-6" dir="rtl">
            <SheetHeader className="pb-5">
              <SheetTitle className="text-center text-xl font-black text-white">إضافة تذكرة ✂️</SheetTitle>
            </SheetHeader>
            <form onSubmit={handleManualTicket} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm font-bold">اسم العميل</Label>
                <Input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="محمد أحمد"
                  className="rounded-xl h-12 bg-black border-zinc-700 text-white focus-visible:ring-yellow-400 placeholder:text-zinc-600" required />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm font-bold">رقم الهاتف</Label>
                <Input value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} placeholder="05xxxxxxxx"
                  className="rounded-xl h-12 bg-black border-zinc-700 text-white focus-visible:ring-yellow-400 text-left" dir="ltr" required />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm font-bold">عدد الأشخاص</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setManualPeople(n)}
                      className={cn(
                        'flex-1 h-12 rounded-xl font-black text-lg transition-all duration-150',
                        manualPeople === n
                          ? 'bg-yellow-400 text-black shadow-[0_4px_12px_-2px_rgba(250,204,21,0.5)] scale-105'
                          : 'bg-black text-zinc-500 border border-zinc-700 hover:border-yellow-400/40 hover:text-yellow-400'
                      )}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300 text-sm font-bold flex items-center gap-1">
                  الحلاق <span className="text-red-400">*</span>
                </Label>
                <Select value={manualBarber} onValueChange={setManualBarber}>
                  <SelectTrigger className="rounded-xl h-12 bg-black border-zinc-700 text-white focus:ring-yellow-400">
                    <SelectValue placeholder="اختر الحلاق..." />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700 text-white rounded-xl">
                    {barbers.filter(b => b.is_active !== false).map((b) => (
                      <SelectItem key={b.id} value={b.id} className="focus:bg-yellow-400/10 focus:text-yellow-400 cursor-pointer">{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Print toggle */}
              <button
                type="button"
                onClick={() => setAutoPrint(!autoPrint)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200',
                  autoPrint
                    ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400'
                    : 'bg-black border-zinc-800 text-zinc-500 hover:border-zinc-600'
                )}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Printer className="w-4 h-4" />
                  طباعة التذكرة تلقائياً
                </div>
                <div className={cn(
                  'w-10 h-5 rounded-full transition-all duration-300 relative',
                  autoPrint ? 'bg-yellow-400' : 'bg-zinc-700'
                )}>
                  <div className={cn(
                    'w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all duration-300',
                    autoPrint ? 'left-5' : 'left-0.5'
                  )} />
                </div>
              </button>

              <button type="submit" className={cn(
                'w-full rounded-xl h-14 font-black text-lg text-black mt-1',
                'transition-all duration-150 active:scale-[0.98]',
                autoPrint
                  ? 'bg-yellow-400 hover:bg-yellow-300 shadow-[0_4px_16px_-2px_rgba(250,204,21,0.5)]'
                  : 'bg-yellow-400 hover:bg-yellow-300',
              )}>
                <span className="flex items-center justify-center gap-2">
                  {autoPrint ? <Printer className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  {autoPrint ? 'إضافة وطباعة التذكرة' : 'إضافة التذكرة'}
                </span>
              </button>
            </form>
          </SheetContent>
        </Sheet>

        {/* ─── TABS ─── */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className={cn(
            'w-full rounded-xl h-12 bg-zinc-950 border border-zinc-800 p-1 mb-5',
            'flex gap-1 overflow-x-auto scrollbar-hide',
          )}>
            <TabsTrigger value="all" className="flex-1 min-w-fit rounded-lg font-black text-sm text-zinc-500 data-[state=active]:bg-yellow-400 data-[state=active]:text-black data-[state=active]:shadow-[0_2px_8px_rgba(250,204,21,0.4)] transition-all">
              الكل
            </TabsTrigger>
            <TabsTrigger value="tickets_overview" className="flex-1 min-w-fit rounded-lg font-black text-sm text-zinc-500 data-[state=active]:bg-yellow-400 data-[state=active]:text-black data-[state=active]:shadow-[0_2px_8px_rgba(250,204,21,0.4)] transition-all flex items-center gap-1">
              <List className="w-3.5 h-3.5" />
              التذاكر
            </TabsTrigger>
            {barbers.map((barber) => {
              // Only show tabs for active barbers, OR inactive barbers that still have active tickets
              const hasTickets = tickets.some(t => t.barber_id === barber.id && (t.status === 'serving' || t.status === 'waiting'));
              if (!barber.is_active && !hasTickets) return null;

              return (
                <TabsTrigger key={barber.id} value={barber.id}
                  className="flex-1 min-w-fit rounded-lg font-black text-sm text-zinc-500 data-[state=active]:bg-yellow-400 data-[state=active]:text-black data-[state=active]:shadow-[0_2px_8px_rgba(250,204,21,0.4)] transition-all flex items-center gap-1">
                  {!barber.is_active && <AlertCircle className="w-3 h-3 text-red-500" />}
                  {barber.name}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* ─── ALL tab ─── */}
          <TabsContent value="all" className="mt-0 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {barbers.map((barber) => {
                const hasTickets = tickets.some(t => t.barber_id === barber.id && (t.status === 'serving' || t.status === 'waiting'));
                if (!barber.is_active && !hasTickets) return null;

                return (
                  <BarberCard
                    key={barber.id}
                    barber={barber}
                    barberIndex={getBarberIndex(barber.id)}
                    serving={getCurrentServing(barber.id)}
                    waiting={getBarberTickets(barber.id, 'waiting')}
                    processingBarber={processingBarber}
                    onNext={() => handleNextCustomer(barber.id)}
                    onCancel={cancelTicket}
                    onFinish={finishTicket}
                    onTicketClick={setSelectedTicketDetails}
                  />
                );
              })}
            </div>
          </TabsContent>

          {/* ─── ALL TICKETS OVERVIEW tab ─── */}
          <TabsContent value="tickets_overview" className="mt-0 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="font-black text-white text-base flex items-center gap-2">
                  <List className="w-5 h-5 text-yellow-400" />
                  جميع التذاكر النشطة
                </h3>
                <span className="bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs font-black px-2.5 py-1 rounded-full">
                  {tickets.filter(t => t.status === 'waiting' || t.status === 'serving').length}
                </span>
              </div>
              <div className="divide-y divide-zinc-800/60">
                {tickets.filter(t => t.status === 'waiting' || t.status === 'serving').length === 0 && (
                  <div className="flex flex-col items-center justify-center py-14 opacity-30">
                    <Users className="w-12 h-12 text-zinc-600 mb-3" />
                    <p className="text-zinc-400 text-sm">لا توجد تذاكر نشطة</p>
                  </div>
                )}
                {tickets
                  .filter(t => t.status === 'waiting' || t.status === 'serving')
                  .map((t) => {
                    const barber = barbers.find(b => b.id === t.barber_id);
                    const barberIndex = getBarberIndex(barber?.id);
                    const code = getTicketCode(barberIndex, t.ticket_number);
                    return (
                      <div key={t.id} onClick={() => setSelectedTicketDetails(t)} className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-900/50 transition-colors group cursor-pointer">
                        <div className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border',
                          t.status === 'serving'
                            ? 'bg-green-500/10 text-green-400 border-green-500/30'
                            : 'bg-zinc-900 text-yellow-400 border-zinc-800',
                        )}>
                          {code}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-white text-sm leading-tight group-hover:text-yellow-400 transition-colors truncate">{t.customer_name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {barber && (
                              <span className="text-xs text-zinc-500 font-semibold flex items-center gap-1">
                                <Scissors className="w-3 h-3" />{barber.name}
                              </span>
                            )}
                            {t.people_count > 1 && (
                              <span className="text-xs text-zinc-600">· {t.people_count} أشخاص</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn(
                            'text-xs font-black px-2.5 py-1 rounded-full border',
                            t.status === 'serving'
                              ? 'bg-green-500/10 text-green-400 border-green-500/20'
                              : 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
                          )}>
                            {t.status === 'serving' ? 'يُخدم' : 'انتظار'}
                          </span>
                          <button onClick={(e) => { e.stopPropagation(); cancelTicket(t.id); }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </TabsContent>

          {/* ─── Per-barber tabs ─── */}
          {barbers.map((barber) => {
            const hasTickets = tickets.some(t => t.barber_id === barber.id && (t.status === 'serving' || t.status === 'waiting'));
            if (!barber.is_active && !hasTickets) return null;

            const serving = getCurrentServing(barber.id);
            const waiting = getBarberTickets(barber.id, 'waiting');
            return (
              <TabsContent key={barber.id} value={barber.id} className="mt-0 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden">
                  <div className="p-6 space-y-5">
                    {/* Serving */}
                    {serving && (
                      <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6 text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400/5 to-transparent translate-x-[-100%] animate-[shimmer_2.5s_infinite]" />
                        <div className="relative z-10">
                          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-black px-4 py-1.5 rounded-full mb-5">
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" /> قيد الخدمة الآن
                          </div>
                          <p className="text-7xl font-black text-white mb-2">#{serving.ticket_number}</p>
                          <p className="text-zinc-300 font-bold text-lg mb-5">{serving.customer_name}</p>
                          <Button onClick={() => finishTicket(serving.id)} variant="outline"
                            className="rounded-xl h-11 px-8 bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20 font-black">
                            <CheckCircle className="w-4 h-4 mr-2" /> إنهاء الخدمة
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Big call button */}
                    <button
                      onClick={() => handleNextCustomer(barber.id)}
                      disabled={processingBarber === barber.id}
                      className={cn(
                        'w-full rounded-2xl h-[5.5rem] flex items-center justify-center gap-3 font-black text-2xl text-black',
                        'bg-yellow-400 hover:bg-yellow-300 active:scale-[0.98]',
                        'transition-all duration-150 shadow-[0_4px_24px_-4px_rgba(250,204,21,0.5)]',
                        'hover:shadow-[0_10px_36px_-4px_rgba(250,204,21,0.6)]',
                        'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
                      )}
                    >
                      {processingBarber === barber.id
                        ? <Loader2 className="w-8 h-8 animate-spin" />
                        : <><ChevronLeft className="w-7 h-7" /> استدعاء العميل التالي</>
                      }
                    </button>

                    {/* Waiting list */}
                    <div className="flex items-center justify-between pt-2">
                      <h4 className="font-black text-white text-lg flex items-center gap-2">
                        <Users className="w-5 h-5 text-yellow-400" /> قائمة الانتظار — {barber.name}
                      </h4>
                      <span className="bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs font-black px-3 py-1 rounded-full">
                        {waiting.reduce((acc, t) => acc + (t.people_count || 1), 0)} أشخاص
                      </span>
                    </div>

                    <div className="space-y-2">
                      {waiting.map((t, i) => (
                        <div key={t.id} className={cn(
                          'flex items-center justify-between p-4 rounded-xl border border-zinc-800',
                          'bg-black hover:bg-zinc-900/80 hover:border-yellow-400/20 transition-all duration-200 group/bigrow',
                        )}>
                          <div className="flex items-center gap-4">
                            <span className="w-11 h-11 flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 font-black text-zinc-500 text-base group-hover/bigrow:border-yellow-400/30 group-hover/bigrow:text-yellow-400 transition-colors">
                              {i + 1}
                            </span>
                            <div>
                              <p className="font-black text-white text-lg leading-tight group-hover/bigrow:text-yellow-400 transition-colors">
                                <span className="text-zinc-600 text-base ml-1">#</span>{t.ticket_number}
                              </p>
                              <p className="text-sm text-zinc-500">{t.customer_name}</p>
                            </div>
                          </div>
                          <button onClick={() => cancelTicket(t.id)}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {waiting.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 opacity-30">
                          <Users className="w-14 h-14 text-zinc-600 mb-4" />
                          <p className="text-zinc-400 text-sm">لا يوجد عملاء في الانتظار</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      {/* Customer Contact Dialog */}
      <Dialog open={!!selectedTicketDetails} onOpenChange={(o) => !o && setSelectedTicketDetails(null)}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white rounded-2xl w-[90vw] max-w-sm p-6" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-right text-yellow-400">تفاصيل الزبون</DialogTitle>
            <DialogDescription className="text-zinc-400 text-sm text-right mt-1">
              رقم التذكرة: {selectedTicketDetails ? getTicketCode(getBarberIndex(selectedTicketDetails.barber_id), selectedTicketDetails.ticket_number) : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedTicketDetails && (
            <div className="space-y-4 mt-2">
              <div className="bg-black/50 p-4 rounded-xl border border-zinc-800/80 items-center justify-between">
                <p className="text-zinc-500 text-xs font-bold mb-1">الاسم الكامل</p>
                <p className="text-lg font-black text-white">{selectedTicketDetails.customer_name}</p>
                {selectedTicketDetails.people_count > 1 && (
                  <p className="mt-2 text-yellow-400 text-sm font-bold bg-yellow-400/10 px-2 py-1 rounded inline-block">
                    {selectedTicketDetails.people_count} أشخاص
                  </p>
                )}
              </div>

              {selectedTicketDetails.phone_number ? (
                <a
                  href={`tel:${selectedTicketDetails.phone_number}`}
                  className="flex items-center gap-3 w-full bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 p-4 rounded-xl transition-all duration-200 cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 pointer-events-none" />
                  </div>
                  <div>
                    <p className="text-xs font-bold opacity-80 mb-0.5 pointer-events-none">رقم الهاتف (انقر للاتصال)</p>
                    <p className="text-lg font-black tracking-wide pointer-events-none" dir="ltr">{selectedTicketDetails.phone_number}</p>
                  </div>
                </a>
              ) : (
                <div className="flex items-center gap-3 w-full bg-zinc-900 border border-zinc-800 text-zinc-500 p-4 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">لا يوجد رقم هاتف</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
