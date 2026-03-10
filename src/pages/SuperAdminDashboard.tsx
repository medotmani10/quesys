import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import {
    ShieldCheck, LogOut, Check, X, Trash2, Edit2, ExternalLink,
    Loader2, Store, Users, AlertCircle, RefreshCw, ToggleLeft, ToggleRight
} from 'lucide-react';

interface ShopRow {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    is_open: boolean;
    is_approved: boolean;
    created_at: string;
    phone: string | null;
    logo_url: string | null;
    owner_email?: string;
}

export default function SuperAdminDashboard() {
    const navigate = useNavigate();
    const [shops, setShops] = useState<ShopRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');
    const [editingShop, setEditingShop] = useState<ShopRow | null>(null);
    const [editName, setEditName] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const fetchShops = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch all shops
            const { data: shopData, error } = await supabase
                .from('shops')
                .select('id, name, slug, owner_id, is_open, is_approved, created_at, phone, logo_url')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Fetch owner emails from auth.users via a helper join (we query profiles or use edge function)
            // As a fallback, we just show owner_id since we can't query auth.users directly from client
            setShops((shopData || []) as ShopRow[]);
        } catch (e) {
            console.error(e);
            toast.error('فشل تحميل البيانات');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Auth guard
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (!session) { navigate('/'); return; }
            const { data: adminRow } = await supabase
                .from('superadmins')
                .select('user_id')
                .eq('user_id', session.user.id)
                .single();
            if (!adminRow) { await supabase.auth.signOut(); navigate('/'); return; }
            fetchShops();
        });
    }, [fetchShops, navigate]);

    const approveShop = async (shopId: string) => {
        const { error } = await supabase
            .from('shops')
            .update({ is_approved: true, is_open: true })
            .eq('id', shopId);
        if (error) { toast.error('فشل الموافقة'); return; }
        toast.success('تمت الموافقة على الصالون ✓');
        setShops(prev => prev.map(s => s.id === shopId ? { ...s, is_approved: true, is_open: true } : s));
    };

    const toggleOpen = async (shop: ShopRow) => {
        const { error } = await supabase
            .from('shops')
            .update({ is_open: !shop.is_open })
            .eq('id', shop.id);
        if (error) { toast.error('فشل التحديث'); return; }
        setShops(prev => prev.map(s => s.id === shop.id ? { ...s, is_open: !shop.is_open } : s));
    };

    const deleteShop = async (shopId: string) => {
        setDeletingId(shopId);
        try {
            const { error } = await supabase.from('shops').delete().eq('id', shopId);
            if (error) throw error;
            toast.success('تم حذف الصالون');
            setShops(prev => prev.filter(s => s.id !== shopId));
        } catch {
            toast.error('فشل الحذف');
        } finally {
            setDeletingId(null);
            setConfirmDeleteId(null);
        }
    };

    const saveEdit = async () => {
        if (!editingShop || !editName.trim()) return;
        setSaving(true);
        const { error } = await supabase
            .from('shops')
            .update({ name: editName.trim(), phone: editPhone.trim() || null })
            .eq('id', editingShop.id);
        if (error) { toast.error('فشل الحفظ'); setSaving(false); return; }
        toast.success('تم الحفظ ✓');
        setShops(prev => prev.map(s => s.id === editingShop.id ? { ...s, name: editName.trim(), phone: editPhone.trim() || null } : s));
        setEditingShop(null);
        setSaving(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    const pending = shops.filter(s => !s.is_approved);
    const approved = shops.filter(s => s.is_approved);

    const filtered = shops.filter(s => {
        const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.slug.includes(search.toLowerCase());
        if (filter === 'pending') return !s.is_approved && matchSearch;
        if (filter === 'approved') return s.is_approved && matchSearch;
        return matchSearch;
    });

    return (
        <div className="min-h-[100dvh] bg-[#070709] text-white" dir="rtl">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-zinc-800/80">
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-600/30 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <h1 className="font-black text-white text-base leading-tight">SuperAdmin</h1>
                            <p className="text-zinc-600 text-xs">لوحة تحكم المشرف العام</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchShops}
                            className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-white hover:border-zinc-600 flex items-center justify-center transition-all"
                            title="تحديث"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-red-400 hover:border-red-500/30 text-xs font-bold transition-all"
                        >
                            <LogOut className="w-4 h-4" />
                            خروج
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-8">

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'إجمالي الصالونات', value: shops.length, color: 'border-zinc-700/40', text: 'text-zinc-200', icon: <Store className="w-4 h-4 text-zinc-400" /> },
                        { label: 'تحت المراجعة', value: pending.length, color: 'border-amber-500/20', text: 'text-amber-400', icon: <AlertCircle className="w-4 h-4 text-amber-400" /> },
                        { label: 'مفعّلة', value: approved.length, color: 'border-emerald-500/20', text: 'text-emerald-400', icon: <Users className="w-4 h-4 text-emerald-400" /> },
                    ].map((stat, i) => (
                        <div key={i} className={`bg-zinc-950 border ${stat.color} rounded-2xl p-4 flex flex-col gap-2`}>
                            <div className="flex items-center gap-2 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                                {stat.icon}{stat.label}
                            </div>
                            <p className={`text-4xl font-black ${stat.text}`}>{stat.value}</p>
                        </div>
                    ))}
                </div>

                {/* Pending Approvals Section */}
                {pending.length > 0 && (
                    <section className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                            </div>
                            <h2 className="text-lg font-black text-amber-400">طلبات تنتظر الموافقة ({pending.length})</h2>
                        </div>
                        <div className="grid gap-3">
                            {pending.map(shop => (
                                <div key={shop.id} className="bg-zinc-950 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-4">
                                    {shop.logo_url
                                        ? <img src={shop.logo_url} alt="" className="w-12 h-12 rounded-xl object-contain border border-zinc-800 shrink-0" />
                                        : <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0"><Store className="w-5 h-5 text-amber-400" /></div>
                                    }
                                    <div className="flex-1 min-w-0">
                                        <p className="font-black text-white truncate">{shop.name}</p>
                                        <p className="text-zinc-500 text-xs" dir="ltr">{shop.slug} • {new Date(shop.created_at).toLocaleDateString('ar')}</p>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button
                                            onClick={() => approveShop(shop.id)}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 font-bold text-sm transition-all"
                                        >
                                            <Check className="w-4 h-4" />موافقة
                                        </button>
                                        <button
                                            onClick={() => setConfirmDeleteId(shop.id)}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 font-bold text-sm transition-all"
                                        >
                                            <X className="w-4 h-4" />رفض
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* All Shops Table */}
                <section className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <h2 className="text-lg font-black text-white">كل الصالونات</h2>
                        <div className="flex gap-2 flex-wrap">
                            {(['all', 'pending', 'approved'] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all
                    ${filter === f
                                            ? 'bg-white text-black border-white'
                                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                                        }`}
                                >
                                    {f === 'all' ? 'الكل' : f === 'pending' ? 'قيد الانتظار' : 'مفعّلة'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="بحث باسم الصالون أو الـ slug..."
                        className="w-full h-12 rounded-2xl bg-zinc-900 border border-zinc-800 text-white px-4 text-sm placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-all"
                        dir="rtl"
                    />

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filtered.length === 0 && (
                                <p className="text-center text-zinc-600 py-12">لا توجد نتائج</p>
                            )}
                            {filtered.map(shop => (
                                <div key={shop.id} className={`bg-zinc-950 border rounded-2xl p-4 flex items-center gap-3 transition-all
                  ${shop.is_approved ? 'border-zinc-800/80' : 'border-amber-500/15'}`}>

                                    {shop.logo_url
                                        ? <img src={shop.logo_url} alt="" className="w-10 h-10 rounded-xl object-contain border border-zinc-800 shrink-0" />
                                        : <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0"><Store className="w-4 h-4 text-zinc-600" /></div>
                                    }

                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-white text-sm truncate">{shop.name}</p>
                                        <p className="text-zinc-600 text-xs" dir="ltr">{shop.slug}</p>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                                        {/* Approval badge */}
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border
                      ${shop.is_approved
                                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                                            {shop.is_approved ? 'مفعّل' : 'معلّق'}
                                        </span>

                                        {/* Toggle open */}
                                        <button
                                            onClick={() => toggleOpen(shop)}
                                            title={shop.is_open ? 'إغلاق الصالون' : 'فتح الصالون'}
                                            className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all
                        ${shop.is_open
                                                    ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                                                    : 'border-zinc-800 text-zinc-600 bg-zinc-900 hover:border-zinc-600'}`}
                                        >
                                            {shop.is_open ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                                        </button>

                                        {/* View customer page */}
                                        <a
                                            href={`https://barberticket.vercel.app/${shop.slug}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="w-8 h-8 rounded-xl border border-zinc-800 text-zinc-500 bg-zinc-900 hover:text-white hover:border-zinc-600 flex items-center justify-center transition-all"
                                            title="عرض صفحة الزبائن"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </a>

                                        {/* Edit */}
                                        <button
                                            onClick={() => { setEditingShop(shop); setEditName(shop.name); setEditPhone(shop.phone || ''); }}
                                            className="w-8 h-8 rounded-xl border border-zinc-800 text-zinc-500 bg-zinc-900 hover:text-amber-400 hover:border-amber-500/30 flex items-center justify-center transition-all"
                                            title="تعديل"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>

                                        {/* Approve if pending */}
                                        {!shop.is_approved && (
                                            <button
                                                onClick={() => approveShop(shop.id)}
                                                className="w-8 h-8 rounded-xl border border-emerald-500/30 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 flex items-center justify-center transition-all"
                                                title="موافقة"
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                            </button>
                                        )}

                                        {/* Delete */}
                                        <button
                                            onClick={() => setConfirmDeleteId(shop.id)}
                                            disabled={deletingId === shop.id}
                                            className="w-8 h-8 rounded-xl border border-zinc-800 text-zinc-600 bg-zinc-900 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 flex items-center justify-center transition-all disabled:opacity-50"
                                            title="حذف"
                                        >
                                            {deletingId === shop.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {/* Edit Modal */}
            {editingShop && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
                    <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 w-full max-w-md space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between">
                            <h3 className="font-black text-white text-xl">تعديل الصالون</h3>
                            <button onClick={() => setEditingShop(null)} className="w-8 h-8 rounded-xl border border-zinc-800 text-zinc-500 hover:text-white flex items-center justify-center"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-zinc-400 text-sm font-bold">اسم الصالون</label>
                                <input
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    className="w-full h-12 rounded-xl bg-black border border-zinc-800 focus:border-zinc-600 text-white px-4 text-sm focus:outline-none transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-zinc-400 text-sm font-bold">رقم الهاتف</label>
                                <input
                                    value={editPhone}
                                    onChange={e => setEditPhone(e.target.value)}
                                    dir="ltr"
                                    className="w-full h-12 rounded-xl bg-black border border-zinc-800 focus:border-zinc-600 text-white px-4 text-sm focus:outline-none transition-all placeholder:text-zinc-700"
                                    placeholder="05xxxxxxxx"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button onClick={() => setEditingShop(null)} className="flex-1 h-12 rounded-xl border border-zinc-800 bg-black text-zinc-400 hover:text-white font-bold text-sm transition-all">إلغاء</button>
                            <button onClick={saveEdit} disabled={saving || !editName.trim()} className="flex-1 h-12 rounded-xl bg-white text-black font-black text-sm transition-all hover:bg-zinc-100 disabled:opacity-50 flex items-center justify-center gap-2">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ التعديلات'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            {confirmDeleteId && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
                    <div className="bg-zinc-950 border border-red-500/20 rounded-3xl p-6 w-full max-w-sm space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                <Trash2 className="w-7 h-7 text-red-500" />
                            </div>
                            <div>
                                <h3 className="font-black text-white text-lg">تأكيد الحذف</h3>
                                <p className="text-zinc-500 text-sm mt-1">هل أنت متأكد؟ سيتم حذف الصالون وجميع بياناته بشكل نهائي.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDeleteId(null)} className="flex-1 h-12 rounded-xl border border-zinc-800 bg-black text-zinc-400 hover:text-white font-bold text-sm transition-all">إلغاء</button>
                            <button
                                onClick={() => deleteShop(confirmDeleteId)}
                                disabled={deletingId === confirmDeleteId}
                                className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {deletingId === confirmDeleteId ? <Loader2 className="w-4 h-4 animate-spin" /> : 'نعم، احذف'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
