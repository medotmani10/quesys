export async function getDeviceFingerprint(): Promise<string> {
    // Collect stable device characteristics
    const components = [
        navigator.userAgent,
        navigator.language,
        window.screen.width,
        window.screen.height,
        window.screen.colorDepth,
        new Date().getTimezoneOffset(),
        navigator.hardwareConcurrency || 'unknown',
        (navigator as any).deviceMemory || 'unknown',
        // Some simple canvas fingerprinting for hardware stability
        getCanvasFingerprint()
    ];

    const rawId = components.join('|');
    return await hashString(rawId);
}

function getCanvasFingerprint(): string {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';
        // Text with various styles and a specific font
        ctx.textBaseline = 'top';
        ctx.font = '14px "Arial"';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('BarberTicket', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('BarberTicket', 4, 17);
        return canvas.toDataURL();
    } catch {
        return 'no-canvas';
    }
}

async function hashString(str: string): Promise<string> {
    // Use Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
