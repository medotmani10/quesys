import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Scissors, Clock, Users, Shield, ChevronLeft, Sparkles, BarChart3, Smartphone, Navigation } from 'lucide-react';
import { toast } from 'sonner';

export default function LandingPage() {
  const navigate = useNavigate();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkShopExists(session.user.id);
      }
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    if (session?.user) {
      checkShopExists(session.user.id);
    }
  };

  const checkShopExists = async (userId: string) => {
    const { data: shop } = await supabase
      .from('shops')
      .select('slug')
      .eq('owner_id', userId)
      .single();

    if (shop) {
      navigate('/admin');
    } else {
      navigate('/onboarding');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message === 'Email not confirmed') {
        // إعادة إرسال بريد التأكيد تلقائياً
        await supabase.auth.resend({ type: 'signup', email });
        toast.error('البريد الإلكتروني غير مؤكد. تم إرسال رابط التأكيد إلى بريدك، يرجى التحقق منه ثم تسجيل الدخول مجدداً.');
      } else if (error.message === 'Invalid login credentials') {
        toast.error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('تم تسجيل الدخول بنجاح');
      setIsLoginOpen(false);
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('تم إنشاء الحساب بنجاح');
      setIsSignUpOpen(false);
    }
    setLoading(false);
  };

  const features = [
    {
      icon: <Clock className="w-6 h-6 text-amber-500" />,
      title: 'توفير الوقت',
      description: 'نظام ذكي لإدارة الانتظار يقلل من وقت الانتظار لعملائك بطريقة عصرية'
    },
    {
      icon: <Users className="w-6 h-6 text-amber-500" />,
      title: 'تنظيم راقٍ',
      description: 'إدارة فعالة وحصرية للحلاقين والكراسي مع توزيع ذكي للعملاء'
    },
    {
      icon: <Smartphone className="w-6 h-6 text-amber-500" />,
      title: 'تجربة سلسة',
      description: 'واجهة بسيطة وبديهية مصممة خصيصاً للهواتف المحمولة بلمسة VIP'
    },
    {
      icon: <BarChart3 className="w-6 h-6 text-amber-500" />,
      title: 'إحصائيات دقيقة',
      description: 'تتبع أداء صالونك مع تقارير مفصلة عن العملاء والإيرادات'
    },
    {
      icon: <Shield className="w-6 h-6 text-amber-500" />,
      title: 'أمان وموثوقية',
      description: 'حماية كاملة لبياناتك مع نظام مصادقة متقدم بأعلى المعايير'
    },
    {
      icon: <Navigation className="w-6 h-6 text-amber-500" />,
      title: 'تواصل فوري',
      description: 'تحديثات مباشرة للعملاء حول حالتهم في قائمة الانتظار بأناقة'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-amber-500/30">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-slate-950/60 backdrop-blur-xl border-b border-white/5 transition-all duration-300">
        <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center shadow-glow">
              <Scissors className="w-6 h-6 text-slate-950" />
            </div>
            <span className="font-bold text-2xl tracking-tight text-white">Barber<span className="text-amber-500">Queue</span></span>
          </div>

          {user ? (
            <Button
              variant="outline"
              onClick={() => supabase.auth.signOut()}
              className="rounded-xl border-white/10 hover:bg-white/5 text-slate-300"
            >
              تسجيل الخروج
            </Button>
          ) : (
            <div className="flex gap-3">
              <Sheet open={isLoginOpen} onOpenChange={setIsLoginOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" className="rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-medium">تسجيل الدخول</Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-[2rem] bg-slate-900 border-white/10 h-auto max-h-[90vh]">
                  <SheetHeader className="pb-6 pt-2">
                    <SheetTitle className="text-center text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-amber-500">مرحباً بعودتك</SheetTitle>
                  </SheetHeader>
                  <form onSubmit={handleLogin} className="space-y-5 p-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">البريد الإلكتروني</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vip@barbershop.com"
                        className="rounded-xl h-14 bg-slate-950 border-white/10 focus-visible:ring-amber-500 text-white placeholder:text-slate-600"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">كلمة المرور</Label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="rounded-xl h-14 bg-slate-950 border-white/10 focus-visible:ring-amber-500 text-white"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full rounded-xl h-14 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-lg shadow-glow transition-all"
                      disabled={loading}
                    >
                      {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
                    </Button>
                  </form>
                </SheetContent>
              </Sheet>

              <Sheet open={isSignUpOpen} onOpenChange={setIsSignUpOpen}>
                <SheetTrigger asChild>
                  <Button className="rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-glow border-none hidden sm:flex">إنشاء حساب</Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-[2rem] bg-slate-900 border-white/10 h-auto max-h-[90vh]">
                  <SheetHeader className="pb-6 pt-2">
                    <SheetTitle className="text-center text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-amber-500">حساب صالون جديد</SheetTitle>
                  </SheetHeader>
                  <form onSubmit={handleSignUp} className="space-y-5 p-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">البريد الإلكتروني</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vip@barbershop.com"
                        className="rounded-xl h-14 bg-slate-950 border-white/10 focus-visible:ring-amber-500 text-white placeholder:text-slate-600"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">كلمة المرور</Label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="rounded-xl h-14 bg-slate-950 border-white/10 focus-visible:ring-amber-500 text-white"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full rounded-xl h-14 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-lg shadow-glow transition-all"
                      disabled={loading}
                    >
                      {loading ? 'جاري التجهيز...' : 'افتح صالونك الرقمي'}
                    </Button>
                  </form>
                </SheetContent>
              </Sheet>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden pt-20">
        {/* Background Image & Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="/hero-bg.png"
            alt="Premium Barbershop Interior"
            className="w-full h-full object-cover object-center opacity-40 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/60 to-transparent" />
        </div>

        <div className="max-w-6xl mx-auto px-4 relative z-10 w-full">
          <div className="max-w-2xl space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-500 text-sm font-semibold backdrop-blur-md animate-float">
              <Sparkles className="w-4 h-4" />
              <span>مستقبل إدارة الصالونات</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-[1.1]">
              نظم صالونك<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-600">
                بفخامة وذكاء
              </span>
            </h1>

            <p className="text-xl text-slate-300 leading-relaxed font-light max-w-xl">
              منصة حصرية لإدارة قوائم الانتظار في صالونات الحلاقة الراقية.
              ارتقِ بتجربة عملائك لتليق بمستوى خدماتك.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <Sheet open={isSignUpOpen} onOpenChange={setIsSignUpOpen}>
                <SheetTrigger asChild>
                  <Button size="lg" className="rounded-2xl h-16 px-10 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xl font-bold shadow-glow-lg transition-all hover:scale-105">
                    ابدأ تجربتك المجانية
                    <ChevronLeft className="w-6 h-6 mr-2" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-[2rem] bg-slate-900 border-white/10 h-auto max-h-[90vh]">
                  <SheetHeader className="pb-6">
                    <SheetTitle className="text-center text-3xl font-bold text-amber-500">بداية الفخامة</SheetTitle>
                  </SheetHeader>
                  <form onSubmit={handleSignUp} className="space-y-5 p-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">البريد الإلكتروني</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="vip@barbershop.com"
                        className="rounded-xl h-14 bg-slate-950 border-white/10 focus-visible:ring-amber-500 text-white"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">كلمة المرور</Label>
                      <Input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="rounded-xl h-14 bg-slate-950 border-white/10 focus-visible:ring-amber-500 text-white"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full rounded-xl h-14 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-lg shadow-glow"
                      disabled={loading}
                    >
                      {loading ? 'جاري التجهيز...' : 'افتح صالونك الرقمي'}
                    </Button>
                  </form>
                </SheetContent>
              </Sheet>
              <Button
                variant="outline"
                size="lg"
                className="rounded-2xl h-16 px-8 text-xl border-white/20 text-white bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-white/30"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                اكتشف المزايا
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-slate-950 relative">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              لماذا تختار <span className="text-amber-500">BarberQueue</span>؟
            </h2>
            <p className="text-slate-400 text-xl max-w-2xl mx-auto font-light">
              صُمم ليلبي احتياجات صالونات الحلاقة العصرية التي تبحث عن التميز
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-8 bg-slate-900/50 backdrop-blur-xl rounded-[2rem] hover:bg-slate-900 transition-all duration-500 border border-white/5 hover:border-amber-500/30 hover:shadow-glow"
              >
                <div className="w-16 h-16 bg-slate-950 rounded-2xl shadow-inner border border-white/5 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-amber-500/10 transition-all duration-500">
                  {feature.icon}
                </div>
                <h3 className="font-bold text-2xl text-white mb-3">{feature.title}</h3>
                <p className="text-slate-400 text-base leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-slate-900 to-slate-950 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-500/10 rounded-full mb-8 shadow-glow">
            <Scissors className="w-10 h-10 text-amber-500" />
          </div>
          <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">
            ارتقِ بمستوى صالونك <span className="text-amber-500">الآن</span>
          </h2>
          <p className="text-slate-400 text-xl mx-auto mb-10 font-light">
            انضم إلى النخبة من أصحاب الصالونات الذين يقدمون تجربة حجز لا تُنسى لعملائهم.
          </p>
          <Sheet open={isSignUpOpen} onOpenChange={setIsSignUpOpen}>
            <SheetTrigger asChild>
              <Button
                size="lg"
                className="rounded-2xl h-16 px-10 text-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-600 shadow-glow-lg transition-transform hover:scale-105"
              >
                احجز مكانك في المستقبل
                <ChevronLeft className="w-6 h-6 mr-2" />
              </Button>
            </SheetTrigger>
          </Sheet>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-950 border-t border-white/5 text-slate-500 text-center">
        <div className="max-w-6xl mx-auto px-4 flex flex-col items-center justify-center gap-4">
          <div className="flex items-center gap-2 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
            <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
              <Scissors className="w-4 h-4 text-slate-950" />
            </div>
            <span className="font-bold text-lg text-white">BarberQueue</span>
          </div>
          <p className="text-sm">© 2024 BarberQueue Premium. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </div>
  );
}
