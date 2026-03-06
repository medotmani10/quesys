/**
 * notificationSound.ts
 * Plays a pleasant two-tone "ding" sound using the Web Audio API.
 * No external audio files needed — works in all modern browsers.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume if suspended (browser policy: needs user interaction first)
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

/**
 * Plays a short "new ticket" notification chime.
 * Two successive tones for a clear, pleasant alert.
 */
export function playTicketSound() {
    try {
        const ctx = getAudioContext();
        const now = ctx.currentTime;

        const tones = [
            { freq: 880, start: now, end: now + 0.18 },   // high A5
            { freq: 1100, start: now + 0.2, end: now + 0.38 },  // C#6
        ];

        tones.forEach(({ freq, start, end }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.55, start + 0.02);  // quick attack
            gain.gain.linearRampToValueAtTime(0, end);              // smooth decay

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(start);
            osc.stop(end);
        });
    } catch (e) {
        // Graceful fallback — audio is non-critical
        console.warn('[NotificationSound] Could not play sound:', e);
    }
}
