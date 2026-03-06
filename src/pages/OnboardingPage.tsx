import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Shop } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, X, Upload, Store, MapPin, Users, ChevronLeft, Check, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [shopName, setShopName] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [barbers, setBarbers] = useState<string[]>(['']);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

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
    setBarbers([...barbers, '']);
  };

  const removeBarberField = (index: number) => {
    if (barbers.length > 1) {
      setBarbers(barbers.filter((_, i) => i !== index));
    }
  };

  const updateBarber = (index: number, value: string) => {
    const newBarbers = [...barbers];
    newBarbers[index] = value;
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

    const validBarbers = barbers.filter(b => b.trim() !== '');
    if (validBarbers.length === 0) {
      toast.error('يرجى إضافة حلاق واحد على الأقل');
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
      const { data: shop, error: shopError } = await supabase
        .from('shops')
        .insert({
          owner_id: currentUser.id,
          slug,
          name: shopName,
          logo_url: logoUrl,
          maps_url: mapsUrl || null,
          phone: shopPhone || null,
          is_open: true,
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
      const barbersData = validBarbers.map(name => ({
        shop_id: newShop.id,
        name: name.trim(),
        is_active: true,
      }));

      const { error: barbersError } = await supabase
        .from('barbers')
        .insert(barbersData);

      if (barbersError) {
        toast.error('فشل إضافة الحلاقين');
        setLoading(false);
        return;
      }

      toast.success('تم إنشاء الصالون بنجاح!');
      navigate('/admin');
    } catch (error) {
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-slate-300">
          <Store className="w-4 h-4 text-amber-500" />
          اسم الصالون
        </Label>
        <Input
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          placeholder="مثال: صالون الأناقة"
          className="rounded-2xl h-14 bg-slate-950 border-white/5 text-white focus-visible:ring-amber-500 placeholder:text-slate-600 text-lg"
        />
      </div>

      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-slate-300">
          <MapPin className="w-4 h-4 text-amber-500" />
          رابط خرائط Google (اختياري)
        </Label>
        <Input
          value={mapsUrl}
          onChange={(e) => setMapsUrl(e.target.value)}
          placeholder="https://maps.google.com/..."
          className="rounded-2xl h-14 bg-slate-950 border-white/5 text-white focus-visible:ring-amber-500 placeholder:text-slate-600 text-left"
          dir="ltr"
        />
      </div>

      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-slate-300">
          <Smartphone className="w-4 h-4 text-amber-500" />
          رقم هاتف المحل (اختياري)
        </Label>
        <Input
          value={shopPhone}
          onChange={(e) => setShopPhone(e.target.value)}
          placeholder="05xxxxxxxx"
          className="rounded-2xl h-14 bg-slate-950 border-white/5 text-white focus-visible:ring-amber-500 placeholder:text-slate-600 text-left"
          dir="ltr"
          type="tel"
        />
      </div>

      <div className="space-y-3">
        <Label className="flex items-center gap-2 text-slate-300">
          <Upload className="w-4 h-4 text-amber-500" />
          شعار الصالون (اختياري)
        </Label>
        <div className="flex items-center gap-4">
          <label className="flex-1 group">
            <div className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/5 transition-all bg-slate-950/50">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="w-24 h-24 object-contain mx-auto rounded-xl" />
              ) : (
                <>
                  <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-amber-500/10 group-hover:text-amber-500 transition-colors border border-white/5 group-hover:border-amber-500/20">
                    <Upload className="w-8 h-8 text-slate-500 group-hover:text-amber-500 transition-colors" />
                  </div>
                  <span className="text-sm text-slate-400 font-medium tracking-wide">اضغط لاختيار صورة الشعار</span>
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
        className="w-full rounded-2xl h-16 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xl font-bold mt-8 shadow-glow transition-all hover:scale-[1.02]"
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
        <Label className="flex items-center gap-2 text-slate-300">
          <Users className="w-4 h-4 text-amber-500" />
          الحلاقين / الكراسي
        </Label>
        <p className="text-sm text-slate-400">أضف اسماء الحلاقين العاملين في صالونك</p>
      </div>

      <div className="space-y-4">
        {barbers.map((barber, index) => (
          <div key={index} className="flex gap-3">
            <Input
              value={barber}
              onChange={(e) => updateBarber(index, e.target.value)}
              placeholder={`الحلاق ${index + 1}`}
              className="rounded-2xl h-14 bg-slate-950 border-white/5 text-white focus-visible:ring-amber-500 placeholder:text-slate-600 flex-1 text-lg"
            />
            {barbers.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeBarberField(index)}
                className="rounded-2xl h-14 w-14 border border-white/5 bg-slate-950 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 text-slate-500 transition-all"
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
        className="w-full rounded-2xl h-14 border-dashed border-2 border-white/10 hover:border-amber-500 hover:bg-amber-500/5 text-slate-300 hover:text-amber-500 transition-colors font-medium text-base"
      >
        <Plus className="w-5 h-5 mr-2" />
        إضافة حلاق آخر
      </Button>

      <div className="flex gap-4 pt-6">
        <Button
          variant="outline"
          onClick={() => setStep(1)}
          className="flex-1 rounded-2xl h-16 border-white/10 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 text-lg"
        >
          الرجوع للسابق
        </Button>
        <Button
          onClick={handleSubmit}
          className="flex-1 rounded-2xl h-16 bg-amber-500 hover:bg-amber-600 text-slate-950 text-lg font-bold shadow-glow transition-all hover:scale-[1.02]"
          disabled={loading || barbers.filter(b => b.trim() !== '').length === 0}
        >
          {loading ? (
            'جاري التجهيز...'
          ) : (
            <>
              إنشاء الصالون
              <Check className="w-6 h-6 mr-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-slate-950 p-4 relative overflow-hidden flex items-center">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay pointer-events-none"></div>

      <div className="max-w-xl mx-auto w-full relative z-10 py-10">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-10 px-6">
          <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= 1 ? 'bg-amber-500 shadow-glow' : 'bg-slate-800'}`} />
          <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= 2 ? 'bg-amber-500 shadow-glow' : 'bg-slate-800'}`} />
        </div>

        <Card className="rounded-[2.5rem] shadow-2xl border border-white/5 bg-slate-900/80 backdrop-blur-xl overflow-hidden relative">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
          <CardContent className="p-10">
            <div className="text-center mb-10">
              <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-glow border border-amber-300/20 transform hover:scale-105 transition-transform duration-300">
                {step === 1 ? <Store className="w-10 h-10 text-slate-950" /> : <Users className="w-10 h-10 text-slate-950" />}
              </div>
              <h1 className="text-3xl font-black text-white mb-3 tracking-wide">
                {step === 1 ? 'إعداد صالونك' : 'فريق الحلاقين'}
              </h1>
              <p className="text-slate-400 font-medium">
                {step === 1 ? 'أدخل معلومات صالونك للبدء' : 'أضف الحلاقين العاملين في صالونك'}
              </p>
            </div>

            {step === 1 ? renderStep1() : renderStep2()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
