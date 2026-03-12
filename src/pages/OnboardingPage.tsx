import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Shop } from '@/types/database';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, X, Upload, Store, MapPin, Users, ChevronLeft, Check, Smartphone, Scissors } from 'lucide-react';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';
import { MOROCCO_MOBILE_PHONE_REGEX } from '@/lib/utils';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [pending, setPending] = useState(false);
  const [shopName, setShopName] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [barbers, setBarbers] = useState([{ name: '', password: '' }]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/');
      return;
    }
    setCurrentUser(session.user);

    // Check if shop already exists
    const { data: shop } = await supabase
      .from('shops')
      .select('slug')
      .eq('owner_id', session.user.id)
      .single();

    if (shop) {
      navigate('/admin');
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

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

  const addBarberField = () => {
    setBarbers([...barbers, { name: '', password: '' }]);
  };

  const removeBarberField = (index: number) => {
    if (barbers.length > 1) {
      setBarbers(barbers.filter((_, i) => i !== index));
    }
  };

  const updateBarberName = (index: number, value: string) => {
    const newBarbers = [...barbers];
    newBarbers[index].name = value;
    setBarbers(newBarbers);
  };

  const updateBarberPassword = (index: number, value: string) => {
    const newBarbers = [...barbers];
    newBarbers[index].password = value;
    setBarbers(newBarbers);
  };

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
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

  const handleSubmit = async () => {
    if (!shopName.trim()) {
      toast.error('يرجى إدخال اسم الصالون');
      return;
    }

    if (shopPhone.trim() && !MOROCCO_MOBILE_PHONE_REGEX.test(shopPhone.trim())) {
      toast.error('رقم الهاتف يجب أن يكون 10 أرقام ويبدأ بـ 05 أو 06 أو 07');
      return;
    }

    const validBarbers = barbers.filter(b => b.name.trim() !== '' && b.password.trim() !== '');
    if (validBarbers.length === 0) {
      toast.error('يرجى إضافة حلاق واحد على الأقل مع كلمة المرور');
      return;
    }

    setLoading(true);

    try {
      // Upload logo if exists
      let logoUrl = null;
      if (logoFile) {
        logoUrl = await uploadLogo();
      }

      // Create shop
      const slug = generateSlug(shopName);
      if (!currentUser) throw new Error('User not found');

      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .insert({
          owner_id: currentUser.id,
          slug,
          name: shopName,
          logo_url: logoUrl,
          maps_url: mapsUrl || null,
          phone: shopPhone || null,
          is_open: false,
          is_approved: false,
        })
        .select()
        .single();

      if (shopError) {
        if (shopError.code === '23505') {
          toast.error('اسم الصالون مستخدم بالفعل، يرجى اختيار اسم آخر');
        } else {
          toast.error('فشل إنشاء الصالون');
        }
        setLoading(false);
        return;
      }

      const newShop = shop as Shop;

      // Create barbers
      const tempClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const barbersData = [];
      for (const b of validBarbers) {
        const rawName = b.name.trim();
        const hexName = Array.from(new TextEncoder().encode(rawName))
          .map(x => x.toString(16).padStart(2, '0'))
          .join('');
        const pseudoEmail = `${hexName}@${slug}.com`;

        const { data: authData, error: authError } = await tempClient.auth.signUp({
          email: pseudoEmail,
          password: b.password.trim()
        });

        if (authError || !authData.user) {
          throw authError || new Error(`فشل إنشاء حساب الحلاق: ${rawName}`);
        }

        barbersData.push({
          shop_id: newShop.id,
          name: rawName,
          is_active: true,
          auth_id: authData.user.id
        });
      }

      const { error: barbersError } = await supabase
        .from('barbers')
        .insert(barbersData);

      if (barbersError) {
        toast.error('فشل إضافة الحلاقين لحاعدة البيانات');
        setLoading(false);
        return;
      }

      toast.success('تم إرسال طلبك! انتظر موافقة الإدارة.');
      setPending(true);
    } catch {
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-zinc-400 font-bold mr-1">
          <Store className="w-4 h-4 text-yellow-400" />
          اسم الصالون
        </Label>
        <Input
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          placeholder="مثال: صالون الأناقة"
          className="rounded-2xl h-14 bg-black/50 border-zinc-800 text-white focus-visible:ring-yellow-400 placeholder:text-zinc-600 text-lg"
        />
      </div>

      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-zinc-400 font-bold mr-1">
          <MapPin className="w-4 h-4 text-yellow-400" />
          رابط خرائط Google (اختياري)
        </Label>
        <Input
          value={mapsUrl}
          onChange={(e) => setMapsUrl(e.target.value)}
          placeholder="https://maps.google.com/..."
          className="rounded-2xl h-14 bg-black/50 border-zinc-800 text-white focus-visible:ring-yellow-400 placeholder:text-zinc-600 text-left"
          dir="ltr"
        />
      </div>

      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-zinc-400 font-bold mr-1">
          <Smartphone className="w-4 h-4 text-yellow-400" />
          رقم هاتف المحل (اختياري)
        </Label>
        <Input
          value={shopPhone}
          onChange={(e) => setShopPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="05xxxxxxxx"
          className="rounded-2xl h-14 bg-black/50 border-zinc-800 text-white focus-visible:ring-yellow-400 placeholder:text-zinc-600 text-left"
          dir="ltr"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          pattern="0[567][0-9]{8}"
        />
      </div>

      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-zinc-400 font-bold mr-1">
          <Upload className="w-4 h-4 text-yellow-400" />
          شعار الصالون (اختياري)
        </Label>
        <div className="flex items-center gap-4">
          <label className="flex-1 group">
            <div className="border-2 border-dashed border-zinc-800 rounded-2xl p-8 text-center cursor-pointer hover:border-yellow-400/50 hover:bg-yellow-400/5 transition-all bg-black/50">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="w-24 h-24 object-contain mx-auto rounded-xl" />
              ) : (
                <>
                  <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-yellow-400/10 group-hover:text-yellow-400 transition-colors border border-zinc-800 group-hover:border-yellow-400/20">
                    <Upload className="w-8 h-8 text-zinc-500 group-hover:text-yellow-400 transition-colors" />
                  </div>
                  <span className="text-sm text-zinc-500 font-medium tracking-wide">اضغط لاختيار صورة الشعار</span>
                </>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleLogoChange}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <Button
        onClick={() => setStep(2)}
        className="w-full rounded-2xl h-16 bg-yellow-400 hover:bg-yellow-300 text-black text-xl font-black mt-8 shadow-[0_10px_20px_rgba(250,204,21,0.15)] transition-all hover:scale-[1.02]"
        disabled={!shopName.trim()}
      >
        التالي
        <ChevronLeft className="w-6 h-6 mr-2" />
      </Button>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-zinc-400 font-bold mr-1">
          <Users className="w-4 h-4 text-yellow-400" />
          الحلاقين / الكراسي
        </Label>
        <p className="text-sm text-zinc-500 font-medium mr-1">أضف اسماء الحلاقين العاملين في صالونك</p>
      </div>

      <div className="space-y-4">
        {barbers.map((barber, index) => (
          <div key={index} className="flex gap-3 animate-in slide-in-from-right-2 duration-300" style={{ animationDelay: `${index * 50}ms` }}>
            <Input
              value={barber.name}
              onChange={(e) => updateBarberName(index, e.target.value)}
              placeholder={`اسم الحلاق ${index + 1}`}
              className="rounded-2xl h-14 bg-black/50 border-zinc-800 text-white focus-visible:ring-yellow-400 placeholder:text-zinc-600 flex-1 text-lg w-1/2"
            />
            <Input
              value={barber.password}
              onChange={(e) => updateBarberPassword(index, e.target.value)}
              placeholder="كلمة المرور"
              type="password"
              className="rounded-2xl h-14 bg-black/50 border-zinc-800 text-white focus-visible:ring-yellow-400 placeholder:text-zinc-600 flex-1 text-lg w-1/2"
            />
            {barbers.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeBarberField(index)}
                className="rounded-2xl h-14 w-14 border border-zinc-800 bg-black/50 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 text-zinc-500 transition-all shrink-0"
              >
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        onClick={addBarberField}
        className="w-full rounded-2xl h-14 border-dashed border-2 border-zinc-800 bg-black/20 hover:border-yellow-400/50 hover:bg-yellow-400/5 text-zinc-400 hover:text-yellow-400 transition-all font-bold text-base"
      >
        <Plus className="w-5 h-5 mr-2" />
        إضافة حلاق آخر
      </Button>

      <div className="flex flex-col sm:flex-row gap-4 pt-6">
        <Button
          variant="outline"
          onClick={() => setStep(1)}
          className="flex-1 rounded-2xl h-16 border-zinc-800 bg-black/50 text-zinc-400 hover:text-white hover:bg-zinc-800 text-lg font-bold order-2 sm:order-1"
        >
          الرجوع للسابق
        </Button>
        <Button
          onClick={handleSubmit}
          className="flex-1 rounded-2xl h-16 bg-yellow-400 hover:bg-yellow-300 text-black text-lg font-black shadow-[0_10px_20px_rgba(250,204,21,0.15)] transition-all hover:scale-[1.02] order-1 sm:order-2"
          disabled={loading || barbers.filter(b => b.name.trim() !== '' && b.password.trim() !== '').length === 0}
        >
          {loading ? (
            <div className="flex items-center gap-2">
              <span className="animate-pulse">جاري التجهيز...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              إنشاء الصالون
              <Check className="w-6 h-6 mr-1" />
            </div>
          )}
        </Button>
      </div>
    </div>
  );

  if (pending) {
    return (
      <div className="min-h-[100dvh] bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-24 h-24 rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mx-auto shadow-[0_0_60px_rgba(245,158,11,0.2)]">
            <span className="text-5xl">⏳</span>
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black text-white">طلبك قيد المراجعة</h1>
            <p className="text-zinc-400 text-lg leading-relaxed">
              تم إنشاء حسابك بنجاح. سيتم مراجعة طلبك من قِبل الإدارة وتفعيل صالونك في أقرب وقت.
            </p>
          </div>
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 text-sm text-zinc-500 space-y-2 text-right">
            <p>✅ تم إنشاء الحساب</p>
            <p>✅ تم تسجيل بيانات الصالون</p>
            <p className="text-amber-400">⏳ في انتظار موافقة الإدارة...</p>
          </div>
          <button
            onClick={() => { supabase.auth.signOut(); window.location.href = '/'; }}
            className="text-zinc-600 hover:text-zinc-400 text-sm underline transition-colors"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-black text-white p-4 relative overflow-hidden flex items-center selection:bg-yellow-400/30">
      {/* Background patterns */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400" />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-yellow-400/10 rounded-full blur-[100px] opacity-50" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-yellow-400/5 rounded-full blur-[100px] opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/40 via-transparent to-transparent opacity-50" />
      </div>

      <div className="max-w-xl mx-auto w-full relative z-10 py-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(250,204,21,0.3)] mb-6 animate-in zoom-in duration-500">
            <Scissors className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Barber <span className="text-yellow-400">Ticket</span></h1>
          <p className="text-zinc-500 mt-2 font-medium">ابدأ رحلة صالونك الرقمية الآن</p>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-3 mb-8 px-6">
          <div className="h-1.5 flex-1 rounded-full bg-zinc-900 overflow-hidden">
            <div className={`h-full bg-yellow-400 transition-all duration-700 ${step >= 1 ? 'w-full' : 'w-0'}`} />
          </div>
          <div className="h-1.5 flex-1 rounded-full bg-zinc-900 overflow-hidden">
            <div className={`h-full bg-yellow-400 transition-all duration-700 ${step >= 2 ? 'w-full' : 'w-0'}`} />
          </div>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800/50 rounded-[2.5rem] shadow-2xl overflow-hidden relative animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent" />

          <div className="p-8 sm:p-10">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-black text-white mb-2 tracking-tight">
                {step === 1 ? 'معلومات الصالون' : 'فريق الحلاقين'}
              </h2>
              <p className="text-zinc-500 text-sm font-medium">
                {step === 1 ? 'أدخل التفاصيل الأساسية لإنشاء هويتك الرقمية' : 'أضف الحلاقين الذين سيظهرون لزبائنك في الحجز'}
              </p>
            </div>

            {step === 1 ? renderStep1() : renderStep2()}
          </div>
        </div>

        <p className="text-center text-zinc-600 text-xs mt-10 font-medium">
          خطوة واحدة تفصلك عن نظام إدارة احترافي ✂️
        </p>
      </div>
    </div>
  );
}
