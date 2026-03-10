import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    readonly platforms: Array<string>;
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

export default function CustomerInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Detect iOS
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
        requestAnimationFrame(() => {
            setIsIOS(iOS);
        });

        // Stop if already installed
        if (window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone)) {
            return;
        }

        // Capture Android install prompt
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            // Wait a bit before showing to not overwhelm the user
            setTimeout(() => setShowPrompt(true), 3000);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Automatically show iOS prompt instructions after a delay if not installed
        if (iOS) {
            setTimeout(() => setShowPrompt(true), 3000);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setShowPrompt(false);
            }
            setDeferredPrompt(null);
        }
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-50 bg-zinc-900 border border-yellow-400/30 rounded-2xl p-4 shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom-5">
            <div className="flex-1 mr-3">
                <h3 className="text-white font-bold text-sm mb-1">حمّل تطبيق دورك</h3>
                {isIOS ? (
                    <p className="text-zinc-400 text-xs flex items-center gap-1">
                        اضغط <Share className="w-3 h-3" /> ثم "إضافة للشاشة الرئيسية" لتتبع دورك بسهولة
                    </p>
                ) : (
                    <p className="text-zinc-400 text-xs">
                        أضف التطبيق لشاشتك الرئيسية لتتبع تذكرتك بسرعة
                    </p>
                )}
            </div>

            {!isIOS && (
                <Button
                    onClick={handleInstallClick}
                    className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold h-9 rounded-xl px-4 ml-2"
                >
                    <Download className="w-4 h-4 ml-1" />
                    تثبيت
                </Button>
            )}

            <button
                onClick={() => setShowPrompt(false)}
                className="text-zinc-500 hover:text-white p-1"
            >
                <X className="w-5 h-5" />
            </button>
        </div>
    );
}
