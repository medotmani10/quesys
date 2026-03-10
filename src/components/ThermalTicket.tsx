import { QRCodeSVG } from 'qrcode.react';
import { getCustomerBaseUrl } from '@/lib/utils';

// تنظيف أكواد HTML قبل الطباعة لمنع الأخطاء
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

    // توليد كود التذكرة (مثل A1, B2...)
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
                width: '220px', // العرض المثالي لطابعات 58mm
                fontFamily: '"Cairo", "Noto Kufi Arabic", monospace',
                backgroundColor: '#fff',
                color: '#000',
                padding: '10px',
                boxSizing: 'border-box',
                direction: 'rtl',
                textAlign: 'center',
            }}
        >
            {/* رأس التذكرة (مضغوط) */}
            <div style={{ borderBottom: '1px solid #000', paddingBottom: '3px', marginBottom: '5px' }}>
                <div style={{ fontSize: '12pt', fontWeight: '900' }}>✂ {shopName}</div>
                <div style={{ fontSize: '7pt', color: '#444', marginTop: '2px' }}>
                    {dateStr} | {timeStr}
                </div>
            </div>

            {/* رقم الدور (البطل) */}
            <div style={{ margin: '5px 0' }}>
                <div style={{ fontSize: '9pt', fontWeight: '700', color: '#555' }}>رقم دورك</div>
                <div style={{
                    fontSize: '42pt',
                    fontWeight: '900',
                    lineHeight: '1',
                    padding: '2px 0',
                    textAlign: 'center',
                }}>
                    {code}
                </div>
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }} />

            {/* القسم المدمج: معلومات العميل + QR Code في سطر واحد */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                textAlign: 'right',
                margin: '5px 0'
            }}>
                {/* قسم المعلومات (يمين) */}
                <div style={{ flex: 1, paddingLeft: '5px' }}>
                    <div style={{ fontSize: '11pt', fontWeight: '900', marginBottom: '3px' }}>{customerName}</div>
                    {barberName && (
                        <div style={{ fontSize: '9pt', color: '#333' }}>
                            مع: <strong>{barberName}</strong>
                        </div>
                    )}
                    {peopleCount > 1 && (
                        <div style={{ fontSize: '8pt', color: '#555', marginTop: '2px' }}>
                            العدد: {peopleCount}
                        </div>
                    )}
                </div>

                {/* قسم الـ QR (يسار) بدون الرابط النصي */}
                <div style={{ flexShrink: 0 }}>
                    <QRCodeSVG
                        value={trackingUrl}
                        size={65} // حجم مصغر ومناسب
                        level="L"
                        bgColor="#ffffff"
                        fgColor="#000000"
                    />
                </div>
            </div>

            {/* تذييل التذكرة */}
            <div style={{ borderTop: '1px solid #000', marginTop: '5px', paddingTop: '4px', fontSize: '7pt', fontWeight: 'bold' }}>
                امسح الكود لمتابعة دورك من هاتفك
            </div>
        </div>
    );
}

/* ─── Print function — opens print dialog + auto-downloads PDF ─── */
export function printThermalTicket(props: ThermalTicketProps) {
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
    document.body.appendChild(container);

    import('react-dom/client').then(async ({ createRoot }) => {
        const root = createRoot(container);
        root.render(<ThermalTicket {...props} />);

        await new Promise(r => setTimeout(r, 350));

        const ticketEl = container.querySelector('#thermal-ticket-content') as HTMLElement;
        if (!ticketEl) { document.body.removeChild(container); return; }

        try {
            const { toPng } = await import('html-to-image');
            const { jsPDF } = await import('jspdf');

            const code = props.barberIndex !== undefined && props.barberIndex >= 0
                ? `${String.fromCharCode(65 + (props.barberIndex % 26))}${props.ticketNumber}`
                : `${props.ticketNumber}`;

            const dataUrl = await toPng(ticketEl, {
                quality: 1,
                backgroundColor: '#ffffff',
                pixelRatio: 3,
                width: 220,
                style: { margin: '0' }
            });

            // تغيير جذري: تم تقليص الطول من 180 إلى 90 ملم لعدم إهدار الورق
            const pdf = new jsPDF({
                unit: 'mm',
                format: [58, 90],
                orientation: 'portrait'
            });

            pdf.addImage(dataUrl, 'PNG', 0, 0, 58, 90);
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

        root.unmount();
        document.body.removeChild(container);
    });
}
