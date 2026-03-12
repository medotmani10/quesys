import { QRCodeSVG } from 'qrcode.react';
import { getCustomerBaseUrl, getTicketCode } from '@/lib/utils';

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
    peopleAhead?: number;
    pinCode?: string | null;
    createdAt: Date;
}

export function ThermalTicket({
    ticketNumber,
    ticketId,
    customerName,
    barberName,
    barberIndex,
    shopName,
    peopleCount,
    peopleAhead,
    createdAt,
}: ThermalTicketProps) {
    const customerBase = getCustomerBaseUrl();
    const trackingUrl = `${customerBase}/t/${ticketId}`;

    const dateTimeStr = createdAt.toLocaleString('fr-FR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });

    const displayTicketCode = getTicketCode(barberIndex, ticketNumber);

    return (
        <div
            id="thermal-ticket-content"
            style={{
                width: '280px',
                fontFamily: '"Cairo", sans-serif',
                backgroundColor: '#fff',
                color: '#000',
                padding: '10px',
                boxSizing: 'border-box',
                direction: 'rtl',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
            }}
        >
            <div style={{ marginBottom: '5px' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#000', marginBottom: '2px' }}>
                    {shopName}
                </div>
                <div style={{ fontSize: '12px', color: '#000', fontWeight: 'bold' }}>
                    {dateTimeStr}
                </div>
            </div>

            <div style={{ padding: '5px 0' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#000', marginBottom: '8px' }}>
                    رقم التذكرة
                </div>
                <div style={{
                    fontSize: '65px',
                    fontWeight: 'bold',
                    lineHeight: '1',
                    border: '3px solid #000',
                    borderRadius: '25px',
                    padding: '15px 0',
                    width: '100%',
                    display: 'block',
                    margin: '0 auto',
                    color: '#000'
                }}>
                    <div>{displayTicketCode}</div>
                    {peopleAhead !== undefined && (
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#000', marginTop: '6px' }}>
                            أشخاص في الانتظار: {peopleAhead}
                        </div>
                    )}
                </div>
            </div>

            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '8px',
                borderTop: '2px solid #000',
                marginTop: '5px'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right', flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#000' }}>
                        الزبون: <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{customerName}</span>
                    </div>
                    {barberName && (
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#000' }}>
                            الحلاق: <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{barberName}</span>
                        </div>
                    )}
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#000' }}>
                        الأشخاص: <span style={{ fontWeight: 'bold', fontSize: '15px' }}>{peopleCount}</span>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', marginRight: '5px' }}>
                    <div style={{
                        width: '110px',
                        height: '110px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#fff'
                    }}>
                        <QRCodeSVG
                            value={trackingUrl}
                            size={110}
                            level="M"
                            bgColor="#ffffff"
                            fgColor="#000000"
                            includeMargin={false}
                        />
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#000', textAlign: 'center', lineHeight: '1.2', maxWidth: '110px' }}>
                        تتبع دورك
                    </div>
                </div>
            </div>

            <div style={{ fontSize: '12px', color: '#000', marginTop: '5px', fontWeight: 'bold', borderTop: '4px dashed #000', paddingTop: '5px' }}>
                نشكركم على زيارتكم ، الى لقاء آخر
            </div>
        </div>
    );
}

export async function printThermalTicket(props: ThermalTicketProps) {
    const displayCode = getTicketCode(props.barberIndex, props.ticketNumber);
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;';
    document.body.appendChild(container);

    const { createRoot } = await import('react-dom/client');
    const root = createRoot(container);
    root.render(<ThermalTicket {...props} />);

    await new Promise(r => setTimeout(r, 300));

    const ticketEl = container.querySelector('#thermal-ticket-content') as HTMLElement | null;
    if (!ticketEl) {
        root.unmount();
        if (document.body.contains(container)) document.body.removeChild(container);
        return;
    }

    if (navigator.share && navigator.canShare) {
        try {
            const { toBlob } = await import('html-to-image');

            const blob = await toBlob(ticketEl, {
                quality: 1,
                backgroundColor: '#ffffff',
                pixelRatio: 2,
                style: { transform: 'scale(1)', transformOrigin: 'top left' }
            });

            if (blob) {
                const file = new File([blob], `ticket-${displayCode}.png`, { type: 'image/png' });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: `تذكرة ${displayCode}`,
                        text: `تذكرة العميل ${props.customerName} - صالون ${props.shopName}`,
                        files: [file]
                    });
                    root.unmount();
                    if (document.body.contains(container)) document.body.removeChild(container);
                    return;
                }
            }
        } catch (err: unknown) {
            const name = typeof err === 'object' && err !== null && 'name' in err ? (err as { name?: unknown }).name : undefined;
            if (name === 'AbortError') {
                root.unmount();
                if (document.body.contains(container)) document.body.removeChild(container);
                return;
            }
        }
    }

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:absolute;width:0px;height:0px;left:-9999px;border:none;';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
        root.unmount();
        if (document.body.contains(container)) document.body.removeChild(container);
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        return;
    }

    doc.open();
    doc.write(`
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تذكرة ${displayCode}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: 58mm auto; margin: 0; }
    body { font-family: 'Cairo', sans-serif; background: #fff; width: 58mm; padding: 0; overflow: hidden; }
    #thermal-ticket-content { width: 58mm !important; }
  </style>
</head>
<body>
  ${sanitizeHtml(ticketEl.outerHTML)}
</body>
</html>`);
    doc.close();

    iframe.onload = function () {
        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            setTimeout(() => {
                if (document.body.contains(iframe)) document.body.removeChild(iframe);
                root.unmount();
                if (document.body.contains(container)) document.body.removeChild(container);
            }, 1000);
        }, 600);
    };
}
