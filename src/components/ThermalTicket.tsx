import { QRCodeSVG } from 'qrcode.react';

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
    shopName,
    peopleCount,
    createdAt,
}: ThermalTicketProps) {
    const trackingUrl = `${window.location.origin}/t/${ticketId}`;

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
                width: '58mm',
                fontFamily: '"Cairo", "Noto Kufi Arabic", monospace',
                backgroundColor: '#fff',
                color: '#000',
                padding: '4mm 3mm',
                boxSizing: 'border-box',
                direction: 'rtl',
                textAlign: 'center',
            }}
        >
            {/* Header */}
            <div style={{ borderBottom: '1px dashed #000', paddingBottom: '3mm', marginBottom: '3mm' }}>
                <div style={{ fontSize: '11pt', fontWeight: '900', letterSpacing: '-0.5px' }}>✂ {shopName}</div>
                <div style={{ fontSize: '7pt', color: '#555', marginTop: '1mm' }}>نظام الطوابير الرقمي</div>
            </div>

            {/* Ticket Number - HUGE */}
            <div style={{ margin: '3mm 0' }}>
                <div style={{ fontSize: '8pt', fontWeight: '700', color: '#666', marginBottom: '1mm', letterSpacing: '1px' }}>
                    رقم التذكرة
                </div>
                <div style={{
                    fontSize: '36pt',
                    fontWeight: '900',
                    lineHeight: '1',
                    border: '2px solid #000',
                    borderRadius: '3mm',
                    padding: '3mm 0',
                    letterSpacing: '-2px',
                }}>
                    {ticketNumber}
                </div>
            </div>

            {/* Status badge */}
            <div style={{
                display: 'inline-block',
                border: '1px solid #000',
                borderRadius: '10mm',
                padding: '1mm 5mm',
                fontSize: '8pt',
                fontWeight: '700',
                marginBottom: '3mm',
            }}>
                ⏳ في قائمة الانتظار
            </div>

            {/* Separator */}
            <div style={{ borderTop: '1px dashed #000', margin: '2mm 0' }} />

            {/* Info rows */}
            <table style={{ width: '100%', fontSize: '8pt', borderCollapse: 'collapse', textAlign: 'right' }}>
                <tbody>
                    <InfoRow label="العميل" value={customerName} />
                    {barberName && <InfoRow label="الحلاق" value={barberName} />}
                    {peopleCount > 1 && <InfoRow label="الأشخاص" value={`${peopleCount} أشخاص`} />}
                    <InfoRow label="الوقت" value={`${timeStr}`} />
                    <InfoRow label="التاريخ" value={dateStr} />
                </tbody>
            </table>

            {/* Separator */}
            <div style={{ borderTop: '1px dashed #000', margin: '3mm 0' }} />

            {/* QR Code */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2mm' }}>
                <div style={{ fontSize: '8pt', fontWeight: '700', color: '#555' }}>
                    امسح الكود لتتابع دورك مباشرة 📱
                </div>
                <QRCodeSVG
                    value={trackingUrl}
                    size={110}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#000000"
                    style={{ display: 'block' }}
                />
                <div style={{ fontSize: '6pt', color: '#999', wordBreak: 'break-all', textAlign: 'center', direction: 'ltr' }}>
                    {trackingUrl}
                </div>
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px dashed #000', marginTop: '3mm', paddingTop: '3mm', fontSize: '6.5pt', color: '#666' }}>
                شكراً لزيارتك — Barber Ticket
            </div>
        </div>
    );
}

/* ─── Print function — opens print dialog + auto-downloads PDF ─── */
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

        // ── 1. PDF download ──
        try {
            const html2pdf = (await import('html2pdf.js')).default;
            // ✅ FIXED C-4: use ASCII-safe prefix for filename (no Arabic chars)
            const firstChar = props.barberName?.trim()[0] ?? 'T';
            const prefix = /[a-zA-Z]/.test(firstChar)
                ? firstChar.toUpperCase()
                : String.fromCharCode(65 + (firstChar.charCodeAt(0) % 26));
            const code = `${prefix}${String(props.ticketNumber).padStart(3, '0')}`;
            await html2pdf()
                .set({
                    margin: 0,
                    filename: `تذكرة-${code}-${props.customerName}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 3, useCORS: true, logging: false },
                    jsPDF: { unit: 'mm', format: [58, 180], orientation: 'portrait' },
                })
                .from(ticketEl)
                .save();
        } catch (err) {
            console.error('PDF download failed:', err);
        }

        // ── 2. Thermal print dialog ──
        const printWindow = window.open('', '_blank', 'width=250,height=620');
        if (printWindow) {
            printWindow.document.write(`
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تذكرة #${props.ticketNumber}</title>
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
  <\/script>
</body>
</html>`);
            printWindow.document.close();
        }

        root.unmount();
        document.body.removeChild(container);
    });
}

/* ─── Helper row ─── */
function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <tr>
            <td style={{ color: '#666', fontSize: '7pt', paddingBottom: '1mm', paddingLeft: '2mm' }}>{label}</td>
            <td style={{ fontWeight: '700', paddingBottom: '1mm', textAlign: 'right' }}>{value}</td>
        </tr>
    );
}
