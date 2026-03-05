import { QRCodeSVG } from 'qrcode.react';

interface ThermalTicketProps {
    ticketNumber: number;
    customerName: string;
    barberName?: string;
    shopName: string;
    shopSlug: string;
    peopleCount: number;
    createdAt: Date;
}

export function ThermalTicket({
    ticketNumber,
    customerName,
    barberName,
    shopName,
    shopSlug,
    peopleCount,
    createdAt,
}: ThermalTicketProps) {
    const trackingUrl = `${window.location.origin}/${shopSlug}`;

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
                    امسح الكود لتتابع دورك مباشرة
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
                شكراً لزيارتك — BarberQueue
            </div>
        </div>
    );
}

/* ─── Print function ─── */
export function printThermalTicket(props: ThermalTicketProps) {
    const container = document.createElement('div');
    document.body.appendChild(container);

    // Dynamically render with React
    import('react-dom/client').then(({ createRoot }) => {
        const root = createRoot(container);
        root.render(<ThermalTicket {...props} />);

        setTimeout(() => {
            const ticketEl = container.querySelector('#thermal-ticket-content') as HTMLElement;
            if (!ticketEl) { document.body.removeChild(container); return; }

            const printWindow = window.open('', '_blank', 'width=250,height=600');
            if (!printWindow) { document.body.removeChild(container); return; }

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
            @page {
              size: 58mm auto;
              margin: 0;
            }
            body {
              font-family: 'Cairo', monospace;
              background: #fff;
              color: #000;
              width: 58mm;
            }
            @media print {
              body { width: 58mm; }
            }
          </style>
        </head>
        <body>
          ${ticketEl.outerHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              }, 800);
            };
          <\/script>
        </body>
        </html>
      `);

            printWindow.document.close();
            root.unmount();
            document.body.removeChild(container);
        }, 300);
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
