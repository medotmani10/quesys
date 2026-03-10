import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react';

export default function SuperAdminLoginPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error || !data.user) {
                toast.error('بيانات الدخول غير صحيحة');
                setLoading(false);
                return;
            }

            // Check if this user is a superadmin
            const { data: adminRow, error: adminErr } = await supabase
                .from('superadmins')
                .select('user_id')
                .eq('user_id', data.user.id)
                .single();

            if (adminErr || !adminRow) {
                // Not authorized — sign them back out
                await supabase.auth.signOut();
                toast.error('غير مصرح لك بالوصول إلى هذه اللوحة');
                setLoading(false);
                return;
            }

            navigate('/superadmin');
        } catch {
            toast.error('حدث خطأ غير متوقع');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-black text-white flex items-center justify-center p-6" dir="rtl">
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-600/10 rounded-full blur-[100px]" />
                <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-red-600/5 rounded-full blur-[100px]" />
            </div>

            <div className="w-full max-w-sm relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Logo */}
                <div className="flex flex-col items-center gap-4 mb-10">
                    <div className="w-20 h-20 rounded-2xl bg-red-600/10 border border-red-600/30 flex items-center justify-center shadow-[0_0_40px_rgba(220,38,38,0.2)]">
                        <ShieldCheck className="w-10 h-10 text-red-500" />
                    </div>
                    <div className="text-center">
                        <h1 className="text-2xl font-black text-white">SuperAdmin</h1>
                        <p className="text-zinc-600 text-sm mt-1">لوحة تحكم المشرف العام</p>
                    </div>
                </div>

                {/* Login form */}
                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-zinc-400 text-sm font-bold">البريد الإلكتروني</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="admin@example.com"
                            dir="ltr"
                            required
                            className="w-full h-14 rounded-2xl bg-zinc-900/80 border border-zinc-800 focus:border-red-500/50 focus:outline-none text-white px-4 text-sm placeholder:text-zinc-700 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-zinc-400 text-sm font-bold">كلمة المرور</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                dir="ltr"
                                required
                                className="w-full h-14 rounded-2xl bg-zinc-900/80 border border-zinc-800 focus:border-red-500/50 focus:outline-none text-white px-4 text-sm placeholder:text-zinc-700 transition-all pr-12"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(v => !v)}
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !email || !password}
                        className="w-full h-14 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-black text-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_24px_-4px_rgba(220,38,38,0.4)] hover:shadow-[0_8px_32px_-4px_rgba(220,38,38,0.5)] mt-2 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ShieldCheck className="w-5 h-5" />دخول</>}
                    </button>
                </form>
            </div>
        </div>
    );
}
