import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Shop, Ticket, Barber } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Calendar, Search, CheckCircle, XCircle,
  Clock, Scissors, User, ArrowRight, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

export default function ArchivePage() {
  const navigate = useNavigate();
  const [shop, setShop] = useState<Shop | null>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (shop) {
      loadTickets();
    }
  }, [shop?.id, selectedDate]);

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
        .eq('shop_id', shopData.id);

      setBarbers((barbersData as Barber[]) || []);
      setLoading(false);
    } catch (error) {
      toast.error('حدث خطأ في تحميل البيانات');
      setLoading(false);
    }
  };

  const loadTickets = async () => {
    if (!shop) return;

    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from('tickets')
      .select('*')
      .eq('shop_id', shop.id)
      .in('status', ['completed', 'canceled'])
      .gte('created_at', startOfDay.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .order('created_at', { ascending: false });

    setTickets((data as Ticket[]) || []);
  };

  const getBarberName = (barberId: string | null) => {
    if (!barberId) return 'أي حلاق متاح';
    const barber = barbers.find(b => b.id === barberId);
    return barber?.name || 'غير معروف';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-green-500/10 text-green-400 border border-green-500/30 rounded-full text-sm font-bold shadow-[0_0_15px_rgba(34,197,94,0.1)]">
            <CheckCircle className="w-4 h-4" />
            مكتمل
          </span>
        );
      case 'canceled':
        return (
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-red-500/10 text-red-500 border border-red-500/30 rounded-full text-sm font-bold shadow-[0_0_15px_rgba(239,68,68,0.1)]">
            <XCircle className="w-4 h-4" />
            ملغي
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }) + ' - ' + date.toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const filteredTickets = tickets.filter(ticket =>
    ticket.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.ticket_number.toString().includes(searchQuery) ||
    ticket.phone_number.includes(searchQuery)
  );

  const stats = {
    completed: tickets.filter(t => t.status === 'completed').length,
    canceled: tickets.filter(t => t.status === 'canceled').length,
    total: tickets.length,
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
        <div className="max-w-4xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin')}
              className="rounded-xl hover:bg-amber-500/10 text-amber-500/70 hover:text-amber-400 transition-colors h-10 w-10"
            >
              <ArrowRight className="w-6 h-6" />
            </Button>
            <div>
              <h1 className="font-bold text-lg text-white">الأرشيف</h1>
              <p className="text-xs text-amber-500/80">سجل التذاكر المكتملة والملغية</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 relative z-10">
        {/* Date Filter */}
        <Card className="rounded-[2.5rem] border border-amber-500/10 bg-gradient-to-b from-slate-950 to-black backdrop-blur-xl shadow-2xl mb-8">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shadow-glow shrink-0">
                <Calendar className="w-6 h-6 text-amber-500" />
              </div>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 rounded-2xl h-14 bg-black/50 border-white/5 text-white focus-visible:ring-amber-500 transition-all hover:border-amber-500/30"
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <Card className="rounded-[2rem] border border-green-500/10 bg-gradient-to-b from-slate-950 to-black backdrop-blur-xl shadow-2xl overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 text-center relative z-10">
              <p className="text-slate-400 font-medium text-sm mb-2">المكتملة</p>
              <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-green-500 drop-shadow-lg">{stats.completed}</p>
            </CardContent>
          </Card>
          <Card className="rounded-[2rem] border border-red-500/10 bg-gradient-to-b from-slate-950 to-black backdrop-blur-xl shadow-2xl overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 text-center relative z-10">
              <p className="text-slate-400 font-medium text-sm mb-2">الملغية</p>
              <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600 drop-shadow-lg">{stats.canceled}</p>
            </CardContent>
          </Card>
          <Card className="rounded-[2rem] border border-amber-500/10 bg-gradient-to-b from-slate-950 to-black backdrop-blur-xl shadow-2xl overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 text-center relative z-10">
              <p className="text-slate-400 font-medium text-sm mb-2">الإجمالي</p>
              <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 drop-shadow-lg">{stats.total}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative mb-8 group">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-500 group-hover:text-amber-500 transition-colors z-10" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث بالاسم، رقم التذكرة، أو رقم الهاتف..."
            className="relative rounded-2xl h-16 pr-14 bg-black/50 border-white/5 text-white placeholder:text-slate-500 focus-visible:ring-amber-500 focus-visible:border-amber-500/50 transition-all hover:border-amber-500/30 text-lg shadow-2xl"
          />
        </div>

        {/* Tickets List */}
        <div className="space-y-4">
          {filteredTickets.length === 0 ? (
            <Card className="rounded-[2rem] border border-white/5 bg-slate-900/50 backdrop-blur-xl">
              <CardContent className="p-12 text-center opacity-60">
                <Clock className="w-20 h-20 text-slate-600 mx-auto mb-6" />
                <h3 className="text-xl font-bold text-white mb-2">لا توجد سجلات</h3>
                <p className="text-slate-400">لا توجد تذاكر مسجلة لتاريخ اليوم المحدد</p>
              </CardContent>
            </Card>
          ) : (
            filteredTickets.map((ticket) => (
              <Card
                key={ticket.id}
                className="rounded-[2rem] border border-white/5 bg-black/40 backdrop-blur-sm hover:border-amber-500/30 transition-all hover:shadow-[0_0_20px_rgba(245,158,11,0.05)] group"
              >
                <CardContent className="p-5 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0">
                    <div className="flex items-center gap-5">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 border shadow-inner ${ticket.status === 'completed'
                          ? 'bg-gradient-to-br from-green-500/20 to-black border-green-500/30 text-green-400 group-hover:shadow-[0_0_15px_rgba(34,197,94,0.2)]'
                          : 'bg-gradient-to-br from-red-500/20 to-black border-red-500/30 text-red-500 group-hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                        }`}>
                        <span className="text-2xl font-black">#{ticket.ticket_number}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-xl text-white group-hover:text-amber-400 transition-colors">{ticket.customer_name}</h4>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-400">
                          <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md">
                            <Scissors className="w-4 h-4 text-amber-500/70" />
                            {getBarberName(ticket.barber_id)}
                          </span>
                          <span className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md">
                            <User className="w-4 h-4 text-amber-500/70" />
                            {ticket.people_count} {ticket.people_count === 1 ? 'شخص' : 'أشخاص'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-3 font-medium">
                          {formatDate(ticket.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      {getStatusBadge(ticket.status)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
