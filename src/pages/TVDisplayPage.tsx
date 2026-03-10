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

            {/* ── HEADER ─────────────────────────────────────────────────────────── */}
            <header className="relative z-10 flex items-center justify-between px-8 py-4 shrink-0 border-b border-white/5">
                <div className="flex items-center gap-4">
                    {shop?.logo_url ? (
                        <div className="relative">
                            <div className="absolute inset-0 rounded-full bg-amber-400/20 blur-xl" />
                            <img
                                src={shop.logo_url}
                                alt={shop.name}
                                className="relative w-14 h-14 rounded-full object-cover border-2 border-amber-500/50 shadow-[0_0_24px_rgba(245,158,11,0.4)]"
                            />
                        </div>
                    ) : (
                        <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-3xl">
                            ✂️
                        </div>
                    )}
                    <div>
                        <p className="text-xs text-white/70 font-medium tracking-widest uppercase drop-shadow-sm">صالون</p>
                        <h1 className="text-2xl font-black text-white leading-tight drop-shadow-md">{shop?.name ?? '…'}</h1>
                    </div>
                </div>

                <div className="flex-1 mx-8 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

                <div className="flex items-center gap-5">
                    {reconnecting ? (
                        <span className="flex items-center gap-2 text-amber-400 text-sm font-medium animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            إعادة الاتصال…
                        </span>
                    ) : (
                        <span className="flex items-center gap-2 text-emerald-400 text-sm font-bold drop-shadow-md">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
                            بث مباشر
                        </span>
                    )}
                    <div className="w-px h-5 bg-zinc-700" />
                    <LiveClock />
                </div>
            </header>

            {/* ── BARBER COLUMNS ─────────────────────────────────────────────────── */}
            <main
                className="relative z-10 flex-1 min-h-0 grid gap-0"
                style={{ gridTemplateColumns: `repeat(${Math.max(1, queues.length)}, minmax(0, 1fr))` }}
            >
                {queues.map((bq, idx) => (
                    <BarberColumn
                        key={bq.barber.id}
                        bq={bq}
                        barberIndex={idx}
                        isLast={idx === queues.length - 1}
                        totalBarbers={queues.length}
                    />
                ))}

                {queues.length === 0 && (
                    <div className="flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4 opacity-70">
                            <div className="text-5xl animate-pulse drop-shadow-lg">✂️</div>
                            <p className="text-white text-xl font-bold drop-shadow-md">جاري تحميل البيانات…</p>
                        </div>
                    </div>
                )}
            </main>

            <footer className="relative z-10 flex items-center justify-center px-8 py-3 border-t border-white/10 shrink-0 bg-black/20 backdrop-blur-sm">
                <div className="flex items-center gap-6 text-white/80 font-medium text-sm drop-shadow-md">
                    <span>نظام إدارة الطابور الذكي</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/50" />
                    <span>{queues.length} حلاق نشط</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-white/50" />
                    <span>{queues.reduce((s, bq) => s + bq.waiting.reduce((acc, t) => acc + (t.people_count || 1), 0), 0)} شخص في الانتظار</span>
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
    isLast,
    totalBarbers,
}: {
    bq: BarberQueue;
    barberIndex: number;
    isLast: boolean;
    totalBarbers: number;
}) {
    const numFontSize =
        totalBarbers >= 5
            ? 'clamp(3rem, 6vw, 6rem)'
            : totalBarbers === 4
                ? 'clamp(4rem, 8vw, 8rem)'
                : totalBarbers === 3
                    ? 'clamp(5rem, 11vw, 10rem)'
                    : 'clamp(6rem, 14vw, 14rem)';

    return (
        <div
            className={`
        flex flex-col h-full min-w-0
        ${!isLast ? 'border-l border-white/5' : ''}
      `}
        >
            {/* Barber name header */}
            <div className="flex items-center justify-between py-4 px-4 border-b border-white/20 bg-white/10 backdrop-blur-md shrink-0 shadow-sm min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] shrink-0" />
                    <span className="text-white font-black text-xl lg:text-2xl tracking-wide drop-shadow-md truncate min-w-0">{bq.barber.name}</span>
                </div>
                {/* Total waiting people badge for this barber */}
                {bq.waiting.length > 0 && (
                    <div className="flex flex-col items-end shrink-0">
                        <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold text-xs lg:text-sm px-2 py-0.5 rounded-md whitespace-nowrap">
                            {bq.waiting.reduce((acc, t) => acc + (t.people_count || 1), 0)} أشخاص انتظار
                        </span>
                    </div>
                )}
            </div>

            {/* Currently Serving */}
            <div className="flex flex-col items-center justify-center flex-[3] gap-2 px-4 relative overflow-hidden">
                {bq.serving && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-48 h-48 rounded-full bg-amber-500/5 blur-3xl" />
                    </div>
                )}

                <p className="text-white/90 text-sm font-bold tracking-widest uppercase z-10 drop-shadow-md">
                    الرقم الحالي
                </p>

                {bq.serving ? (
                    <div className="flex flex-col items-center gap-1 z-10">
                        <div
                            className={`font-black leading-none select-none text-amber-400 drop-shadow-[0_0_30px_rgba(245,158,11,0.5)] ${bq.pulsing ? 'animate-tv-pulse' : ''
                                }`}
                            style={{ fontSize: numFontSize }}
                        >
                            {getTicketCode(barberIndex, bq.serving.ticket_number)}
                        </div>
                        {bq.serving.customer_name && (
                            <div className="flex flex-col items-center mt-2">
                                <p className="text-white text-lg lg:text-xl font-bold truncate w-full px-2 text-center drop-shadow-lg min-w-0">
                                    {bq.serving.customer_name}
                                </p>
                                {bq.serving.people_count > 1 && (
                                    <span className="mt-1 bg-yellow-400/20 border border-yellow-400/30 text-yellow-400 text-xs font-bold px-2.5 py-1 rounded-md">
                                        {bq.serving.people_count} أشخاص
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 opacity-20 z-10">
                        <div
                            className="font-black leading-none text-white/40 drop-shadow-md"
                            style={{ fontSize: numFontSize }}
                        >
                            ـ
                        </div>
                        <p className="text-white/60 font-medium text-base drop-shadow-md">لا يوجد الآن</p>
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="mx-6 h-px bg-white/5 shrink-0" />

            {/* Waiting list */}
            <div className="flex flex-col flex-[2] min-h-0 px-3 py-3 gap-2 overflow-hidden">
                <p className="text-white/90 font-bold text-sm tracking-widest text-center shrink-0 mb-2 drop-shadow-md">
                    في الانتظار
                </p>

                {bq.waiting.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center min-h-0">
                        <p className="text-white/50 font-medium text-sm drop-shadow-md">لا يوجد انتظار</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1.5 overflow-y-auto min-h-0 pr-1 pb-4 scrollbar-hide">
                        {bq.waiting.map((ticket, i) => (
                            <SmallWaitingRow key={ticket.id} barberIndex={barberIndex} ticket={ticket} rank={i} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SmallWaitingRow
// ─────────────────────────────────────────────────────────────────────────────
function SmallWaitingRow({ ticket, barberIndex, rank }: { ticket: Ticket; barberIndex: number; rank: number }) {
    const fadeLevels = ['opacity-90', 'opacity-80', 'opacity-70', 'opacity-60', 'opacity-50', 'opacity-40'];
    const opacity = fadeLevels[Math.min(rank, fadeLevels.length - 1)];
    return (
        <div
            className={`
        flex items-center justify-between
        rounded-xl border border-white/30 bg-white/10 backdrop-blur-md
        px-4 py-3 ${opacity} transition-all shadow-xl
      `}
        >
            <span className="font-black text-amber-400 text-2xl lg:text-3xl leading-none drop-shadow-md shrink-0">
                {getTicketCode(barberIndex, ticket.ticket_number)}
            </span>
            {ticket.customer_name && (
                <div className="flex items-center gap-2 min-w-0">
                    {ticket.people_count > 1 && (
                        <span className="bg-yellow-400/20 border border-yellow-400/30 text-yellow-400 text-xs font-bold px-2 py-0.5 rounded-md whitespace-nowrap">
                            {ticket.people_count} أشخاص
                        </span>
                    )}
                    <span className="text-white font-bold text-sm lg:text-base truncate min-w-0 drop-shadow-md">
                        {ticket.customer_name}
                    </span>
                </div>
            )}
        </div>
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
        <span className="text-white/90 text-xl font-mono font-bold tabular-nums drop-shadow-md">
            {time}
        </span>
    );
}

function fmtTime(d: Date) {
    return d.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
}
