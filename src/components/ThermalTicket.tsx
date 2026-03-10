import { QRCodeSVG } from 'qrcode.react';
import { getCustomerBaseUrl } from '@/lib/utils';

// ✅ FIXED C-4: strip script tags and event handlers from HTML before printing
function sanitizeHtml(html: string): string {
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\son\w+\s*=\s*(["']).*?\1/gi, '')
        .replace(/\son\w+\s*=[^\s>]*/gi, '')
        .replace(/javascript:/gi, 'blocked:');
}



interface ThermalTicketProps {
    ticketNumber: number;
    ticketId: string;
    customerName: string;
    barberName?: string;
    barberIndex?: number;
    shopName: string;
    shopSlug: string;
    peopleCount: number;
    createdAt: Date;
}

export function ThermalTicket({
    ticketNumber,
    ticketId,
    customerName,
    barberName,
    barberIndex,
    shopName,
    shopSlug,
    peopleCount,
    createdAt,
}: ThermalTicketProps) {
    const customerBase = getCustomerBaseUrl();
    const trackingUrl = `${customerBase}/${shopSlug}/ticket/${ticketId}`;
    const code = barberIndex !== undefined && barberIndex >= 0
        ? `${String.fromCharCode(65 + (barberIndex % 26))}${ticketNumber}`
        : `${ticketNumber}`;

    const timeStr = createdAt.toLocaleTimeString('ar-DZ', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    const dateStr = createdAt.toLocaleDateString('ar-DZ', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });

    return (
        <div
            id="thermal-ticket-content"
            style={{
                width: '220px', // Explicit 220px (~58mm) to stop html-to-image clipping
                fontFamily: '"Cairo", "Noto Kufi Arabic", monospace',
                backgroundColor: '#fff',
                color: '#000',
                padding: '16px 12px',
                boxSizing: 'border-box',
                direction: 'rtl',
                textAlign: 'center',
                position: 'relative'
            }}
        >
            {/* Minimal Header */}
            <div style={{ paddingBottom: '3mm', marginBottom: '2mm' }}>
                <div style={{ fontSize: '12pt', fontWeight: '900', letterSpacing: '-0.5px' }}>{shopName}</div>
                <div style={{ fontSize: '6.5pt', color: '#666', marginTop: '1mm', display: 'flex', justifyContent: 'center', gap: '3mm' }}>
                    <span>{dateStr}</span>
                    <span>{timeStr}</span>
                </div>
            </div>

            {/* Separator - subtle */}
            <div style={{ borderTop: '1px solid #eee', width: '80%', margin: '0 auto 3mm auto' }} />

            {/* The Hero Section */}
            <div style={{ margin: '5mm 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '11pt', fontWeight: '700', color: '#111', marginBottom: '3mm' }}>
                    رقم دورك
                </div>

                {/* Massive Number Pill */}
                <div style={{
                    fontSize: '44pt',
                    fontWeight: '900',
                    lineHeight: '1',
                    border: '3px solid #000',
                    borderRadius: '20px',
                    padding: '3mm 8mm',
                    margin: '0 auto',
                    textAlign: 'center',
                    display: 'inline-block',
                    backgroundColor: '#000',
                    color: '#fff',
                    letterSpacing: '-1px'
                }}>
                    {code}
                </div>

                {/* Status Badge right beneath */}
                <div style={{
                    marginTop: '3mm',
                    fontSize: '8.5pt',
                    fontWeight: '700',
                    color: '#444',
                    letterSpacing: '-0.3px',
                }}>
                    في قائمة الانتظار ⏳
                </div>
            </div>

            {/* Sub-hero details */}
            <div style={{
                margin: '4mm 0',
                padding: '2mm 0',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5mm',
                background: '#f9f9f9',
                borderRadius: '8px'
            }}>
                <div style={{ fontSize: '8.5pt', fontWeight: '700', color: '#000' }}>
                    العميل: {customerName}
                </div>
                <div style={{ fontSize: '8.5pt', fontWeight: '700', color: '#000' }}>
                    مع الحلاق: {barberName || 'الكل'}
                </div>
                {peopleCount > 1 && (
                    <div style={{ fontSize: '8pt', fontWeight: '700', color: '#555' }}>
                        عدد الأشخاص: {peopleCount}
                    </div>
                )}
            </div>

            {/* Separator */}
            <div style={{ borderTop: '1px dashed #ccc', margin: '4mm 0' }} />

            {/* QR Code Section */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2mm', marginBottom: '1mm' }}>
                <div style={{ fontSize: '7.5pt', fontWeight: '700', color: '#333' }}>
                    امسح الكود لمتابعة دورك من هاتفك
                </div>
                <div style={{ padding: '2mm', background: '#fff', borderRadius: '4px' }}>
                    <QRCodeSVG
                        value={trackingUrl}
                        size={85}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#000000"
                        style={{ display: 'block' }}
                    />
                </div>
                <div style={{ fontSize: '6pt', color: '#888', wordBreak: 'break-all', textAlign: 'center', direction: 'ltr', maxWidth: '80%' }}>
                    {trackingUrl}
                </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '2mm', fontSize: '6pt', color: '#aaa', fontWeight: '700' }}>
                BARBER TICKET
            </div>
        </div>
    );
}

// Helper: Convert Canvas to ESC/POS Raster Bit-Image (GS v 0)
async function canvasToEscPos(canvas: HTMLCanvasElement): Promise<Uint8Array> {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context for ESC/POS conversion');

    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);

    // ESC/POS raster bit-image command
    const xL = Math.floor((width + 7) / 8) % 256;
    const xH = Math.floor(Math.floor((width + 7) / 8) / 256);
    const yL = height % 256;
    const yH = Math.floor(height / 256);

    // Command prefix (GS v 0 \0 xL xH yL yH)
    const prefix = new Uint8Array([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]);

    const bytesPerLine = Math.floor((width + 7) / 8);
    const imageBytes = new Uint8Array(bytesPerLine * height);

    let k = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < bytesPerLine; x++) {
            let byte = 0;
            for (let b = 0; b < 8; b++) {
                const px = x * 8 + b;
                if (px < width) {
                    const idx = (y * width + px) * 4;
                    const r = imageData.data[idx];
                    const g = imageData.data[idx + 1];
                    const bVal = imageData.data[idx + 2];
                    const a = imageData.data[idx + 3];

                    // Monochrome conversion (if transparent or bright, render white/0, otherwise black/1)
                    if (a > 128) {
                        const luminance = 0.299 * r + 0.587 * g + 0.114 * bVal;
                        if (luminance < 128) {
                            byte |= (1 << (7 - b));
                        }
                    }
                }
            }
            imageBytes[k++] = byte;
        }
    }

    const cutCommand = new Uint8Array([0x1D, 0x56, 0x41, 0x10]); // Cut paper

    const finalBuffer = new Uint8Array(prefix.length + imageBytes.length + cutCommand.length);
    finalBuffer.set(prefix, 0);
    finalBuffer.set(imageBytes, prefix.length);
    finalBuffer.set(cutCommand, prefix.length + imageBytes.length);

    return finalBuffer;
}

