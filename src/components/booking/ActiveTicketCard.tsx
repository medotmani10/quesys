import type { Ticket, Barber } from '@/types/database';
import { Button } from '@/components/ui/button';
import { CheckCircle, X } from 'lucide-react';
import { getTicketCode } from '@/lib/utils';

interface Props {
    ticket: Ticket;
    peopleAhead: number;
    barbers: Barber[];
    onCancel: () => void;
}

export default function ActiveTicketCard({ ticket, peopleAhead, barbers, onCancel }: Props) {
    const barberIndex = barbers.findIndex(b => b.id === ticket.barber_id);
    const barber = barbers.find(b => b.id === ticket.barber_id);
    const code = getTicketCode(barberIndex, ticket.ticket_number);

    const isServing = ticket.status === 'serving';

    return (
        <div className="min-h-[100dvh] bg-black flex flex-col items-center justify-center p-6" dir="rtl">
            <div className={`w-full max-w-sm rounded-3xl border p-8 flex flex-col items-center gap-6 text-center shadow-2xl transition-all ${isServing
                ? 'border-green-500/50 bg-green-950/20 shadow-green-500/10'
                : 'border-yellow-500/30 bg-zinc-950 shadow-yellow-500/5'
                }`}>
                {/* Status badge */}
                <div className={`px-4 py-1.5 rounded-full text-sm font-black border ${isServing
                    ? 'bg-green-400/10 text-green-400 border-green-400/20 animate-pulse'
                    : 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20'
                    }`}>
                    {isServing ? '🎉 دورك الآن!' : 'في انتظار دورك'}
                </div>

                {/* Ticket code */}
                <div>
                    <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">رمز تذكرتك</p>
                    <p className={`text-7xl font-black tracking-tight ${isServing ? 'text-green-400' : 'text-yellow-400'}`}>
                        {code}
                    </p>
                </div>

                {/* Info */}
                <div className="w-full border-t border-zinc-800 pt-5 space-y-3 text-sm">
                    {barber && (
                        <div className="flex justify-between text-zinc-400">
                            <span>الحلاق</span>
                            <span className="text-white font-bold">{barber.name}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-zinc-400">
                        <span>الأشخاص أمامك</span>
                        <span className="text-white font-bold">
                            {isServing
                                ? <span className="text-green-400 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> جاهز</span>
                                : peopleAhead}
                        </span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                        <span>اسمك</span>
                        <span className="text-white font-bold">{ticket.customer_name}</span>
                    </div>
                </div>

                {/* Cancel */}
                {!isServing && (
                    <Button
                        variant="ghost"
                        onClick={onCancel}
                        className="w-full text-zinc-600 hover:text-red-400 hover:border-red-500/30 border border-transparent rounded-xl h-11 transition-all text-sm"
                    >
                        <X className="w-4 h-4 ml-2" />
                        إلغاء الحجز
                    </Button>
                )}
            </div>
        </div>
    );
}
