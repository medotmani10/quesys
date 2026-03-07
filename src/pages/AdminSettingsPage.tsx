import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Shop, Barber } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Store, MapPin, Upload, ArrowRight, Save, Plus, Scissors, Loader2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';

export default function AdminSettingsPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [shop, setShop] = useState<Shop | null>(null);
    const [barbers, setBarbers] = useState<Barber[]>([]);

    const [shopName, setShopName] = useState('');
    const [mapsUrl, setMapsUrl] = useState('');
    const [shopPhone, setShopPhone] = useState('');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [newBarberName, setNewBarberName] = useState('');
    const [newBarberPassword, setNewBarberPassword] = useState('');
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                navigate('/');
                return;
            }

            setCurrentUser(session.user);

            const { data: shopData } = await supabase
                .from('shops')
                .select('*')
                .eq('owner_id', session.user.id)
                .single();

            if (shopData) {
                setShop(shopData);
                setShopName(shopData.name);
                setMapsUrl(shopData.maps_url || '');
                setShopPhone(shopData.phone || '');
                setLogoPreview(shopData.logo_url);

                const { data: barbersData } = await supabase
                    .from('barbers')
                    .select('*')
                    .eq('shop_id', shopData.id)
                    .order('created_at', { ascending: true });

                if (barbersData) {
                    setBarbers(barbersData);
                }
            } else {
                navigate('/onboarding');
            }
        } catch (error) {
            toast.error('حدث خطأ أثناء تحميل البيانات');
        } finally {
            setLoading(false);
        }
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const uploadLogo = async (): Promise<string | null> => {
        if (!logoFile || !currentUser) return null;

        let fileToUpload = logoFile;
        try {
            fileToUpload = await compressImage(logoFile, 0.5, 800);
        } catch (error) {
            console.error('Failed to compress image:', error);
        }

        const fileExt = fileToUpload.name.split('.').pop();
        const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('shop-logos')
            .upload(fileName, fileToUpload);

        if (uploadError) {
            toast.error('فشل رفع الشعار');
            return null;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('shop-logos')
            .getPublicUrl(fileName);

        return publicUrl;
    };

    const saveShopSettings = async () => {
        if (!shop || !shopName.trim()) {
            toast.error('يرجى إدخال اسم الصالون');
            return;
        }

        setSaving(true);
        try {
            let logoUrl = shop.logo_url;
            if (logoFile) {
                const uploadedUrl = await uploadLogo();
                if (uploadedUrl) logoUrl = uploadedUrl;
            }

            // Generate new slug if name changed
            const slug = shopName.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').substring(0, 50);

            const { error } = await supabase
                .from('shops')
                .update({
                    name: shopName.trim(),
                    maps_url: mapsUrl.trim() || null,
                    phone: shopPhone.trim() || null,
                    logo_url: logoUrl,
                    slug: slug !== shop.slug ? slug : shop.slug // only update if different, note: might cause 23505 if slug exists
                })
                .eq('id', shop.id);

            if (error) {
                if (error.code === '23505') {
                    toast.error('اسم الصالون مستخدم بالفعل، يرجى اختيار اسم آخر');
                } else {
                    toast.error('فشل حفظ الإعدادات');
                }
            } else {
                toast.success('تم حفظ إعدادات الصالون بنجاح');
                // Refresh data
                loadData();
            }
        } catch (error) {
            toast.error('حدث خطأ غير متوقع');
        } finally {
            setSaving(false);
        }
    };

    const addBarber = async () => {
        if (!shop || !newBarberName.trim() || !newBarberPassword.trim()) return;

        setSaving(true);
        try {
            // Generate deterministic pseudo email from Arabic/English username
            const rawName = newBarberName.trim();
            const safeName = btoa(encodeURIComponent(rawName)).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const pseudoEmail = `${safeName}@${shop.slug}.com`;

            // Create a temporary client to avoid overwriting the admin's session
            const tempClient = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_ANON_KEY,
                { auth: { persistSession: false, autoRefreshToken: false } }
            );

            // 1. Sign up the barber in Supabase Auth
            const { data: authData, error: authError } = await tempClient.auth.signUp({
                email: pseudoEmail,
                password: newBarberPassword.trim()
            });

            if (authError) throw authError;
            if (!authData.user) throw new Error('فشل إنشاء حساب الحلاق');

            // 2. Insert into barbers table
            const { data, error } = await supabase
                .from('barbers')
                .insert({
                    shop_id: shop.id,
                    name: newBarberName.trim(),
                    is_active: true,
                    auth_id: authData.user.id
                })
                .select()
                .single();

            if (error) throw error;

            setBarbers([...barbers, data]);
            setNewBarberName('');
            setNewBarberPassword('');
            toast.success('تم إضافة الحلاق وإنشاء حسابه بنجاح');
        } catch (error: any) {
            console.error('Add barber error:', error);
            toast.error(error.message || 'فشل إضافة الحلاق');
        } finally {
            setSaving(false);
        }
    };

    const toggleBarberStatus = async (barberId: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('barbers')
                .update({ is_active: !currentStatus })
                .eq('id', barberId);

            if (error) throw error;

            setBarbers(barbers.map(b => b.id === barberId ? { ...b, is_active: !currentStatus } : b));
            toast.success(currentStatus ? 'تم إيقاف الحلاق' : 'تم تفعيل الحلاق');
        } catch (error) {
            toast.error('فشل تحديث حالة الحلاق');
        }
    };

    if (loading) {
        return (
            <div className="min-h-[100dvh] bg-zinc-950 flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-yellow-400 animate-spin mb-4" />
                <p className="text-yellow-400/80 font-medium">جاري تحميل الإعدادات...</p>
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] bg-zinc-950 relative overflow-hidden pb-12">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>

            {/* Header */}
            <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-zinc-800 relative mb-8">
                <div className="max-w-4xl mx-auto px-4 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="font-black text-2xl text-white">إعدادات <span className="text-yellow-400">النظام</span></h1>
                    </div>
                    <Button
                        variant="ghost"
                        onClick={() => navigate('/admin')}
                        className="rounded-xl hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors gap-2"
                    >
                        العودة للوحة التحكم
                        <ArrowRight className="w-5 h-5" />
                    </Button>
                </div>
            </header>

            <div className="max-w-4xl mx-auto px-4 relative z-10 space-y-8">
                {/* Shop Settings */}
                <Card className="rounded-[2.5rem] border border-zinc-800/80 bg-zinc-950/50 backdrop-blur-xl shadow-2xl overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="border-b border-zinc-800/80 pb-6">
                        <CardTitle className="flex items-center gap-3 text-2xl text-white">
                            <Store className="w-7 h-7 text-yellow-400" />
                            معلومات الصالون الأساسية
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8 relative z-10">
                        {/* Logo Upload */}
                        <div className="flex flex-col sm:flex-row items-center gap-8 bg-black/40 p-6 rounded-3xl border border-zinc-800/50">
                            <div className="w-32 h-32 rounded-[2rem] border-2 border-dashed border-zinc-700 flex items-center justify-center overflow-hidden bg-zinc-900/50 relative group/logo">
                                {logoPreview ? (
                                    <>
                                        <img src={logoPreview} alt="Shop Logo" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity">
                                            <Upload className="w-8 h-8 text-yellow-400" />
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center text-zinc-500">
                                        <Upload className="w-8 h-8 mb-2 opacity-50" />
                                        <span className="text-xs font-medium">رفع شعار</span>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                            </div>
                            <div className="flex-1 text-center sm:text-right">
                                <h3 className="text-lg font-bold text-white mb-2">شعار الصالون</h3>
                                <p className="text-zinc-500 text-sm">اختر صورة واضحة ومميزة لصالونك. يفضل أن تكون بخلفية شفافة (PNG).</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <Label className="text-zinc-300 font-medium text-base ml-2">اسم الصالون</Label>
                            <Input
                                value={shopName}
                                onChange={(e) => setShopName(e.target.value)}
                                placeholder="اسم الصالون..."
                                className="rounded-2xl h-14 bg-black/50 border-zinc-800 focus-visible:ring-yellow-400 focus-visible:border-yellow-400/50 text-white placeholder:text-zinc-700 text-lg transition-all hover:border-zinc-700"
                            />
                        </div>

                        <div className="space-y-4">
                            <Label className="text-zinc-300 font-medium text-base ml-2 flex items-center gap-2">
                                رابط خرائط Google
                                <MapPin className="w-4 h-4 text-yellow-400" />
                            </Label>
                            <Input
                                value={mapsUrl}
                                onChange={(e) => setMapsUrl(e.target.value)}
                                placeholder="https://maps.google.com/..."
                                className="rounded-2xl h-14 bg-black/50 border-zinc-800 focus-visible:ring-yellow-400 focus-visible:border-yellow-400/50 text-white placeholder:text-zinc-700 text-lg transition-all hover:border-zinc-700 text-left"
                                dir="ltr"
                            />
                        </div>

                        <div className="space-y-4">
                            <Label className="text-zinc-300 font-medium text-base ml-2 flex items-center gap-2">
                                رقم هاتف المحل
                                <Smartphone className="w-4 h-4 text-yellow-400" />
                            </Label>
                            <Input
                                value={shopPhone}
                                onChange={(e) => setShopPhone(e.target.value)}
                                placeholder="05xxxxxxxx"
                                className="rounded-2xl h-14 bg-black/50 border-zinc-800 focus-visible:ring-yellow-400 focus-visible:border-yellow-400/50 text-white placeholder:text-zinc-700 text-lg transition-all hover:border-zinc-700 text-left"
                                dir="ltr"
                                type="tel"
                            />
                        </div>

                        <Button
                            onClick={saveShopSettings}
                            disabled={saving}
                            className="w-full rounded-2xl h-16 bg-yellow-400 hover:bg-yellow-500 text-black text-lg font-black mt-4 shadow-[0_0_20px_rgba(250,204,21,0.2)] transition-all hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(250,204,21,0.4)] border-none"
                        >
                            {saving ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    <Save className="w-6 h-6 mr-3" />
                                    حفظ الإعدادات الأساسية
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Barbers Settings */}
                <Card className="rounded-[2.5rem] border border-zinc-800/80 bg-zinc-950/50 backdrop-blur-xl shadow-2xl overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="border-b border-zinc-800/80 pb-6">
                        <div className="flex justify-between items-center">
                            <CardTitle className="flex items-center gap-3 text-2xl text-white">
                                <Scissors className="w-7 h-7 text-yellow-400" />
                                إدارة الحلاقين
                            </CardTitle>
                            <span className="bg-zinc-900 text-yellow-400 px-4 py-1.5 rounded-full font-bold text-sm border border-yellow-400/20">
                                {barbers.length} حلاق
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6 relative z-10">
                        {/* Add Barber */}
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Input
                                value={newBarberName}
                                onChange={(e) => setNewBarberName(e.target.value)}
                                placeholder="اسم الحلاق الجديد..."
                                className="flex-1 rounded-2xl h-14 bg-black/50 border-zinc-800 focus-visible:ring-yellow-400 focus-visible:border-yellow-400/50 text-white placeholder:text-zinc-700 text-lg transition-all hover:border-zinc-700"
                            />
                            <Input
                                value={newBarberPassword}
                                onChange={(e) => setNewBarberPassword(e.target.value)}
                                placeholder="إنشاء كلمة مرور للحلاق..."
                                type="password"
                                className="flex-1 rounded-2xl h-14 bg-black/50 border-zinc-800 focus-visible:ring-yellow-400 focus-visible:border-yellow-400/50 text-white placeholder:text-zinc-700 text-lg transition-all hover:border-zinc-700"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') addBarber();
                                }}
                            />
                            <Button
                                onClick={addBarber}
                                disabled={!newBarberName.trim() || !newBarberPassword.trim() || saving}
                                className="sm:w-32 rounded-2xl h-14 bg-yellow-400 hover:bg-yellow-500 text-black font-bold shadow-glow transition-all disabled:opacity-50 flex items-center justify-center"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5 ml-1" /> إضافة</>}
                            </Button>
                        </div>

                        <div className="grid gap-4 mt-8">
                            {barbers.map((barber) => (
                                <div key={barber.id} className="flex items-center justify-between p-5 bg-black/40 rounded-2xl border border-zinc-800/50 hover:border-yellow-400/30 transition-all hover:shadow-[0_0_15px_rgba(250,204,21,0.05)]">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${barber.is_active ? 'bg-green-500/10 border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 'bg-zinc-900 border-zinc-800'}`}>
                                            <Scissors className={`w-6 h-6 ${barber.is_active ? 'text-green-500' : 'text-zinc-600'}`} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-lg">{barber.name}</p>
                                            <p className={`text-sm font-medium ${barber.is_active ? 'text-green-400' : 'text-zinc-500'}`}>
                                                {barber.is_active ? 'متاح للعمل' : 'غير متاح حالياً'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Switch
                                            checked={barber.is_active}
                                            onCheckedChange={() => toggleBarberStatus(barber.id, barber.is_active)}
                                            className="data-[state=checked]:bg-green-500"
                                        />
                                    </div>
                                </div>
                            ))}

                            {barbers.length === 0 && (
                                <div className="text-center py-8 opacity-50">
                                    <Scissors className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
                                    <p className="text-zinc-500 text-lg font-medium">لم يتم إضافة أي حلاقين بعد</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
