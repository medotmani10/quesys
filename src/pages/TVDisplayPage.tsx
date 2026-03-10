/**
 * TVDisplayPage.tsx  — v3 (PIN Authentication + per-barber columns)
 *
 * Route: /:slug/tv
 *
 * Flow:
 *  1. Check localStorage for tv_auth_shop_id
 *  2. If found → boot directly into the live TV display
 *  3. If not   → show PIN Entry screen (4-digit, TV D-Pad optimised)
 *  4. On valid PIN → save shop_id to localStorage → render TV display
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { playTicketSound } from '@/lib/notificationSound';
import { getTicketCode } from '@/lib/utils';
import type { Ticket, Shop, Barber } from '@/types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_WAITING_PER_BARBER = 50;
const RECONNECT_DELAYS_MS = [500, 2000, 8000];
const LS_KEY = 'tv_auth_shop_id';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ShopData extends Pick<Shop, 'id' | 'name'> {
    logo_url: string | null;
}

interface BarberQueue {
    barber: Barber;
    serving: Ticket | null;
    waiting: Ticket[];
    pulsing: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// PIN Entry Screen
// ─────────────────────────────────────────────────────────────────────────────
function PinEntryScreen({ onSuccess }: { onSuccess: (shopId: string, shopName: string, logoUrl: string | null) => void }) {
    const [digits, setDigits] = useState(['', '', '', '']);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState(false);
    const [successAnim, setSuccessAnim] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);

    // Auto-focus first input on mount
    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);

    const handleDigitInput = useCallback(
        async (index: number, value: string) => {
            // Accept only a single digit
            const digit = value.replace(/\D/g, '').slice(-1);
            const newDigits = [...digits];
            newDigits[index] = digit;
            setDigits(newDigits);
            setError(false);

            if (digit && index < 3) {
                // Advance focus to next box
                inputRefs.current[index + 1]?.focus();
            }

            if (digit && index === 3) {
                const pin = [...newDigits.slice(0, 3), digit].join('');
                if (pin.length === 4) {
                    await validatePin(pin);
                }
            }
        },
        [digits]
    );

    const validatePin = async (pin: string) => {
        setChecking(true);
        try {
            const { data, error: err } = await supabase
                .from('shops')
                .select('id, name, logo_url')
                .eq('tv_pin', pin)
                .single();

            if (err || !data) {
                // Wrong PIN
                setError(true);
                setDigits(['', '', '', '']);
                setTimeout(() => {
                    inputRefs.current[0]?.focus();
                    setError(false);
                }, 1200);
            } else {
                // Correct PIN → success animation then boot
                setSuccessAnim(true);
                localStorage.setItem(LS_KEY, data.id);
                setTimeout(() => {
                    onSuccess(data.id, data.name, data.logo_url);
                }, 700);
            }
        } catch {
            setError(true);
            setDigits(['', '', '', '']);
            setTimeout(() => {
                inputRefs.current[0]?.focus();
                setError(false);
            }, 1200);
        } finally {
            setChecking(false);
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            // Move focus back
            inputRefs.current[index - 1]?.focus();
            const newDigits = [...digits];
            newDigits[index - 1] = '';
            setDigits(newDigits);
        }
        if (e.key === 'ArrowLeft' && index < 3) {
            inputRefs.current[index + 1]?.focus();
        }
        if (e.key === 'ArrowRight' && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    return (
        <div
            dir="rtl"
            className={`tv-bg fixed inset-0 flex flex-col items-center justify-center gap-12 z-50 transition-all duration-500 ${successAnim ? 'scale-105 opacity-0' : 'scale-100 opacity-100'}`}
        >
            {/* Geometric overlay */}
            <div className="tv-grid-overlay pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center gap-10 w-full max-w-lg px-4">
                {/* Logo / Icon */}
                <div className="flex flex-col items-center gap-4">
                    <div className="w-24 h-24 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-5xl shadow-[0_0_60px_rgba(245,158,11,0.3)]">
                        ✂️
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-wider text-center">شاشة العرض التلفزيونية</h1>
                    <p className="text-zinc-400 text-lg text-center">أدخل رمز PIN لتشغيل الشاشة</p>
                </div>

                {/* 4 PIN Boxes */}
                <div className="flex gap-4 ltr" dir="ltr">
                    {digits.map((digit, i) => (
                        <input
                            key={i}
                            ref={(el) => { inputRefs.current[i] = el; }}
                            type="tel"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleDigitInput(i, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(i, e)}
                            disabled={checking || successAnim}
                            className={`
                                w-20 h-24 text-center text-5xl font-black rounded-2xl
                                border-2 outline-none transition-all duration-200 select-none
                                bg-zinc-900/80 text-white caret-transparent
                                focus:scale-110 focus:shadow-[0_0_30px_rgba(245,158,11,0.4)]
                                ${error
                                    ? 'border-red-500 bg-red-500/10 animate-shake shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                                    : digit
                                        ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                                        : 'border-zinc-700 focus:border-amber-400'
                                }
                                ${successAnim ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_30px_rgba(52,211,153,0.5)]' : ''}
                            `}
                        />
                    ))}
                </div>

                {/* Error Message */}
                <div className={`transition-all duration-300 ${error ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                    <p className="text-red-400 font-bold text-xl text-center">رمز غير صحيح</p>
                </div>

                {/* Loading indicator */}
                {checking && (
                    <div className="flex items-center gap-3 text-amber-400 animate-pulse">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                )}

                <p className="text-zinc-600 text-sm text-center">
                    استخدم لوحة المفاتيح أو ريموت التلفاز للإدخال
                </p>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TVDisplayPage() {
    const { slug } = useParams<{ slug: string }>();

    // auth: null = checking, false = not authed, string = shopId
    const [authShopId, setAuthShopId] = useState<string | null | false>(null);
    const [started, setStarted] = useState(false);
    const [shop, setShop] = useState<ShopData | null>(null);
    const [queues, setQueues] = useState<BarberQueue[]>([]);
    const [error] = useState<string | null>(null);
    const [reconnecting, setReconnecting] = useState(false);

    const channelRef = useRef<RealtimeChannel | null>(null);
    const reconnectAttemptRef = useRef(0);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevServingMapRef = useRef<Map<string, string>>(new Map());
    const subscribeRef = useRef<(shopId: string) => void>(() => { });

    // ── Check localStorage on mount ───────────────────────────────────────────
    useEffect(() => {
        const savedId = localStorage.getItem(LS_KEY);
        if (savedId) {
            setAuthShopId(savedId);
        } else {
            setAuthShopId(false);
        }
    }, []);

    // ── Build per-barber queue from a flat ticket list ─────────────────────────
    const buildQueues = useCallback(
        (barbers: Barber[], tickets: Ticket[], isLive: boolean) => {
            setQueues((prev) =>
                barbers.map((barber) => {
                    const barberTickets = tickets
                        .filter((t) => t.barber_id === barber.id)
                        .sort((a, b) => a.ticket_number - b.ticket_number);

                    const serving = barberTickets.find((t) => t.status === 'serving') ?? null;
                    const waiting = barberTickets
                        .filter((t) => t.status === 'waiting')
                        .slice(0, MAX_WAITING_PER_BARBER);

                    const prevId = prevServingMapRef.current.get(barber.id) ?? null;
                    let pulsing = false;
                    if (serving && serving.id !== prevId) {
                        prevServingMapRef.current.set(barber.id, serving.id);
                        if (isLive) {
                            playTicketSound();
                            pulsing = true;
                        }
                    }

                    if (pulsing) {
                        setTimeout(
                            () =>
                                setQueues((q) =>
                                    q.map((bq) =>
                                        bq.barber.id === barber.id ? { ...bq, pulsing: false } : bq
                                    )
                                ),
                            900
                        );
                    }

                    const existing = prev.find((bq) => bq.barber.id === barber.id);
                    return {
                        barber,
                        serving,
                        waiting,
                        pulsing: pulsing || (existing?.pulsing ?? false),
                    };
                })
            );
        },
        []
    );

    // ── Fetch snapshot ─────────────────────────────────────────────────────────
    const fetchQueue = useCallback(
        async (shopId: string, isLive = true) => {
            const { data: barberData, error: barberErr } = await supabase
                .from('barbers')
                .select('*')
                .eq('shop_id', shopId)
                .eq('is_active', true)
                .order('created_at', { ascending: true });

            if (barberErr || !barberData) {
                console.error('[TV] fetchQueue barbers error:', barberErr);
                return;
            }
            const activeBarbers = barberData as Barber[];

            const { data: ticketData, error: ticketErr } = await supabase
                .from('tickets')
                .select('id, shop_id, barber_id, ticket_number, customer_name, status, people_count, created_at, updated_at')
                .eq('shop_id', shopId)
                .in('status', ['serving', 'waiting'])
                .order('ticket_number', { ascending: true });

            if (ticketErr) {
                console.error('[TV] fetchQueue tickets error:', ticketErr);
                return;
            }

            buildQueues(activeBarbers, (ticketData ?? []) as Ticket[], isLive);
        },
        [buildQueues]
    );

    // ── Realtime subscription ─────────────────────────────────────────────────
    const subscribe = useCallback(
        (shopId: string) => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }

            const channel = supabase
                .channel(`tv-queue-v2-${shopId}`)
                .on('postgres_changes', {
                    event: '*', schema: 'public', table: 'tickets',
                    filter: `shop_id=eq.${shopId}`,
                }, () => fetchQueue(shopId, true))
                .on('postgres_changes', {
                    event: '*', schema: 'public', table: 'barbers',
                    filter: `shop_id=eq.${shopId}`,
                }, () => fetchQueue(shopId, false))
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        setReconnecting(false);
                        reconnectAttemptRef.current = 0;
                    }
                    if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                        const attempt = reconnectAttemptRef.current;
                        const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
                        reconnectAttemptRef.current += 1;
                        setReconnecting(true);
                        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
                        reconnectTimerRef.current = setTimeout(() => {
                            subscribeRef.current(shopId);
                            fetchQueue(shopId, true);
                        }, delay);
                    }
                });

            channelRef.current = channel;
        },
        [fetchQueue]
    );

    useEffect(() => {
        subscribeRef.current = subscribe;
    }, [subscribe]);

    // ── Boot after PIN auth (or localStorage hit) ────────────────────────────
    useEffect(() => {
        // authShopId is null while we're still checking localStorage → wait
        if (authShopId === null) return;
        // false = needs PIN entry screen → handled separately
        if (authShopId === false) return;
        // We have a shopId but still need slug-based boot (or direct id boot)
        if (!started) return;

        let cancelled = false;

        async function boot(shopId: string) {
            // If we have a slug, validate shop matches
            if (slug) {
                const { data: shopData, error: shopErr } = await supabase
                    .from('shops')
                    .select('id, name, logo_url')
                    .eq('id', shopId)
                    .single();

                if (cancelled) return;
                if (shopErr || !shopData) {
                    // Clear stale auth
                    localStorage.removeItem(LS_KEY);
                    setAuthShopId(false);
                    return;
                }
                setShop(shopData as ShopData);
            }

            await fetchQueue(shopId, false);
            if (cancelled) return;
            subscribe(shopId);
        }

        boot(authShopId);
        return () => { cancelled = true; };
    }, [authShopId, started, slug, fetchQueue, subscribe]);

    // ── Cleanup ───────────────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            if (channelRef.current) supabase.removeChannel(channelRef.current);
        };
    }, []);

    // ── Handle PIN success callback ───────────────────────────────────────────
    const handlePinSuccess = useCallback((shopId: string, shopName: string, logoUrl: string | null) => {
        setShop({ id: shopId, name: shopName, logo_url: logoUrl });
        setAuthShopId(shopId);
        setStarted(true);
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // State: Still checking localStorage
    // ─────────────────────────────────────────────────────────────────────────
    if (authShopId === null) {
        return (
            <div dir="rtl" className="tv-bg fixed inset-0 flex items-center justify-center">
                <div className="tv-grid-overlay pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State: PIN Entry Screen
    // ─────────────────────────────────────────────────────────────────────────
    if (authShopId === false) {
        return <PinEntryScreen onSuccess={handlePinSuccess} />;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State: Authenticated but not yet "started" (browser autoplay gate)
    // ─────────────────────────────────────────────────────────────────────────
    if (!started) {
        return (
            <div dir="rtl" className="tv-bg fixed inset-0 flex flex-col items-center justify-center gap-10 z-50">
                <div className="tv-grid-overlay" />

                <div className="relative z-10 flex flex-col items-center gap-8">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-24 h-24 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-5xl shadow-[0_0_60px_rgba(245,158,11,0.3)]">
                            ✂️
                        </div>
                        <h1 className="text-4xl font-black text-white tracking-wider">نظام الطابور الذكي</h1>
                        <p className="text-zinc-500 text-xl">شاشة العرض التلفزيونية</p>
                    </div>

                    <button
                        onClick={() => setStarted(true)}
                        className="group relative overflow-hidden bg-amber-500 hover:bg-amber-400 active:scale-95 text-zinc-950 font-black text-4xl px-20 py-8 rounded-3xl shadow-[0_0_80px_-10px_rgba(245,158,11,0.7)] transition-all duration-200"
                    >
                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                        بدء العرض
                    </button>

                    <p className="text-zinc-600 text-base">اضغط لتفعيل الصوت والاتصال المباشر بالطابور</p>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State: ERROR
    // ─────────────────────────────────────────────────────────────────────────
    if (error) {
        return (
            <div dir="rtl" className="tv-bg fixed inset-0 flex flex-col items-center justify-center gap-4 text-white">
                <div className="text-6xl">⚠️</div>
                <p className="text-2xl font-bold text-red-400">{error}</p>
                <p className="text-zinc-500">تحقق من رابط الشاشة وأعد المحاولة</p>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State: MAIN TV DISPLAY
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div dir="rtl" className="tv-bg fixed inset-0 text-white overflow-hidden flex flex-col">
            <div className="tv-grid-overlay pointer-events-none" />

            {/* ── NEW HEADER (Mockup Style) ─────────────────────────────────────────────────────────── */}
            <header className="relative z-10 flex flex-col md:flex-row items-center justify-between px-12 py-8 shrink-0">
                {/* Right side (RTL) -> Time & Date */}
                <div className="flex flex-col items-start min-w-[200px]">
                    <LiveClock />
                    <LiveDate />
                </div>

                {/* Left side (RTL) -> Shop Info */}
                <div className="flex items-center gap-6">
                    <div className="flex flex-col items-end">
                        <h2 className="text-3xl font-bold text-amber-500 drop-shadow-md">{shop?.name ?? '…'}</h2>
                        <p className="text-zinc-500 text-lg uppercase tracking-[0.3em]">Premium Grooming</p>
                    </div>
                    {shop?.logo_url ? (
                        <div className="relative">
                            <div className="absolute inset-0 rounded-2xl bg-amber-500/20 blur-xl" />
                            <img
                                src={shop.logo_url}
                                alt={shop.name}
                                className="relative w-16 h-16 rounded-2xl object-cover border-2 border-amber-500/50 shadow-[0_0_24px_rgba(245,158,11,0.4)]"
                            />
                        </div>
                    ) : (
                        <div className="h-16 w-16 bg-amber-500 rounded-2xl flex items-center justify-center text-zinc-950 shadow-[0_0_24px_rgba(245,158,11,0.4)]">
                            <span className="text-4xl">✂️</span>
                        </div>
                    )}
                </div>
            </header>

            {/* ── BARBER COLUMNS ─────────────────────────────────────────────────── */}
            <main
                className="relative z-10 flex-[1] min-h-0 grid gap-8 px-12 pb-8"
                style={{ gridTemplateColumns: `repeat(${Math.max(1, queues.length)}, minmax(0, 1fr))` }}
            >
                {queues.map((bq, idx) => (
                    <BarberColumn
                        key={bq.barber.id}
                        bq={bq}
                        barberIndex={idx}
                        totalBarbers={queues.length}
                    />
                ))}

                {queues.length === 0 && (
                    <div className="col-span-full flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4 opacity-70">
                            <div className="text-5xl animate-pulse drop-shadow-lg">✂️</div>
                            <p className="text-white text-xl font-bold drop-shadow-md">جاري تحميل البيانات…</p>
                        </div>
                    </div>
                )}
            </main>

            {/* ── NEW FOOTER ────────────────────────────────────────────────────── */}
            <footer className="relative z-10 flex items-center justify-between py-6 px-12 border-t border-zinc-900 bg-black/40 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-2 text-zinc-500">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-dot" />
                        <span className="text-sm font-bold uppercase tracking-widest leading-none mt-1">
                            {reconnecting ? 'Reconnecting...' : 'Network Secure'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-500">
                        <span className="text-sm font-bold uppercase tracking-widest leading-none mt-1">
                            {queues.reduce((s, bq) => s + bq.waiting.reduce((acc, t) => acc + (t.people_count || 1), 0), 0)} في الانتظار المجموع
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-4 px-6 py-2 bg-zinc-900 rounded-full border border-zinc-800">
                    <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                    <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest mt-0.5">النظام يعمل • v3.0.0</span>
                </div>
            </footer>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// BarberColumn — one column per barber
// ─────────────────────────────────────────────────────────────────────────────
function BarberColumn({
    bq,
    barberIndex,
    totalBarbers,
}: {
    bq: BarberQueue;
    barberIndex: number;
    totalBarbers: number;
}) {
    // Top Card (Now Serving)
    return (
        <div className="flex flex-col h-full min-w-0 gap-6">

            {/* Now Serving Card */}
            <div className="flex flex-col bg-zinc-900/50 border-2 border-amber-500/20 rounded-[2rem] p-8 relative overflow-hidden min-h-[40vh] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
                {/* Subtle Background Pattern */}
                <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-500 via-transparent to-transparent"></div>

                {/* Status Indicator */}
                <div className="flex items-center gap-4 mb-4 relative z-10">
                    <span className="relative flex h-4 w-4">
                        <span className={`absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75 ${bq.serving ? 'animate-ping' : ''}`}></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500"></span>
                    </span>
                    <h3 className="text-zinc-400 text-xl font-bold uppercase tracking-widest mt-1">الرقم الحالي</h3>
                </div>

                {/* Ticket Number */}
                <div className="flex-1 flex flex-col items-center justify-center relative z-10 animate-pulse-subtle my-6">
                    {bq.serving ? (
                        <>
                            <span className="text-zinc-500 text-sm md:text-lg font-bold uppercase tracking-[0.3em] mb-2 md:mb-4">رقم التذكرة</span>
                            <div
                                className={`font-black text-amber-500 text-glow-amber tracking-tighter leading-none ${bq.pulsing ? 'animate-tv-pulse' : ''}`}
                                style={{
                                    fontSize: totalBarbers >= 4 ? '7rem' : totalBarbers === 3 ? '10rem' : '12rem'
                                }}
                            >
                                {getTicketCode(barberIndex, bq.serving.ticket_number)}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-4 opacity-30">
                            <span className="text-8xl">🛋️</span>
                            <p className="text-zinc-400 font-bold text-2xl uppercase tracking-widest">فارغ</p>
                        </div>
                    )}
                </div>

                {/* Barber & Customer Info Pills */}
                <div className="mt-auto flex flex-wrap gap-4 relative z-10">
                    <div className="px-6 py-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
                        <span className="text-xl">✂️</span>
                        <span className="text-lg lg:text-xl font-bold text-slate-200 truncate max-w-[150px] lg:max-w-full">{bq.barber.name}</span>
                    </div>
                    {bq.serving?.customer_name && (
                        <div className="px-6 py-3 bg-zinc-800 rounded-2xl flex items-center gap-3 border border-zinc-700">
                            <span className="text-xl">👤</span>
                            <span className="text-lg lg:text-xl font-bold text-slate-200 truncate max-w-[150px] lg:max-w-full">{bq.serving.customer_name}</span>
                            {bq.serving.people_count > 1 && (
                                <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-sm font-bold ml-1">
                                    {bq.serving.people_count}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Up Next / Queue Sidebar (Underneath) */}
            <div className="flex flex-col flex-1 min-h-0 bg-black/20 rounded-[2rem] p-6 border border-zinc-800/50">
                <div className="flex items-center justify-between mb-6 px-2">
                    <h3 className="text-zinc-400 text-xl font-bold uppercase tracking-widest">في الانتظار التالي</h3>
                    {bq.waiting.length > 0 && (
                        <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 font-bold text-xs px-2 py-1 rounded-md">
                            {bq.waiting.reduce((acc, t) => acc + (t.people_count || 1), 0)} أشخاص
                        </span>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-4 scrollbar-hide">
                    {bq.waiting.length === 0 ? (
                        <div className="bg-zinc-900/20 border border-dashed border-zinc-800 p-6 rounded-[1.5rem] flex items-center justify-center mt-4">
                            <span className="text-zinc-600 text-lg font-medium italic">لا يوجد أحد في الانتظار...</span>
                        </div>
                    ) : (
                        bq.waiting.map((ticket, i) => (
                            <div key={ticket.id} className="bg-zinc-900/60 border border-zinc-800 p-5 md:p-6 rounded-[1.5rem] flex items-center justify-between shadow-lg backdrop-blur-sm">
                                <div className="flex flex-col">
                                    <span className="text-zinc-500 text-xs md:text-sm font-bold uppercase tracking-widest mb-1">دور #{i + 1}</span>
                                    <span className="text-3xl md:text-4xl font-black text-slate-300">
                                        {getTicketCode(barberIndex, ticket.ticket_number)}
                                    </span>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <span className="text-amber-500/90 text-lg md:text-xl font-bold truncate max-w-[120px] md:max-w-[180px]">
                                        {ticket.customer_name || 'عميل'}
                                    </span>
                                    {ticket.people_count > 1 && (
                                        <div className="text-zinc-500 text-sm font-medium mt-1">
                                            {ticket.people_count} أشخاص
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

        </div>
    );
}

function LiveDate() {
    const [date, setDate] = useState(() => fmtDate(new Date()));
    useEffect(() => {
        // Update date once a minute
        const id = setInterval(() => setDate(fmtDate(new Date())), 60000);
        return () => clearInterval(id);
    }, []);
    return (
        <p className="text-zinc-500 text-lg md:text-xl font-medium tracking-widest uppercase">
            {date}
        </p>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// LiveClock
// ─────────────────────────────────────────────────────────────────────────────
function LiveClock() {
    const [time, setTime] = useState(() => fmtTime(new Date()));
    useEffect(() => {
        const id = setInterval(() => setTime(fmtTime(new Date())), 1000);
        return () => clearInterval(id);
    }, []);
    return (
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-slate-100 drop-shadow-lg">
            {time}
        </h1>
    );
}

function fmtTime(d: Date) {
    return d.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(d: Date) {
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}
