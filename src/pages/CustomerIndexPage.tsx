import { Navigate } from 'react-router-dom';
import { QrCode, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CustomerIndexPage() {
    const lastShopSlug = localStorage.getItem('last_shop_slug');

    if (lastShopSlug) {
        return <Navigate to={`/${lastShopSlug}`} replace />;
    }

    return (
        <div className="min-h-[100dvh] bg-black p-4 flex items-center justify-center text-center" dir="rtl">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-sm w-full space-y-6">
                <div className="w-20 h-20 bg-yellow-400 rounded-2xl flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(250,204,21,0.2)]">
                    <Scissors className="w-10 h-10 text-black" />
                </div>

                <div className="space-y-3">
                    <h1 className="text-2xl font-black text-white">مرحباً بك!</h1>
                    <p className="text-zinc-400 text-sm leading-relaxed">
                        للانضمام إلى طابور الحلاقة، يرجى مسح رمز QR (الباركود) المتوفر في الصالون الذي ترغب بزيارته.
                    </p>
                </div>

                <div className="bg-black/50 border border-zinc-800 rounded-2xl p-6">
                    <QrCode className="w-16 h-16 text-yellow-400 mx-auto mb-4 opacity-50" />
                    <p className="text-xs text-zinc-500 font-bold">
                        قم بفتح كاميرا هاتفك وامسح الرمز الموجود في الصالون
                    </p>
                </div>

                <Button
                    onClick={() => window.location.href = '/'}
                    variant="outline"
                    className="w-full rounded-xl border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800"
                >
                    تحديث الصفحة
                </Button>
            </div>
        </div>
    );
}
