import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Shop, Barber, Ticket } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Scissors, LogOut, CheckCircle, BellRing, User, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getTicketCode } from './CustomerBookingPage';
import BarberInstallPrompt from '@/components/BarberInstallPrompt';

export default function BarberDashboard() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();

    const [shop, setShop] = useState<Shop | null>(null);
    const [barber, setBarber] = useState<Barber | null>(null);
    const [servingTicket, setServingTicket] = useState<Ticket | null>(null);
    const [waitingTickets, setWaitingTickets] = useState<Ticket[]>([]);

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, [slug]);

    useEffect(() => {
        if (!shop || !barber) return;

        const channel = supabase.channel(`barber_dashboard_${barber.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `shop_id=eq.${shop.id}` }, () => {
                fetchTickets(shop.id, barber.id);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'barbers', filter: `id=eq.${barber.id}` }, (payload) => {
                setBarber(payload.new as Barber);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [shop?.id, barber?.id]);

    const loadData = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                navigate(`/${slug}/barber/login`);
                return;
            }

            // 1. Get Barber Profile
            const { data: barberData, error: barberError } = await supabase
                .from('barbers')
                .select('*')
                .eq('auth_id', session.user.id)
                .single();

            if (barberError || !barberData) {
                toast.error('لم يتم العثور على بيانات الحلاق');
                supabase.auth.signOut();
                navigate(`/${slug}/barber/login`);
                return;
            }
            setBarber(barberData as Barber);

            // 2. Get Shop profile
            const { data: shopData } = await supabase
                .from('shops')
                .select('*')
                .eq('id', barberData.shop_id)
                .single();

            if (!shopData || shopData.slug !== slug) {
                toast.error('أنت غير مسجل في هذا الصالون');
                supabase.auth.signOut();
                navigate(`/${slug}/barber/login`);
                return;
            }
            setShop(shopData as Shop);

            // Successfully authenticated as a barber for this shop, save slug for Standalone PWA entry
            if (slug) {
                localStorage.setItem('barber_shop_slug', slug);
            }

            // 3. Fetch Tickets
            await fetchTickets(shopData.id, barberData.id);

        } catch (error) {
            console.error('Error loading barber dashboard:', error);
            toast.error('حدث خطأ أثناء تحميل البيانات');
        } finally {
            setLoading(false);
        }
    };

    const fetchTickets = async (shopId: string, barberId: string) => {
        // Fetch serving ticket for THIS barber
        const { data: servingData } = await supabase
            .from('tickets')
            .select('*')
            .eq('shop_id', shopId)
            .eq('barber_id', barberId)
            .eq('status', 'serving')
            .order('updated_at', { ascending: false })
            .limit(1);

        setServingTicket(servingData && servingData.length > 0 ? servingData[0] as Ticket : null);

        // Fetch waiting tickets exclusively for THIS barber
        const { data: waitingData } = await supabase
            .from('tickets')
            .select('*')
            .eq('shop_id', shopId)
            .eq('barber_id', barberId)
            .eq('status', 'waiting')
            .order('ticket_number', { ascending: true });

        setWaitingTickets((waitingData as Ticket[]) || []);
    };

    const handleToggleStatus = async () => {
        if (!barber) return;
        const newStatus = !barber.is_active;
        setBarber({ ...barber, is_active: newStatus });

        const { error } = await supabase
            .from('barbers')
            .update({ is_active: newStatus })
            .eq('id', barber.id);

        if (error) {
            toast.error('فشل تحديث الحالة');
            setBarber({ ...barber, is_active: !newStatus }); // revert
        } else {
            toast.success(newStatus ? 'أنت الآن متاح العمل' : 'أنت الآن في استراحة');
        }
    };

    const handleCompleteService = async () => {
        if (!servingTicket || !shop || !barber) return;
        setActionLoading(true);
        try {
            const { error } = await supabase
                .from('tickets')
                .update({ status: 'completed' })
                .eq('id', servingTicket.id);

            if (error) throw error;
            toast.success('تم إنهاء الخدمة بنجاح');
            setServingTicket(null);
            await fetchTickets(shop.id, barber.id);
        } catch (error) {
            toast.error('حدث خطأ أثناء إنهاء الخدمة');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCallNext = async () => {
        if (!shop || !barber) return;
        setActionLoading(true);
        try {
            // Use the new RPC to pull the next assigned or unassigned customer
            const { data, error } = await supabase.rpc('process_barber_next_customer', {
                p_barber_id: barber.id,
                p_shop_id: shop.id
            });

            if (error) throw error;

            if (data && data.length > 0) {
                toast.success(`تم استدعاء: ${data[0].customer_name}`);
            } else {
                toast.error('لا يوجد زبائن في قائمة الانتظار الحالية');
            }
            // Realtime listener will automatically update the UI shortly, but we fetch manually just in case
            await fetchTickets(shop.id, barber.id);
        } catch (error) {
            toast.error('حدث خطأ أثناء استدعاء الزبون التالي');
            console.error(error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate(`/${slug}/barber/login`);
    };

    if (loading) {
        return (
            <div className="min-h-[100dvh] bg-black flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-yellow-400 animate-spin mb-4" />
                <p className="text-yellow-400 font-bold">جاري تحميل واجهة الحلاق...</p>
            </div>
        );
    }

    if (!shop || !barber) return null;

    return (
        <div className="min-h-[100dvh] bg-black text-white flex flex-col pt-4 pb-24 px-4 sm:p-6" dir="rtl">
            <BarberInstallPrompt />

            {/* ─── HEADER ─── */}
            <header className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-yellow-400 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(250,204,21,0.3)]">
                        <Scissors className="w-6 h-6 text-black" />
                    </div>
                    <div>
                        <h1 className="font-black text-xl leading-tight">{barber.name}</h1>
                        <p className="text-zinc-500 text-xs font-bold">{shop.name}</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl h-12 w-12">
                    <LogOut className="w-6 h-6" />
                </Button>
            </header>

            <div className="flex-1 max-w-lg mx-auto w-full space-y-6">

                {/* ─── STATUS TOGGLE ─── */}
                <div className={`p-5 rounded-3xl border-2 flex items-center justify-between transition-all duration-300 ${barber.is_active ? 'bg-green-500/10 border-green-500/30 shadow-[0_4px_30px_rgba(34,197,94,0.15)]' : 'bg-zinc-900 border-zinc-800'}`}>
                    <div>
                        <p className={`font-black text-xl mb-1 ${barber.is_active ? 'text-green-400' : 'text-zinc-400'}`}>
                            {barber.is_active ? 'متاح للعمل' : 'في استراحة'}
                        </p>
                        <p className="text-zinc-500 text-sm font-medium">عدل حالتك لتظهر للزبائن</p>
                    </div>
                    <Switch
                        checked={barber.is_active}
                        onCheckedChange={handleToggleStatus}
                        className="scale-125 data-[state=checked]:bg-green-500"
                    />
                </div>

                {/* ─── CURRENT CUSTOMER ─── */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden relative">
                    <div className="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
                        <h2 className="font-black text-lg text-white flex items-center gap-2">
                            <User className="w-5 h-5 text-yellow-400" />
                            الزبون الحالي (الكرسي)
                        </h2>
                    </div>

                    <div className="p-8 text-center min-h-[220px] flex flex-col justify-center items-center relative">
                        {servingTicket ? (
                            <div className="space-y-4 animate-in zoom-in-95 duration-300">
                                <span className="inline-block px-4 py-1.5 rounded-full bg-yellow-400/20 text-yellow-400 font-bold text-sm mb-2 border border-yellow-400/30">
                                    {getTicketCode(barber.name, servingTicket.ticket_number)}
                                </span>
                                <h3 className="text-4xl sm:text-5xl font-black text-white leading-tight">
                                    {servingTicket.customer_name}
                                </h3>
                                <p className="text-zinc-400 font-bold text-lg flex items-center justify-center gap-2 mt-2">
                                    عدد الأشخاص: <span className="text-white text-2xl">{servingTicket.people_count}</span>
                                </p>
                            </div>
                        ) : (
                            <div className="text-zinc-600 opacity-60">
                                <Scissors className="w-16 h-16 mx-auto mb-4" />
                                <p className="text-xl font-bold">الكرسي فارغ حالياً</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ─── PRIMARY ACTIONS (HUGE BUTTONS) ─── */}
                <div className="grid grid-cols-2 gap-4 mt-2">
                    <Button
                        onClick={handleCompleteService}
                        disabled={!servingTicket || actionLoading}
                        className="h-24 sm:h-28 rounded-[2rem] bg-green-500 hover:bg-green-400 text-black shadow-[0_8px_30px_rgba(34,197,94,0.3)] transition-all active:scale-95 disabled:opacity-30 disabled:shadow-none disabled:active:scale-100 flex flex-col gap-2 border-none"
                    >
                        <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10" />
                        <span className="font-black text-lg sm:text-xl">إنهاء الخدمة</span>
                    </Button>

                    <Button
                        onClick={handleCallNext}
                        disabled={!!servingTicket || actionLoading || !barber.is_active}
                        className="h-24 sm:h-28 rounded-[2rem] bg-yellow-400 hover:bg-yellow-300 text-black shadow-[0_8px_30px_rgba(250,204,21,0.3)] transition-all active:scale-95 disabled:opacity-30 disabled:shadow-none disabled:active:scale-100 flex flex-col gap-2 border-none"
                    >
                        {actionLoading ? (
                            <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin" />
                        ) : (
                            <>
                                <BellRing className="w-8 h-8 sm:w-10 sm:h-10" />
                                <span className="font-black text-lg sm:text-xl">استدعاء الموالي</span>
                            </>
                        )}
                    </Button>
                </div>

                {/* ─── MY QUEUE LIST ─── */}
                <div className="pt-8">
                    <h3 className="font-black text-lg text-white mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-zinc-500" />
                        طابور الحجز الخاص بي ({waitingTickets.length})
                    </h3>

                    <div className="space-y-3">
                        {waitingTickets.map((ticket, idx) => (
                            <div key={ticket.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-yellow-400/10 text-yellow-400 font-bold flex items-center justify-center text-sm border border-yellow-400/20">
                                        {idx + 1}
                                    </div>
                                    <div>
                                        <p className="font-bold text-white text-lg">{ticket.customer_name}</p>
                                        <p className="text-zinc-500 text-xs font-semibold">{getTicketCode(barber.name, ticket.ticket_number)} • {ticket.people_count} أشخاص</p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {waitingTickets.length === 0 && (
                            <div className="text-center py-8 bg-zinc-900/50 rounded-2xl border border-zinc-800 border-dashed">
                                <p className="text-zinc-500 font-medium text-sm">لا يوجد زبائن ينتظرونك خصيصاً في الطابور</p>
                                <p className="text-zinc-600 text-xs mt-1">الضغط على "استدعاء الموالي" سيسحب من الطابور العام</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