// Helper: Send chunked GATT data
async function sendToPrinter(characteristic: BluetoothRemoteGATTCharacteristic, data: Uint8Array) {
    const MTU = 512; // Typical MTU size for cheap thermal printers
    for (let i = 0; i < data.length; i += MTU) {
        const chunk = data.slice(i, i + MTU);
        await characteristic.writeValue(chunk);
    }
}

/* ─── Print function — Web Bluetooth (ESC/POS) logic + Fallback ─── */
export function printThermalTicket(props: ThermalTicketProps) {
    const container = document.createElement('div');
    // Position off-screen so it doesn't flash
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
    document.body.appendChild(container);

    import('react-dom/client').then(async ({ createRoot }) => {
        const root = createRoot(container);
        root.render(<ThermalTicket {...props} />);

        // Wait for React to render
        await new Promise(r => setTimeout(r, 350));

        const ticketEl = container.querySelector('#thermal-ticket-content') as HTMLElement;
        if (!ticketEl) { document.body.removeChild(container); return; }

        let successBluetooth = false;

        // Try Bluetooth Printing First!
        if (navigator.bluetooth) {
            try {
                // We use html2canvas to capture the native rendered Arabic font directly to a canvas
                const { default: html2canvas } = await import('html2canvas');

                const canvas = await html2canvas(ticketEl, {
                    scale: 2, // High resolution
                    backgroundColor: '#ffffff',
                    width: 220, // 58mm equivalent
                    useCORS: true,
                });

                // Request device
                const device = await navigator.bluetooth.requestDevice({
                    acceptAllDevices: true,
                    // Generic attributes for BLE printers
                    optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
                });

                if (device.gatt) {
                    const server = await device.gatt.connect();
                    const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
                    const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

                    const escPosData = await canvasToEscPos(canvas);
                    await sendToPrinter(characteristic, escPosData);

                    device.gatt.disconnect();
                    successBluetooth = true;
                }
            } catch (err) {
                console.warn('Bluetooth Printing Failed/Cancelled, falling back to PDF/Print Dialog', err);
            }
        }

        // ── Fallback logic: standard PDF download / window.print if Bluetooth fails
        if (!successBluetooth) {
            try {
                const { toPng } = await import('html-to-image');
                const { jsPDF } = await import('jspdf');

                const code = props.barberIndex !== undefined && props.barberIndex >= 0
                    ? `${String.fromCharCode(65 + (props.barberIndex % 26))}${props.ticketNumber}`
                    : `${props.ticketNumber}`;

                // We use html-to-image which properly renders Arabic text natively
                const dataUrl = await toPng(ticketEl, {
                    quality: 1,
                    backgroundColor: '#ffffff',
                    pixelRatio: 3, // High-res
                    width: 220, // explicitly enforce the width
                    style: { margin: '0' }
                });

                const pdf = new jsPDF({
                    unit: 'mm',
                    format: [58, 180],
                    orientation: 'portrait'
                });

                pdf.addImage(dataUrl, 'PNG', 0, 0, 58, 180);
                pdf.save(`تذكرة-${code}-${props.customerName}.pdf`);
            } catch (err) {
                console.error('PDF download failed:', err);
            }

            const printWindow = window.open('', '_blank', 'width=250,height=620');
            if (printWindow) {
                const code = props.barberIndex !== undefined && props.barberIndex >= 0
                    ? `${String.fromCharCode(65 + (props.barberIndex % 26))}${props.ticketNumber}`
                    : `${props.ticketNumber}`;

                printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>تذكرة #${code}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: 58mm auto; margin: 0; }
        body { font-family: 'Cairo', monospace; background: #fff; color: #000; width: 58mm; }
        @media print { body { width: 58mm; } }
      </style>
    </head>
    <body>
      ${sanitizeHtml(ticketEl.outerHTML)}
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          }, 800);
        };
      </script>
    </body>
    </html>`);
                printWindow.document.close();
            }
        }

        root.unmount();
        document.body.removeChild(container);
    });
}
