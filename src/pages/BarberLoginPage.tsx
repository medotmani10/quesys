import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Scissors, Loader2, ChevronLeft, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import BarberInstallPrompt from '@/components/BarberInstallPrompt';

export default function BarberLoginPage() {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const [shopSlug, setShopSlug] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const activeSlug = slug || shopSlug.trim();

    useEffect(() => {
        const savedSlug = localStorage.getItem('barber_shop_slug');
        if (!slug && savedSlug && !window.location.pathname.includes('login')) {
            // Auto-redirect to dashboard if we have a saved slug and are on root
            navigate(`/${savedSlug}/barber`);
            return;
        }
        checkUser(activeSlug || savedSlug);
    }, [slug]);

    const checkUser = async (currentSlug: string | null = activeSlug) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            // Check if this user is a barber for this shop
            const { data: barber } = await supabase
                .from('barbers')
                .select('id, shop_id')
                .eq('auth_id', session.user.id)
                .single();

            if (barber) {
                const { data: shop } = await supabase
                    .from('shops')
                    .select('slug')
                    .eq('id', barber.shop_id)
                    .single();

                if (shop && currentSlug && shop.slug === currentSlug) {
                    localStorage.setItem('barber_shop_slug', currentSlug);
                    navigate(`/${currentSlug}/barber`);
                } else if (shop && !slug) {
                    // We're on root but logged in as a barber for SOME shop, go to that shop
                    localStorage.setItem('barber_shop_slug', shop.slug);
                    navigate(`/${shop.slug}/barber`);
                }
            }
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeSlug || !username.trim() || !password.trim()) {
            if (!activeSlug) toast.error('يرجى إدخال معرف الصالون');
            return;
        }

        setLoading(true);

        // Generate pseudo email (hex encoding to match admin creation)
        const rawName = username.trim();
        const hexName = Array.from(new TextEncoder().encode(rawName))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        const pseudoEmail = `${hexName}@${activeSlug}.com`;

        const { error } = await supabase.auth.signInWithPassword({
            email: pseudoEmail,
            password: password.trim()
        });

        if (error) {
            if (error.message === 'Invalid login credentials') {
                toast.error('اسم الحلاق أو كلمة المرور غير صحيحة');
            } else {
                toast.error(error.message);
            }
            setLoading(false);
            return;
        }

        toast.success('تم تسجيل الدخول بنجاح');

        // User is now logged in, verify they are a barber for THIS shop
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            const { data: barber } = await supabase
                .from('barbers')
                .select('id, shop_id')
                .eq('auth_id', session.user.id)
                .single();

            if (barber) {
                const { data: shop } = await supabase
                    .from('shops')
                    .select('slug')
                    .eq('id', barber.shop_id)
                    .single();

                if (shop && shop.slug === activeSlug && activeSlug) {
                    localStorage.setItem('barber_shop_slug', activeSlug);
                    navigate(`/${activeSlug}/barber`);
                    setLoading(false);
                    return;
                }
            }
        }

        // If not a barber for this shop, sign out
        await supabase.auth.signOut();
        toast.error('أنت لست مسجلاً كحلاق في هذا الصالون');
        setLoading(false);
    };

    return (
        <div className="min-h-[100dvh] bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden" dir="rtl">
            <BarberInstallPrompt />
            {/* Background decoration */}
            <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400" />
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-yellow-400/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-yellow-400/5 rounded-full blur-3xl" />

            <div className="w-full max-w-sm space-y-8 relative z-10">
                <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.3)] mb-6">
                        <Scissors className="w-8 h-8 text-black" />
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight">نظام الحلاقين</h1>
                    <p className="text-zinc-500 mt-2 font-medium text-sm">أدخل اسمك وكلمة المرور للبدء</p>
                </div>

                <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 p-6 sm:p-8 rounded-[2rem] shadow-2xl">
                    <form onSubmit={handleLogin} className="space-y-5">
                        {!slug && (
                            <div className="space-y-2">
                                <Label className="text-zinc-300 text-sm font-bold mr-1">معرف الصالون (الرابط)</Label>
                                <Input
                                    type="text"
                                    value={shopSlug}
                                    onChange={(e) => setShopSlug(e.target.value)}
                                    placeholder="salon-name"
                                    className="rounded-xl h-14 bg-black/50 border-zinc-800 focus-visible:ring-yellow-400 text-white placeholder:text-zinc-600 text-lg"
                                    required
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label className="text-zinc-300 text-sm font-bold mr-1">اسم الحلاق</Label>
                            <Input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="محمد، أحمد..."
                                className="rounded-xl h-14 bg-black/50 border-zinc-800 focus-visible:ring-yellow-400 text-white placeholder:text-zinc-600 text-lg"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-zinc-300 text-sm font-bold mr-1">كلمة المرور</Label>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="rounded-xl h-14 bg-black/50 border-zinc-800 focus-visible:ring-yellow-400 text-white text-lg"
                                required
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading || !username.trim() || !password.trim() || !activeSlug}
                            className="w-full rounded-xl h-14 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-lg transition-all shadow-[0_4px_12px_rgba(250,204,21,0.15)] mt-4 active:scale-[0.98]"
                        >
                            {loading ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <div className="flex items-center gap-2">
                                    دخول للحساب
                                    <LogIn className="w-5 h-5 mr-1" />
                                </div>
                            )}
                        </Button>
                    </form>
                </div>

                {slug && (
                    <Button
                        variant="ghost"
                        onClick={() => navigate(`/${slug}`)}
                        className="w-full text-zinc-500 hover:text-white"
                    >
                        <ChevronLeft className="w-4 h-4 ml-2" />
                        العودة لصفحة الحجز
                    </Button>
                )}
            </div>
        </div>
    );
}
