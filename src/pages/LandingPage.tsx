import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Scissors, Clock, Users, Shield, ChevronLeft, Smartphone, Navigation, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

function useCountUp(end: number, duration: number, start: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [end, duration, start]);
  return count;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkUser();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) checkShopExists(session.user.id);
    });

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsVisible(true); },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);

    return () => {
      authListener.subscription.unsubscribe();
      observer.disconnect();
    };
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    if (session?.user) checkShopExists(session.user.id);
  };

  const checkShopExists = async (userId: string) => {
    const { data: shop } = await supabase.from('shops').select('slug').eq('owner_id', userId).single();
    if (shop) navigate('/admin');
    else navigate('/onboarding');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message === 'Email not confirmed') {
        await supabase.auth.resend({ type: 'signup', email });
        toast.error('البريد غير مؤكد. تم إرسال رابط التأكيد.');
      } else if (error.message === 'Invalid login credentials') {
        toast.error('البريد أو كلمة المرور غير صحيحة');
      } else toast.error(error.message);
    } else {
      toast.success('تم تسجيل الدخول');
      setIsLoginOpen(false);
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) toast.error(error.message);
    else { toast.success('تم إنشاء الحساب بنجاح'); setIsSignUpOpen(false); }
    setLoading(false);
  };

  const stat1 = useCountUp(500, 2000, statsVisible);
  const stat2 = useCountUp(98, 1800, statsVisible);
  const stat3 = useCountUp(30, 1500, statsVisible);

  const features = [
    {
      icon: <Clock className="w-7 h-7 text-yellow-400" />,
      title: 'لا انتظار بلا هدف',
      description: 'زبونك يعرف دوره بالضبط قبل ما يغادر البيت. لا طوابير، لا إحراج.'
    },
    {
      icon: <Users className="w-7 h-7 text-yellow-400" />,
      title: 'تحكم كامل بالفريق',
      description: 'وزع الزبائن على الحلاقين بذكاء. كل واحد يعمل، ما أحد يتفرج.'
    },
    {
      icon: <Smartphone className="w-7 h-7 text-yellow-400" />,
      title: 'كل شيء من الهاتف',
      description: 'الزبون يحجز من هاتفه ويتتبع دوره بدون تطبيق. رابط واحد يكفي.'
    },
    {
      icon: <Shield className="w-7 h-7 text-yellow-400" />,
      title: 'بياناتك محفوظة',
      description: 'كل شيء مشفر وآمن. معلومات صالونك وزبائنك محمية 24/7.'
    },
    {
      icon: <Navigation className="w-7 h-7 text-yellow-400" />,
      title: 'زبائنك يلقونك',
      description: 'أضف موقع الصالون وزبائنك يوصلون بسهولة. لا أعذار بعد اليوم.'
    },
    {
      icon: <CheckCircle className="w-7 h-7 text-yellow-400" />,
      title: 'ابدأ اليوم مجاناً',
      description: 'سجل ودشن صالونك في دقيقتين. ما تحتاج بطاقة بنكية.'
    },
  ];

  const LoginForm = ({ hideSheet }: { hideSheet?: boolean }) => (
    <form onSubmit={handleLogin} className="space-y-5 p-4">
      <div className="space-y-2">
        <Label className="text-zinc-300">البريد الإلكتروني</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@barbershop.com"
          className="rounded-xl h-14 bg-zinc-950 border-zinc-700 focus-visible:ring-yellow-400 text-white placeholder:text-zinc-600" required />
      </div>
      <div className="space-y-2">
        <Label className="text-zinc-300">كلمة المرور</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="rounded-xl h-14 bg-zinc-950 border-zinc-700 focus-visible:ring-yellow-400 text-white" required />
      </div>
      <Button type="submit"
        className="w-full rounded-xl h-14 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-lg transition-all"
        disabled={loading}>
        {loading ? 'جاري التحقق...' : 'دخول'}
      </Button>
      {!hideSheet && (
        <div className="text-center pt-2">
          <button type="button" onClick={() => { setIsLoginOpen(false); setTimeout(() => setIsSignUpOpen(true), 300); }}
            className="text-zinc-500 hover:text-yellow-400 text-sm transition-colors">
            ليس لديك حساب؟ <span className="text-yellow-400 font-bold">سجل الآن</span>
          </button>
        </div>
      )}
    </form>
  );

  const SignUpForm = ({ hideSheet }: { hideSheet?: boolean }) => (
    <form onSubmit={handleSignUp} className="space-y-5 p-4">
      <div className="space-y-2">
        <Label className="text-zinc-300">البريد الإلكتروني</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@barbershop.com"
          className="rounded-xl h-14 bg-zinc-950 border-zinc-700 focus-visible:ring-yellow-400 text-white placeholder:text-zinc-600" required />
      </div>
      <div className="space-y-2">
        <Label className="text-zinc-300">كلمة المرور</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="rounded-xl h-14 bg-zinc-950 border-zinc-700 focus-visible:ring-yellow-400 text-white" required />
      </div>
      <Button type="submit"
        className="w-full rounded-xl h-14 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-lg transition-all"
        disabled={loading}>
        {loading ? 'جاري التجهيز...' : 'ابدأ مجاناً'}
      </Button>
      {!hideSheet && (
        <div className="text-center pt-2">
          <button type="button" onClick={() => { setIsSignUpOpen(false); setTimeout(() => setIsLoginOpen(true), 300); }}
            className="text-zinc-500 hover:text-yellow-400 text-sm transition-colors">
            لديك حساب؟ <span className="text-yellow-400 font-bold">سجل الدخول</span>
          </button>
        </div>
      )}
    </form>
  );

  return (
    <div className="min-h-screen bg-black text-white selection:bg-yellow-400/30 font-sans">

      {/* ─── HEADER ─── */}
      <header className="fixed top-0 w-full z-50 bg-black/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 h-auto min-h-[4.5rem] py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center">
              <Scissors className="w-5 h-5 text-black" />
            </div>
            <span className="font-black text-xl tracking-tight text-white">Barber<span className="text-yellow-400">Queue</span></span>
          </div>

          {user ? (
            <Button variant="outline" onClick={() => supabase.auth.signOut()}
              className="rounded-xl border-zinc-700 hover:bg-white/5 text-zinc-300">
              تسجيل الخروج
            </Button>
          ) : (
            <div className="flex gap-2">
              <Sheet open={isLoginOpen} onOpenChange={setIsLoginOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" className="rounded-xl text-zinc-300 hover:text-white hover:bg-white/5">تسجيل الدخول</Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-[2rem] bg-zinc-900 border-zinc-700 h-auto max-h-[90vh]">
                  <SheetHeader className="pb-4 pt-2">
                    <SheetTitle className="text-center text-2xl font-black text-white">مرحباً بعودتك ✂️</SheetTitle>
                  </SheetHeader>
                  <LoginForm />
                </SheetContent>
              </Sheet>

              <Sheet open={isSignUpOpen} onOpenChange={setIsSignUpOpen}>
                <SheetTrigger asChild>
                  <Button className="rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-black border-none hidden sm:flex">إنشاء حساب</Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-[2rem] bg-zinc-900 border-zinc-700 h-auto max-h-[90vh]">
                  <SheetHeader className="pb-4 pt-2">
                    <SheetTitle className="text-center text-2xl font-black text-white">دشن صالونك الآن ✂️</SheetTitle>
                  </SheetHeader>
                  <SignUpForm />
                </SheetContent>
              </Sheet>
            </div>
          )}
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <img src="/hero-bg.png" alt="Barbershop" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60" />
        </div>

        {/* Yellow side stripe */}
        <div className="absolute right-0 top-0 w-1 h-full bg-yellow-400 z-10" />

        <div className="max-w-6xl mx-auto px-4 pt-24 pb-12 relative z-10 w-full">
          <div className="max-w-2xl space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/30 rounded-full px-4 py-2 text-yellow-400 text-sm font-bold">
              <Scissors className="w-4 h-4" />
              BarberQueue — الحل الرقمي لصالونات الحلاقة
            </div>

            <h1 className="text-5xl md:text-7xl font-black leading-[1] tracking-tight">
              ادر صالونك<br />
              <span className="text-yellow-400">بدون فوضى.</span>
            </h1>

            <p className="text-lg md:text-xl text-zinc-300 leading-relaxed max-w-lg border-r-2 border-yellow-400 pr-5">
              نظام رقمي لقوائم الانتظار — زبائنك يعرفون دورهم من هواتفهم، وأنت تتحكم في كل شيء من لوحة واحدة.
            </p>

            {/* Stats inline */}
            <div className="flex gap-8 pt-2">
              {[
                { label: 'صالون يستخدم المنصة', value: '+500' },
                { label: 'رضا أصحاب الصالونات', value: '98%' },
                { label: 'دقيقة للتسجيل', value: '< 2' },
              ].map((s, i) => (
                <div key={i}>
                  <div className="text-2xl font-black text-yellow-400">{s.value}</div>
                  <div className="text-xs text-zinc-400 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Sheet open={isSignUpOpen} onOpenChange={setIsSignUpOpen}>
                <SheetTrigger asChild>
                  <Button size="lg" className="rounded-xl h-14 px-8 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-lg transition-all hover:scale-105">
                    ابدأ مجاناً الآن
                    <ChevronLeft className="w-5 h-5 mr-1" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-[2rem] bg-zinc-900 border-zinc-700 h-auto max-h-[90vh]">
                  <SheetHeader className="pb-4 pt-2">
                    <SheetTitle className="text-center text-2xl font-black text-white">دشن صالونك الآن ✂️</SheetTitle>
                  </SheetHeader>
                  <SignUpForm />
                </SheetContent>
              </Sheet>

              <Button variant="outline" size="lg"
                className="rounded-xl h-14 px-8 text-lg border-zinc-600 text-zinc-200 bg-white/5 hover:bg-white/10 hover:border-zinc-400 transition-all"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
                شوف كيف يشتغل
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── IMAGE / SOCIAL PROOF BAND ─── */}
      <section className="relative overflow-hidden border-y border-zinc-800">
        <img src="/queue-bg.png" alt="Barbershop waiting area" className="w-full h-72 md:h-96 object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/70 flex items-end">
          <div className="max-w-6xl mx-auto px-4 pb-10 w-full">
            <div ref={statsRef} className="grid grid-cols-3 gap-6 max-w-3xl">
              {[
                { num: stat1, suffix: '+', label: 'صالون نشط' },
                { num: stat2, suffix: '%', label: 'رضا المستخدمين' },
                { num: stat3, suffix: 'ث', label: 'متوسط الاستجابة' },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <div className="text-4xl md:text-5xl font-black text-yellow-400">
                    {s.num}{s.suffix}
                  </div>
                  <div className="text-sm text-zinc-300 mt-2 font-medium">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-20 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4">
          <div className="mb-12">
            <p className="text-yellow-400 font-bold tracking-widest uppercase text-sm mb-3">كيف يشتغل</p>
            <h2 className="text-4xl md:text-5xl font-black text-white">3 خطوات <span className="text-yellow-400">بس</span></h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'سجل صالونك', desc: 'أنشئ حساب مجاني وأضف اسم الصالون وحلاقيك في أقل من دقيقتين.' },
              { step: '02', title: 'شارك الرابط', desc: 'كل صالون يملك رابط خاص. ارسله لزبائنك أو حطه في نبذتك.' },
              { step: '03', title: 'تحكم من لوحتك', desc: 'شوف الطابور، اقبل الزبائن، غير الحالة — كل شيء من الشاشة.' },
            ].map((item, i) => (
              <div key={i} className="relative group">
                <div className="p-8 border border-zinc-800 rounded-2xl hover:border-yellow-400/50 transition-all duration-300 hover:bg-zinc-900 h-full">
                  <div className="text-6xl font-black text-zinc-800 group-hover:text-yellow-400/20 transition-colors select-none mb-4">{item.step}</div>
                  <h3 className="text-xl font-black text-white mb-3">{item.title}</h3>
                  <p className="text-zinc-400 leading-relaxed">{item.desc}</p>
                </div>
                {i < 2 && <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-yellow-400 z-10" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="py-20 bg-black">
        <div className="max-w-6xl mx-auto px-4">
          <div className="mb-12">
            <p className="text-yellow-400 font-bold tracking-widest uppercase text-sm mb-3">المزايا</p>
            <h2 className="text-4xl md:text-5xl font-black text-white">كل اللي تحتاجه<br /><span className="text-yellow-400">في مكان واحد</span></h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <div key={i} className="group p-7 bg-zinc-950 border border-zinc-800 rounded-2xl hover:border-yellow-400/40 hover:bg-zinc-900 transition-all duration-300 cursor-default">
                <div className="w-14 h-14 bg-yellow-400/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-yellow-400/20 group-hover:scale-110 transition-all duration-300">
                  {feature.icon}
                </div>
                <h3 className="font-black text-xl text-white mb-3 group-hover:text-yellow-400 transition-colors">{feature.title}</h3>
                <p className="text-zinc-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA FINAL ─── */}
      <section className="py-20 bg-yellow-400">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-6xl font-black text-black mb-4">
            صالونك يستاهل أكثر.
          </h2>
          <p className="text-black/70 text-xl mb-10 max-w-2xl mx-auto font-medium">
            سجل الآن مجاناً ودشن نظامك في دقيقتين. بدون بطاقة بنكية، بدون تعقيد.
          </p>

          <Sheet open={isSignUpOpen} onOpenChange={setIsSignUpOpen}>
            <SheetTrigger asChild>
              <Button size="lg"
                className="rounded-xl h-16 px-12 text-xl bg-black text-yellow-400 font-black hover:bg-zinc-900 transition-all hover:scale-105 border-2 border-black">
                ابدأ الآن — مجاناً 100%
                <ChevronLeft className="w-5 h-5 mr-2" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-[2rem] bg-zinc-900 border-zinc-700 h-auto max-h-[90vh]">
              <SheetHeader className="pb-4 pt-2">
                <SheetTitle className="text-center text-2xl font-black text-white">دشن صالونك الآن ✂️</SheetTitle>
              </SheetHeader>
              <SignUpForm hideSheet />
            </SheetContent>
          </Sheet>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="py-10 bg-black border-t border-zinc-900 text-center text-zinc-600">
        <div className="max-w-6xl mx-auto px-4 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-yellow-400 rounded-lg flex items-center justify-center">
              <Scissors className="w-4 h-4 text-black" />
            </div>
            <span className="font-black text-white text-lg">BarberQueue</span>
          </div>
          <p className="text-sm">© 2024 BarberQueue. جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </div>
  );
}
