import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Ticket, Barber, Shop } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Scissors, AlertCircle, Loader2, X, User, Users } from 'lucide-react';
import { toast } from 'sonner';
import { getTicketCode } from '@/pages/CustomerBookingPage';

export default function TicketStatusPage() {
    const { ticketId } = useParams<{ ticketId: string }>();
    const navigate = useNavigate();

    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [shop, setShop] = useState<Shop | null>(null);
    const [barber, setBarber] = useState<Barber | null>(null);
    const [peopleAhead, setPeopleAhead] = useState(0);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (ticketId) loadTicket();
    }, [ticketId]);

    useEffect(() => {
        if (ticket && (ticket.status === 'waiting' || ticket.status === 'serving')) {
            subscribeToUpdates();
        }
    }, [ticket?.id, ticket?.status]);

    const loadTicket = async () => {
        if (!ticketId) return;
        try {
            const { data: ticketData, error } = await supabase
                .from('tickets')
                .select('*')
                .eq('id', ticketId)
                .single();

            if (error || !ticketData) { setNotFound(true); setLoading(false); return; }

            const t = ticketData as Ticket;
            setTicket(t);

            // Load shop
            const { data: shopData } = await supabase.from('shops').select('*').eq('id', t.shop_id).single();
            if (shopData) setShop(shopData as Shop);

            // Load all barbers for this shop and find the specific barber
            const { data: barbersData } = await supabase.from('barbers').select('*').eq('shop_id', t.shop_id);
            const bList = (barbersData as Barber[]) || [];

            // Find this ticket's barber
            if (t.barber_id) {
                const b = bList.find(b => b.id === t.barber_id) || null;
                setBarber(b);
            }

            // Calculate people ahead
            if (t.status === 'waiting') {
                calculatePeopleAhead(t);
            }
        } catch {
            setNotFound(true);
        } finally {
            setLoading(false);
        }
    };

    const calculatePeopleAhead = async (t: Ticket) => {
        let query = supabase
            .from('tickets')
            .select('id', { count: 'exact' })
            .eq('shop_id', t.shop_id)
            .eq('status', 'waiting')
            .lt('created_at', t.created_at);

        if (t.barber_id) query = query.eq('barber_id', t.barber_id);
        const { count } = await query;
        setPeopleAhead(count || 0);
    };

    const subscribeToUpdates = () => {
        if (!ticket) return;
        const sub = supabase
            .channel(`ticket_status_${ticket.id}`)
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'tickets',
                filter: `id=eq.${ticket.id}`,
            }, (payload) => {
                const updated = payload.new as Ticket;
                setTicket(updated);
                if (updated.status === 'serving') {
                    toast.success('🎉 دورك الآن! تفضل للحلاق');
                } else if (updated.status === 'completed') {
                    toast.info('✅ تمت الخدمة، شكراً لزيارتك!');
                } else if (updated.status === 'canceled') {
                    toast.error('❌ تم إلغاء تذكرتك');
                } else if (updated.status === 'waiting') {
                    calculatePeopleAhead(updated);
                }
            })
            .subscribe();
        return () => sub.unsubscribe();
    };

    const handleCancel = async () => {
        if (!ticket) return;
        try {
            const { error } = await supabase
                .from('tickets')
                .update({ status: 'canceled', updated_at: new Date().toISOString() })
                .eq('id', ticket.id);
            if (error) throw error;
            toast.success('تم إلغاء التذكرة');
        } catch {
            toast.error('فشل إلغاء التذكرة');
        }
    };

    const handleNewTicket = () => {
        if (shop) navigate(`/${shop.slug}`);
    };

    // ─── LOADING ───
    if (loading) return (
        <div className="min-h-[100dvh] bg-black flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-yellow-400" />
        </div>
    );

    // ─── NOT FOUND ───
    if (notFound || !ticket || !shop) return (
        <div className="min-h-[100dvh] bg-black flex items-center justify-center p-4">
            <div className="text-center max-w-sm w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-10">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-2xl font-black text-white mb-3">التذكرة غير موجودة</h2>
                <p className="text-zinc-400 mb-8 text-sm">الرابط غير صحيح أو انتهت صلاحية التذكرة</p>
                <Button onClick={() => navigate('/')} className="w-full h-12 bg-yellow-400 hover:bg-yellow-300 text-black font-black rounded-xl">
                    الصفحة الرئيسية
                </Button>
            </div>
        </div>
    );

    const ticketCode = getTicketCode(barber?.name, ticket.ticket_number);
    const isActive = ticket.status === 'waiting' || ticket.status === 'serving';
    const isDone = ticket.status === 'completed' || ticket.status === 'canceled';

    return (
        <div className="min-h-[100dvh] bg-black p-4" dir="rtl">
            <div className="w-full max-w-xl mx-auto pt-6 pb-10">

                {/* Shop mini-header */}
                <div className="flex items-center gap-3 mb-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                    {shop.logo_url
                        ? <img src={shop.logo_url} alt={shop.name} className="w-12 h-12 object-contain rounded-xl border border-zinc-700" />
                        : <div className="w-12 h-12 bg-yellow-400 rounded-xl flex items-center justify-center shrink-0"><Scissors className="w-6 h-6 text-black" /></div>
                    }
                    <div>
                        <h2 className="font-black text-white text-lg leading-tight">{shop.name}</h2>
                        <p className="text-xs text-zinc-500">تتبع تذكرتك في الوقت الفعلي</p>
                    </div>
                </div>

                {/* ─── COMPLETED / CANCELED ─── */}
                {isDone && (
                    <div className="rounded-2xl border-2 border-zinc-700 overflow-hidden mb-6">
                        <div className="h-2 w-full bg-zinc-700" />
                        <div className="bg-zinc-900 p-8 text-center">
                            <div className="text-7xl font-black text-zinc-500 mb-4 tracking-tighter">{ticketCode}</div>
                            <div className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-black mb-6 ${ticket.status === 'completed'
                                ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                                : 'bg-red-500/10 text-red-400 border border-red-500/30'
                                }`}>
                                {ticket.status === 'completed' ? '✅ انتهت الخدمة' : '❌ تم الإلغاء'}
                            </div>
                            {barber && (
                                <p className="text-zinc-500 text-sm mb-6">الحلاق: <span className="text-white font-bold">{barber.name}</span></p>
                            )}
                            <p className="text-zinc-500 text-sm mb-8">
                                {ticket.status === 'completed' ? 'شكراً لزيارتك! 🙏' : 'يمكنك حجز تذكرة جديدة في أي وقت.'}
                            </p>
                            <Button onClick={handleNewTicket}
                                className="w-full h-12 bg-yellow-400 hover:bg-yellow-300 text-black font-black rounded-xl">
                                حجز تذكرة جديدة ✂️
                            </Button>
                        </div>
                    </div>
                )}

                {/* ─── ACTIVE TICKET ─── */}
                {isActive && (
                    <>
                        <div className={`rounded-2xl border-2 overflow-hidden mb-6 ${ticket.status === 'serving' ? 'border-green-500' : 'border-yellow-400'}`}>
                            <div className={`h-2 w-full ${ticket.status === 'serving' ? 'bg-green-500' : 'bg-yellow-400'}`} />
                            <div className="bg-zinc-900 p-8 text-center">

                                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">رقم تذكرتك</p>
                                <div className={`text-7xl font-black mb-3 tracking-tighter ${ticket.status === 'serving' ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {ticketCode}
                                </div>

                                {barber && (
                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-zinc-800 rounded-full mb-5">
                                        <Scissors className="w-3.5 h-3.5 text-yellow-400" />
                                        <span className="text-zinc-300 text-sm font-bold">{barber.name}</span>
                                    </div>
                                )}

                                <div className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-black mb-6 ${ticket.status === 'serving'
                                    ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                                    : 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/30'
                                    }`}>
                                    <div className={`w-2 h-2 rounded-full animate-pulse ${ticket.status === 'serving' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                                    {ticket.status === 'serving' ? '🎉 دورك الآن! تفضل للحلاق' : 'في قائمة الانتظار'}
                                </div>

                                {ticket.status === 'waiting' && (
                                    <div className="bg-black border border-zinc-800 rounded-xl p-6 mb-6">
                                        <p className="text-zinc-500 text-xs font-bold mb-2">أشخاص قبلك عند هذا الحلاق</p>
                                        <p className="text-6xl font-black text-white">{peopleAhead}</p>
                                    </div>
                                )}

                                <div className="space-y-3 text-sm text-right bg-black/50 border border-zinc-800 rounded-xl p-5 mb-6">
                                    {[
                                        { icon: <User className="w-4 h-4 text-yellow-400" />, label: 'الاسم', value: ticket.customer_name },
                                        { icon: <Scissors className="w-4 h-4 text-yellow-400" />, label: 'الحلاق', value: barber?.name || 'غير محدد' },
                                        { icon: <Users className="w-4 h-4 text-yellow-400" />, label: 'العدد', value: `${ticket.people_count} ${ticket.people_count === 1 ? 'شخص' : 'أشخاص'}` },
                                    ].map((row, i) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 font-black text-white">{row.icon}{row.value}</div>
                                            <span className="text-zinc-600 text-xs">{row.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Live indicator */}
                        <div className="flex items-center justify-center gap-2 text-xs font-bold text-green-400 bg-green-500/5 border border-green-500/20 rounded-xl py-3 mb-4">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            النظام متصل ويتحدث تلقائياً
                        </div>

                        {/* Cancel */}
                        {ticket.status === 'waiting' && (
                            <Button onClick={handleCancel} variant="outline"
                                className="w-full rounded-xl h-12 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold">
                                <X className="w-4 h-4 mr-2" /> إلغاء الحجز
                            </Button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
