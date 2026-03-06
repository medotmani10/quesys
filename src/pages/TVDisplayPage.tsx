/**
 * TVDisplayPage.tsx
 *
 * Dedicated, passive, read-only Smart TV display for the barbershop queue.
 * Route: /:slug/tv
 *
 * - Dark mode, RTL, Arabic text, landscape-optimised 16:9 layout
 * - Shows currently-serving ticket (large, right panel) and next 3-4 waiting (left panel)
 * - Full-screen start overlay to satisfy browser autoplay policy before audio/realtime
 * - Supabase Realtime subscription with exponential-backoff auto-reconnect
 * - Plays audio ding + CSS pulse on every new serving ticket
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { playTicketSound } from '@/lib/notificationSound';
import type { Ticket, Shop } from '@/types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const MAX_WAITING_DISPLAY = 4;
const RECONNECT_DELAYS_MS = [500, 2000, 8000]; // exponential back-off steps

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function TVDisplayPage() {
    const { slug } = useParams<{ slug: string }>();

    // Gate: user must click "بدء العرض" first (autoplay policy)
    const [started, setStarted] = useState(false);

    // Data
    const [shop, setShop] = useState<Pick<Shop, 'id' | 'name'> | null>(null);
    const [servingTicket, setServingTicket] = useState<Ticket | null>(null);
    const [waitingTickets, setWaitingTickets] = useState<Ticket[]>([]);

    // UI states
    const [pulsing, setPulsing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reconnecting, setReconnecting] = useState(false);

    // Internal refs (do not cause re-renders)
    const channelRef = useRef<RealtimeChannel | null>(null);
    const reconnectAttemptRef = useRef(0);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevServingIdRef = useRef<string | null>(null);

    // ── Fetch current queue snapshot ──────────────────────────────────────────
    const fetchQueue = useCallback(async (shopId: string) => {
        const { data, error: fetchErr } = await supabase
            .from('tickets')
            .select('*')
            .eq('shop_id', shopId)
            .in('status', ['serving', 'waiting'])
            .order('ticket_number', { ascending: true });

        if (fetchErr) {
            console.error('[TV] fetchQueue error:', fetchErr);
            return;
        }

        const tickets = (data ?? []) as Ticket[];
        const serving = tickets.find((t) => t.status === 'serving') ?? null;
        const waiting = tickets
            .filter((t) => t.status === 'waiting')
            .slice(0, MAX_WAITING_DISPLAY);

        // Trigger ding + pulse only when the serving ticket actually changes
        if (serving && serving.id !== prevServingIdRef.current) {
            prevServingIdRef.current = serving.id;
            // Only play sound if the display is already started (avoid playing on first load)
            if (started) {
                playTicketSound();
                setPulsing(true);
                setTimeout(() => setPulsing(false), 900); // match animation duration
            }
        }

        setServingTicket(serving);
        setWaitingTickets(waiting);
    }, [started]);

    // ── Subscribe to Realtime ─────────────────────────────────────────────────
    const subscribe = useCallback((shopId: string) => {
        // Clean up any existing channel first
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        const channel = supabase
            .channel(`tv-queue-${shopId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tickets',
                    filter: `shop_id=eq.${shopId}`,
                },
                () => {
                    // Re-fetch the full snapshot on any change to keep state consistent
                    fetchQueue(shopId);
                }
            )
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
                        console.warn(`[TV] Reconnecting (attempt ${attempt + 1})…`);
                        subscribe(shopId);
                        fetchQueue(shopId);
                    }, delay);
                }
            });

        channelRef.current = channel;
    }, [fetchQueue]);

    // ── Boot: resolve slug → shopId ───────────────────────────────────────────
    useEffect(() => {
        if (!started || !slug) return;

        let cancelled = false;

        async function boot() {
            const { data, error: shopErr } = await supabase
                .from('shops')
                .select('id, name')
                .eq('slug', slug)
                .single();

            if (cancelled) return;

            if (shopErr || !data) {
                setError(`لم يتم العثور على الصالون: "${slug}"`);
                return;
            }

            setShop(data as Pick<Shop, 'id' | 'name'>);
            await fetchQueue(data.id);
            subscribe(data.id);
        }

        boot();

        return () => {
            cancelled = true;
        };
    }, [started, slug, fetchQueue, subscribe]);

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            if (channelRef.current) supabase.removeChannel(channelRef.current);
        };
    }, []);

    // ── Handle start overlay click ────────────────────────────────────────────
    function handleStart() {
        setStarted(true);
    }

    // ─────────────────────────────────────────────
    // Render: Start Overlay
    // ─────────────────────────────────────────────
    if (!started) {
        return (
            <div
                dir="rtl"
                className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-8 z-50"
            >
                {/* Logo / title */}
                <div className="text-center space-y-3">
                    <div className="text-6xl">✂️</div>
                    <h1 className="text-3xl font-black text-white tracking-wide">نظام الطابور</h1>
                    <p className="text-zinc-500 text-lg">شاشة العرض التلفزيونية</p>
                </div>

                {/* Start button */}
                <button
                    onClick={handleStart}
                    className="
            group relative overflow-hidden
            bg-amber-500 hover:bg-amber-400 active:scale-95
            text-zinc-950 font-black text-4xl md:text-5xl
            px-16 py-8 rounded-3xl
            shadow-[0_0_60px_-10px_rgba(245,158,11,0.7)]
            transition-all duration-200
          "
                >
                    {/* Shine effect */}
                    <span className="absolute inset-0 bg-white/20 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700 skew-x-12" />
                    بدء العرض
                </button>

                <p className="text-zinc-600 text-base">اضغط لتفعيل الصوت والاتصال المباشر</p>
            </div>
        );
    }

    // ─────────────────────────────────────────────
    // Render: Error State
    // ─────────────────────────────────────────────
    if (error) {
        return (
            <div
                dir="rtl"
                className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-4 text-white"
            >
                <div className="text-6xl">⚠️</div>
                <p className="text-2xl font-bold text-red-400">{error}</p>
                <p className="text-zinc-500">تحقق من رابط الشاشة وأعد المحاولة</p>
            </div>
        );
    }

    // ─────────────────────────────────────────────
    // Render: TV Display (Landscape, RTL, Dark)
    // ─────────────────────────────────────────────
    return (
        <div
            dir="rtl"
            className="fixed inset-0 bg-zinc-950 text-white overflow-hidden flex flex-col"
        >
            {/* ── Top bar ──────────────────────────────── */}
            <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-800/60 shrink-0">
                {/* Shop name (right, because RTL) */}
                <div className="flex items-center gap-3">
                    <span className="text-2xl">✂️</span>
                    <span className="text-xl font-bold text-zinc-200">
                        {shop?.name ?? '…'}
                    </span>
                </div>

                {/* Live indicator + reconnect badge (left, because RTL) */}
                <div className="flex items-center gap-4">
                    {reconnecting && (
                        <span className="text-amber-400 text-sm font-medium animate-pulse">
                            ⚠ إعادة الاتصال…
                        </span>
                    )}
                    {!reconnecting && (
                        <span className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
                            مباشر
                        </span>
                    )}
                    {/* Clock */}
                    <LiveClock />
                </div>
            </header>

            {/* ── Main content: right (serving) / left (waiting) ────────────────── */}
            <main className="flex flex-1 min-h-0">

                {/* Right panel — Currently Serving (60%) */}
                <section className="flex flex-col items-center justify-center w-[62%] border-l border-zinc-800/60 gap-4 px-6">
                    <p className="text-zinc-500 text-2xl font-semibold tracking-widest uppercase">
                        الرقم الحالي
                    </p>

                    {servingTicket ? (
                        <>
                            {/* Ticket number — huge, with optional pulse */}
                            <div
                                className={`
                  font-black leading-none select-none
                  text-amber-400
                  ${pulsing ? 'animate-tv-pulse' : ''}
                `}
                                style={{ fontSize: 'clamp(8rem, 22vw, 22rem)' }}
                            >
                                {servingTicket.ticket_number}
                            </div>
                            {/* Subtle sub-label */}
                            {servingTicket.customer_name && (
                                <p className="text-zinc-500 text-2xl font-medium mt-2 tracking-wide">
                                    {servingTicket.customer_name}
                                </p>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-4 opacity-30">
                            <div
                                className="font-black leading-none select-none text-zinc-600"
                                style={{ fontSize: 'clamp(8rem, 22vw, 22rem)' }}
                            >
                                —
                            </div>
                            <p className="text-zinc-600 text-xl">لا يوجد عميل حالياً</p>
                        </div>
                    )}
                </section>

                {/* Left panel — Waiting List (38%) */}
                <section className="flex flex-col w-[38%] px-6 py-6 gap-4">
                    <p className="text-zinc-500 text-xl font-semibold tracking-widest text-center mb-2">
                        في الانتظار
                    </p>

                    {waitingTickets.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-zinc-700 text-xl text-center">لا يوجد انتظار</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3 flex-1">
                            {waitingTickets.map((ticket, index) => (
                                <WaitingCard
                                    key={ticket.id}
                                    ticket={ticket}
                                    rank={index + 1}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </main>

            {/* ── Footer bar ───────────────────────────── */}
            <footer className="flex items-center justify-center px-8 py-3 border-t border-zinc-800/60 shrink-0">
                <p className="text-zinc-700 text-sm">
                    نظام إدارة الطابور الذكي — جميع الحقوق محفوظة
                </p>
            </footer>
        </div>
    );
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

/** A single waiting-ticket card in the left panel */
function WaitingCard({ ticket, rank }: { ticket: Ticket; rank: number }) {
    const colors = [
        'border-amber-500/40 bg-amber-500/5 text-amber-300',
        'border-zinc-600/40 bg-zinc-800/40 text-zinc-300',
        'border-zinc-700/30 bg-zinc-800/20 text-zinc-400',
        'border-zinc-700/20 bg-zinc-800/10 text-zinc-500',
    ];
    const colorClass = colors[Math.min(rank - 1, colors.length - 1)];

    return (
        <div
            className={`
        flex items-center justify-between
        rounded-2xl border px-5 py-4
        transition-all duration-300
        ${colorClass}
      `}
        >
            {/* Ticket number */}
            <span
                className="font-black leading-none"
                style={{ fontSize: 'clamp(2.5rem, 5vw, 5rem)' }}
            >
                {ticket.ticket_number}
            </span>

            {/* Customer name + people count */}
            <div className="text-right">
                {ticket.customer_name && (
                    <p className="font-semibold text-lg leading-tight">{ticket.customer_name}</p>
                )}
                {ticket.people_count > 1 && (
                    <p className="text-sm opacity-70">
                        {ticket.people_count} أشخاص
                    </p>
                )}
            </div>
        </div>
    );
}

/** Live clock — updates every second */
function LiveClock() {
    const [time, setTime] = useState(() => formatTime(new Date()));

    useEffect(() => {
        const id = setInterval(() => setTime(formatTime(new Date())), 1000);
        return () => clearInterval(id);
    }, []);

    return (
        <span className="text-zinc-500 text-lg font-mono tabular-nums">
            {time}
        </span>
    );
}

function formatTime(d: Date): string {
    return d.toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' });
}
