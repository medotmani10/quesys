import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Shop, Barber, Ticket } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, LogOut, Archive, Users, Scissors,
  ChevronLeft, X, Loader2, CheckCircle, Settings
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [shop, setShop] = useState<Shop | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isManualTicketOpen, setIsManualTicketOpen] = useState(false);
  const [processingBarber, setProcessingBarber] = useState<string | null>(null);

  // Manual ticket form
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualPeople, setManualPeople] = useState(1);
  const [manualBarber, setManualBarber] = useState('any');

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (shop) {
      subscribeToUpdates();
      loadTickets();
    }
  }, [shop?.id]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/');
      return;
    }
    loadShopData(session.user.id);
  };

  const loadShopData = async (userId: string) => {
    try {
      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_id', userId)
        .single();

      if (shopError || !shopData) {
        navigate('/onboarding');
        return;
      }

      setShop(shopData as Shop);

      const { data: barbersData } = await supabase
        .from('barbers')
        .select('*')
        .eq('shop_id', shopData.id)
        .order('name');

      setBarbers((barbersData as Barber[]) || []);
      setLoading(false);
    } catch (error) {
      toast.error('حدث خطأ في تحميل البيانات');
      setLoading(false);
    }
  };

  const loadTickets = async () => {
    if (!shop) return;

    const { data } = await supabase
      .from('tickets')
      .select('*')
      .eq('shop_id', shop.id)
      .in('status', ['waiting', 'serving'])
      .order('created_at', { ascending: true });

    setTickets((data as Ticket[]) || []);
  };

  const subscribeToUpdates = () => {
    if (!shop) return;

    const subscription = supabase
      .channel(`shop_${shop.id}_tickets`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `shop_id=eq.${shop.id}`,
        },
        () => {
          loadTickets();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const toggleShopStatus = async () => {
    if (!shop) return;

    const { error } = await supabase
      .from('shops')
      .update({ is_open: !shop.is_open })
      .eq('id', shop.id);

    if (error) {
      toast.error('فشل تحديث حالة الصالون');
    } else {
      setShop({ ...shop, is_open: !shop.is_open });
      toast.success(shop.is_open ? 'تم إغلاق الصالون' : 'تم فتح الصالون');
    }
  };

  const handleManualTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop) return;

    const { data: ticketNumberData, error: ticketNumError } = await supabase
      .rpc('get_next_ticket_number', { p_shop_id: shop.id });

    if (ticketNumError) {
      toast.error('فشل في إنشاء التذكرة');
      return;
    }

    const ticketNumber = ticketNumberData as number;

    const { error } = await supabase
      .from('tickets')
      .insert({
        shop_id: shop.id,
        barber_id: manualBarber === 'any' ? null : manualBarber,
        customer_name: manualName.trim(),
        phone_number: manualPhone.trim(),
        people_count: manualPeople,
        ticket_number: ticketNumber,
        user_session_id: `manual_${Date.now()}`,
        status: 'waiting',
      });

    if (error) {
      toast.error('فشل في إنشاء التذكرة');
    } else {
      toast.success('تم إنشاء التذكرة بنجاح');
      setIsManualTicketOpen(false);
      setManualName('');
      setManualPhone('');
      setManualPeople(1);
      setManualBarber('any');
    }
  };

  const handleNextCustomer = async (barberId: string) => {
    if (!shop) return;
    setProcessingBarber(barberId);

    try {
      const { data, error } = await supabase
        .rpc('process_next_customer', {
          p_barber_id: barberId,
          p_shop_id: shop.id,
        });

      if (error) {
        if (error.message.includes('no customers')) {
          toast.info('لا يوجد عملاء في الانتظار');
        } else {
          toast.error('فشل في معالجة العميل التالي');
        }
      } else if (data && Array.isArray(data) && data.length > 0) {
        const result = data[0] as { customer_name: string; ticket_number: number };
        toast.success(`العميل التالي: ${result.customer_name} (#${result.ticket_number})`);
      } else {
        toast.info('لا يوجد عملاء في الانتظار');
      }
    } catch (error) {
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setProcessingBarber(null);
    }
  };

  const cancelTicket = async (ticketId: string) => {
    const { error } = await supabase
      .from('tickets')
      .update({ status: 'canceled' })
      .eq('id', ticketId);

    if (error) {
      toast.error('فشل في إلغاء التذكرة');
    } else {
      toast.success('تم إلغاء التذكرة');
    }
  };

  const finishTicket = async (ticketId: string) => {
    const { error } = await supabase
      .from('tickets')
      .update({ status: 'completed' })
      .eq('id', ticketId);

    if (error) {
      toast.error('فشل في إنهاء الخدمة');
    } else {
      toast.success('تم إنهاء الخدمة بنجاح');
    }
  };

  const getBarberTickets = (barberId: string | null, status: string) => {
    return tickets.filter(t =>
      t.barber_id === barberId && t.status === status
    );
  };

  const getCurrentServing = (barberId: string) => {
    return tickets.find(t => t.barber_id === barberId && t.status === 'serving');
  };

  const copyShopLink = () => {
    if (!shop) return;
    const link = `${window.location.origin}/${shop.slug}`;
    navigator.clipboard.writeText(link);
    toast.success('تم نسخ الرابط');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!shop) return null;

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-amber-500/10 relative">
        <div className="max-w-6xl mx-auto p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-4">
              {shop.logo_url ? (
                <img src={shop.logo_url} alt={shop.name} className="w-12 h-12 object-contain rounded-2xl bg-slate-950 border border-white/10" />
              ) : (
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-glow">
                  <Scissors className="w-6 h-6 text-slate-950" />
                </div>
              )}
              <div>
                <h1 className="font-bold text-lg text-white">{shop.name}</h1>
                <button
                  onClick={copyShopLink}
                  className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
                >
                  نسخ رابط الصالون
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/admin/settings')}
                className="rounded-xl hover:bg-amber-500/10 text-amber-500/70 hover:text-amber-400 transition-colors h-10 w-10"
                title="إعدادات المحل"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end overflow-x-auto pb-2 sm:pb-0 custom-scrollbar">
            <div className="flex shrink-0 items-center gap-3 bg-black/50 px-4 py-2 rounded-2xl border border-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
              <span className="text-sm font-medium text-slate-300">
                {shop.is_open ? 'الصالون مفتوح' : 'الصالون مغلق'}
              </span>
              <Switch
                checked={shop.is_open}
                onCheckedChange={toggleShopStatus}
                className="data-[state=checked]:bg-green-500 shadow-glow"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin/settings')}
              className="rounded-xl hover:bg-amber-500/10 text-amber-500/70 hover:text-amber-400 transition-colors shrink-0 hidden sm:flex"
              title="إعدادات المحل"
            >
              <Settings className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin/archive')}
              className="rounded-xl hover:bg-amber-500/10 text-amber-500/70 hover:text-amber-400 transition-colors"
            >
              <Archive className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => supabase.auth.signOut()}
              className="rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition-colors shrink-0"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <Card className="rounded-[2rem] border border-amber-500/10 bg-gradient-to-b from-slate-950 to-black backdrop-blur-xl shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 text-center relative z-10">
              <p className="text-slate-400 font-medium text-sm mb-2">في الانتظار</p>
              <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 drop-shadow-lg">
                {tickets.filter(t => t.status === 'waiting').length}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-[2rem] border border-green-500/10 bg-gradient-to-b from-slate-950 to-black backdrop-blur-xl shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 text-center relative z-10">
              <p className="text-slate-400 font-medium text-sm mb-2">قيد الخدمة</p>
              <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-green-500 drop-shadow-lg">
                {tickets.filter(t => t.status === 'serving').length}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-[2rem] border border-amber-500/10 bg-gradient-to-b from-slate-950 to-black backdrop-blur-xl shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 text-center relative z-10">
              <p className="text-slate-400 font-medium text-sm mb-2">الحلاقين النشطين</p>
              <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-200 to-slate-400 drop-shadow-lg">
                {barbers.filter(b => b.is_active).length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Add Ticket Button */}
        <Sheet open={isManualTicketOpen} onOpenChange={setIsManualTicketOpen}>
          <SheetTrigger asChild>
            <Button className="w-full rounded-2xl h-16 bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 text-xl font-black mb-8 shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(245,158,11,0.6)] border border-amber-300/50">
              <Plus className="w-6 h-6 mr-2" />
              إضافة تذكرة يدوياً
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-[3rem] h-auto max-h-[90vh] bg-slate-900 border-t border-white/10 p-6">
            <SheetHeader className="pb-6">
              <SheetTitle className="text-center text-2xl font-bold text-white">إضافة تذكرة يدوياً</SheetTitle>
            </SheetHeader>
            <form onSubmit={handleManualTicket} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-slate-300">الاسم</Label>
                <Input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="اسم العميل"
                  className="rounded-2xl h-14 bg-slate-950 border-white/5 text-white focus-visible:ring-amber-500"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">رقم الهاتف</Label>
                <Input
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                  className="rounded-2xl h-14 bg-slate-950 border-white/5 text-white focus-visible:ring-amber-500 text-left"
                  dir="ltr"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">عدد الأشخاص</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setManualPeople(num)}
                      className={`flex-1 h-14 rounded-2xl font-bold transition-all ${manualPeople === num
                        ? 'bg-amber-500 text-slate-950 shadow-glow'
                        : 'bg-slate-950 text-slate-400 border border-white/5 hover:bg-slate-800'
                        }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">الحلاق</Label>
                <Select value={manualBarber} onValueChange={setManualBarber}>
                  <SelectTrigger className="rounded-2xl h-14 bg-slate-950 border-white/5 text-white focus:ring-amber-500">
                    <SelectValue placeholder="أي حلاق" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white">
                    <SelectItem value="any" className="focus:bg-slate-800 focus:text-white">أي حلاق متاح</SelectItem>
                    {barbers.map((barber) => (
                      <SelectItem key={barber.id} value={barber.id} className="focus:bg-slate-800 focus:text-white border-t border-white/5 mt-1 pt-1">
                        {barber.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="w-full rounded-2xl h-16 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-lg mt-4 shadow-glow"
              >
                إضافة التذكرة
              </Button>
            </form>
          </SheetContent>
        </Sheet>

        {/* Barbers Queue */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full rounded-2xl h-16 bg-black/60 backdrop-blur-md p-1.5 mb-8 border border-white/5">
            <TabsTrigger
              value="all"
              className="flex-1 rounded-xl text-slate-400 font-bold data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-400 data-[state=active]:to-amber-600 data-[state=active]:text-slate-950 data-[state=active]:shadow-glow transition-all text-base"
            >
              الكل
            </TabsTrigger>
            {barbers.map((barber) => (
              <TabsTrigger
                key={barber.id}
                value={barber.id}
                className="flex-1 rounded-xl text-slate-400 font-bold data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-400 data-[state=active]:to-amber-600 data-[state=active]:text-slate-950 data-[state=active]:shadow-glow transition-all text-base"
              >
                {barber.name}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* General Queue */}
              <Card className="rounded-[2rem] border border-amber-500/10 bg-gradient-to-b from-slate-950 to-black backdrop-blur-xl shadow-2xl overflow-hidden group">
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none"></div>
                <CardContent className="p-6 relative z-10">
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-glow">
                        <Users className="w-7 h-7 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xl text-white">القائمة العامة</h3>
                        <p className="text-sm text-amber-500/80 font-medium">أي حلاق متاح</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {getBarberTickets(null, 'waiting').map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5 hover:border-amber-500/30 transition-all hover:shadow-[0_0_15px_rgba(245,158,11,0.1)] group/ticket"
                      >
                        <div>
                          <p className="font-black text-white text-xl group-hover/ticket:text-amber-400 transition-colors"><span className="text-amber-600/50 mr-2 text-lg">#</span>{ticket.ticket_number}</p>
                          <p className="text-sm text-slate-400 font-medium">{ticket.customer_name}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => cancelTicket(ticket.id)}
                          className="h-10 w-10 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      </div>
                    ))}
                    {getBarberTickets(null, 'waiting').length === 0 && (
                      <div className="text-center py-10 opacity-50">
                        <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400 text-lg font-medium">لا يوجد عملاء في الانتظار</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Each Barber */}
              {barbers.map((barber) => {
                const serving = getCurrentServing(barber.id);
                const waiting = getBarberTickets(barber.id, 'waiting');

                return (
                  <Card key={barber.id} className="rounded-[2rem] border border-amber-500/10 bg-gradient-to-b from-slate-950 to-black backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col relative w-full group">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none"></div>
                    <CardContent className="p-6 flex-1 flex flex-col relative z-10 w-full">
                      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                            <Scissors className="w-6 h-6 text-amber-500" />
                          </div>
                          <div>
                            <h3 className="font-bold text-xl text-white">{barber.name}</h3>
                            <p className="text-sm text-amber-500/80 font-medium">{waiting.length} في الانتظار</p>
                          </div>
                        </div>
                      </div>

                      {/* Currently Serving */}
                      {serving ? (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 mb-6 relative overflow-hidden group/serving shadow-[0_0_15px_rgba(34,197,94,0.1)] flex flex-col justify-between">
                          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-transparent opacity-0 group-hover/serving:opacity-100 transition-opacity" />
                          <div className="flex items-center justify-between relative z-10 mb-4">
                            <div>
                              <div className="flex items-center gap-2 text-green-400 font-bold text-sm mb-2">
                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                                <span>قيد الخدمة</span>
                              </div>
                              <p className="text-sm text-slate-300 font-medium">{serving.customer_name}</p>
                            </div>
                            <p className="text-3xl sm:text-4xl font-black text-white drop-shadow-lg"><span className="text-green-500/50 text-xl sm:text-2xl mr-1">#</span>{serving.ticket_number}</p>
                          </div>

                          <Button
                            onClick={() => finishTicket(serving.id)}
                            variant="outline"
                            size="sm"
                            className="w-full rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-400 hover:text-green-300 border-green-500/30 hover:border-green-500/50 transition-all font-bold relative z-10 h-10"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            إنهاء الخدمة
                          </Button>
                        </div>
                      ) : null}

                      {/* Next Button */}
                      <Button
                        onClick={() => handleNextCustomer(barber.id)}
                        disabled={processingBarber === barber.id}
                        className="w-full rounded-2xl h-16 mb-8 bg-black hover:bg-gradient-to-r hover:from-amber-400 hover:to-amber-600 hover:text-slate-950 text-white border border-white/5 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all font-bold text-lg group/btn"
                      >
                        {processingBarber === barber.id ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <>
                            <ChevronLeft className="w-6 h-6 mr-3 text-amber-500 group-hover/btn:text-slate-950 transition-colors" />
                            استدعاء العميل التالي
                          </>
                        )}
                      </Button>

                      {/* Waiting List */}
                      <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar mt-auto">
                        {waiting.map((ticket) => (
                          <div
                            key={ticket.id}
                            className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5 hover:border-amber-500/30 transition-all hover:shadow-[0_0_10px_rgba(245,158,11,0.05)] group/item"
                          >
                            <div>
                              <p className="font-bold text-white text-lg group-hover/item:text-amber-400 transition-colors"><span className="text-amber-600/50 text-sm mr-1">#</span>{ticket.ticket_number}</p>
                              <p className="text-sm text-slate-400 font-medium">{ticket.customer_name}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => cancelTicket(ticket.id)}
                              className="h-9 w-9 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {barbers.map((barber) => (
            <TabsContent key={barber.id} value={barber.id} className="mt-0">
              <Card className="rounded-[3rem] border border-amber-500/20 bg-gradient-to-b from-slate-950 to-black backdrop-blur-xl shadow-2xl overflow-hidden relative group">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent shadow-glow" />
                <CardContent className="p-10 relative z-10">
                  {(() => {
                    const serving = getCurrentServing(barber.id);
                    const waiting = getBarberTickets(barber.id, 'waiting');

                    return (
                      <>
                        {serving && (
                          <div className="bg-gradient-to-b from-green-500/10 to-black/50 border border-green-500/20 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 mb-10 text-center relative overflow-hidden group/mainserving flex flex-col items-center">
                            <div className="absolute inset-0 bg-gradient-to-t from-green-500/5 to-transparent opacity-0 group-hover/mainserving:opacity-100 transition-opacity" />
                            <div className="inline-flex items-center gap-2 px-6 sm:px-8 py-2 sm:py-3 bg-green-500/10 text-green-400 border border-green-500/30 rounded-full text-sm sm:text-lg font-bold mb-6 sm:mb-8 relative z-10 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                              <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse" />
                              قيد الخدمة الآن
                            </div>
                            <p className="text-6xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400 mb-6 relative z-10 drop-shadow-2xl tracking-tighter">
                              <span className="text-green-500/70 mr-2 sm:mr-4 text-5xl sm:text-7xl">#</span>{serving.ticket_number}
                            </p>
                            <p className="text-xl sm:text-2xl text-slate-300 font-bold relative z-10 mb-8">{serving.customer_name}</p>

                            <Button
                              onClick={() => finishTicket(serving.id)}
                              variant="outline"
                              className="w-full max-w-sm rounded-[1.5rem] h-14 bg-green-500/10 hover:bg-green-500/20 text-green-400 hover:text-green-300 border-green-500/30 hover:border-green-500/50 transition-all font-bold text-lg relative z-10"
                            >
                              <CheckCircle className="w-5 h-5 mr-2" />
                              إنهاء الخدمة
                            </Button>
                          </div>
                        )}

                        <Button
                          onClick={() => handleNextCustomer(barber.id)}
                          disabled={processingBarber === barber.id}
                          className="w-full rounded-[1.5rem] sm:rounded-[2rem] h-16 sm:h-24 text-xl sm:text-3xl font-black bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 mb-12 shadow-[0_0_30px_rgba(245,158,11,0.4)] transition-all hover:scale-[1.02] border border-amber-300/50 group/bigbtn"
                        >
                          {processingBarber === barber.id ? (
                            <Loader2 className="w-6 h-6 sm:w-10 sm:h-10 animate-spin" />
                          ) : (
                            <>
                              <ChevronLeft className="w-6 h-6 sm:w-10 sm:h-10 mr-2 sm:mr-4 transform group-hover/bigbtn:-translate-x-2 transition-transform" />
                              استدعاء العميل التالي
                            </>
                          )}
                        </Button>

                        <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
                          <h4 className="font-black text-2xl text-white flex items-center gap-4">
                            <Users className="w-8 h-8 text-amber-500" />
                            قائمة الانتظار
                          </h4>
                          <span className="bg-amber-500/10 text-amber-500 px-6 py-2 rounded-full font-bold text-base border border-amber-500/30 shadow-glow">
                            {waiting.length} عميل
                          </span>
                        </div>

                        <div className="space-y-4">
                          {waiting.map((ticket, index) => (
                            <div
                              key={ticket.id}
                              className="flex items-center justify-between p-6 bg-black/40 rounded-[2rem] border border-white/5 hover:border-amber-500/30 transition-all hover:shadow-[0_0_15px_rgba(245,158,11,0.1)] group/bigitem"
                            >
                              <div className="flex items-center gap-6">
                                <span className="w-14 h-14 bg-black border border-white/10 text-slate-400 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner group-hover/bigitem:border-amber-500/30 group-hover/bigitem:text-amber-500 transition-colors">
                                  {index + 1}
                                </span>
                                <div>
                                  <p className="font-black text-white text-2xl group-hover/bigitem:text-amber-400 transition-colors"><span className="text-amber-600/50 text-xl mr-2">#</span>{ticket.ticket_number}</p>
                                  <p className="text-base text-slate-400 font-medium">{ticket.customer_name}</p>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => cancelTicket(ticket.id)}
                                className="h-14 w-14 rounded-2xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <X className="w-7 h-7" />
                              </Button>
                            </div>
                          ))}
                          {waiting.length === 0 && (
                            <div className="text-center py-16 opacity-50">
                              <Users className="w-20 h-20 text-slate-600 mx-auto mb-6" />
                              <p className="text-xl text-slate-400 font-medium">لا يوجد عملاء في قائمة الانتظار للمختص الحالي</p>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
