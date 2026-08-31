// ─── Email builder helpers for CashOutModal ───────────────────────────────────

const SUPPORT_EMAIL = 'support@pocketpulltcg.com';

interface EmailCard { cardName: string; qty: number; value: number; rarity?: string; }
interface EmailData {
  username: string;
  confirmationNumber: string;
  cards: EmailCard[];
  totalValue: number;
  totalCards: number;
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
  submittedAt?: string;
}

export function buildConfirmationEmailHtml(d: EmailData): string {
  const date = d.submittedAt || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const cardRows = d.cards
    .map(c => `<tr>
      <td style="padding:8px 14px;border-bottom:1px solid #1e1e2e;color:#e5e7eb;">${c.cardName}</td>
      <td style="padding:8px 14px;border-bottom:1px solid #1e1e2e;text-align:center;color:#9b5cff;font-weight:700;">×${c.qty}</td>
      ${c.rarity ? `<td style="padding:8px 14px;border-bottom:1px solid #1e1e2e;text-align:center;color:#9ca3af;font-size:11px;text-transform:uppercase;">${c.rarity}</td>` : '<td style="padding:8px 14px;border-bottom:1px solid #1e1e2e;"></td>'}
      <td style="padding:8px 14px;border-bottom:1px solid #1e1e2e;text-align:right;color:#10b981;font-weight:700;">$${(c.value * c.qty).toFixed(2)}</td>
    </tr>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>PocketPull Cashout Confirmation</title></head>
<body style="background:#07080e;color:#e5e7eb;font-family:ui-sans-serif,system-ui,sans-serif;margin:0;padding:32px 16px;">
  <div style="max-width:580px;margin:0 auto;background:#0d0e1a;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
    <!-- Header gradient bar -->
    <div style="height:4px;background:linear-gradient(90deg,#9b5cff,#00c8ff);"></div>

    <!-- Hero -->
    <div style="padding:32px 36px 24px;border-bottom:1px solid rgba(255,255,255,0.07);">
      <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#9b5cff;font-weight:700;">PocketPull TCG</p>
      <h1 style="margin:0 0 8px;font-size:26px;color:#ffffff;font-weight:800;letter-spacing:-0.01em;">Cashout Request Received</h1>
      <p style="margin:0;color:#6b7280;font-size:14px;">Status: <span style="color:#f59e0b;font-weight:600;">Pending Review</span></p>
    </div>

    <!-- Body -->
    <div style="padding:28px 36px;">
      <p style="margin:0 0 6px;color:#9ca3af;font-size:15px;">Hi <strong style="color:#ffffff;">${d.username}</strong>,</p>
      <p style="margin:0 0 24px;color:#9ca3af;font-size:15px;line-height:1.6;">
        Your cashout request has been received and is pending review. Please check for confirmation tomorrow.
      </p>

      <!-- Confirmation box -->
      <div style="background:rgba(155,92,255,0.08);border:1px solid rgba(155,92,255,0.25);border-radius:12px;padding:18px 22px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#9b5cff;font-weight:700;">Confirmation Number</p>
        <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.06em;">${d.confirmationNumber}</p>
      </div>

      <!-- Meta row -->
      <div style="display:flex;gap:24px;margin-bottom:24px;">
        <div>
          <p style="margin:0 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;">Date Submitted</p>
          <p style="margin:0;font-size:14px;color:#e5e7eb;font-weight:600;">${date}</p>
        </div>
        <div>
          <p style="margin:0 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;">Total Cards</p>
          <p style="margin:0;font-size:14px;color:#e5e7eb;font-weight:600;">${d.totalCards}</p>
        </div>
        <div>
          <p style="margin:0 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;">Total Value</p>
          <p style="margin:0;font-size:14px;color:#10b981;font-weight:700;">$${d.totalValue.toFixed(2)}</p>
        </div>
      </div>

      <!-- Card list -->
      <p style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;font-weight:700;">Selected Cards</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;background:rgba(255,255,255,0.02);border-radius:10px;overflow:hidden;">
        <thead>
          <tr style="background:rgba(255,255,255,0.04);">
            <th style="padding:10px 14px;text-align:left;color:#6b7280;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:0.08em;">Card</th>
            <th style="padding:10px 14px;text-align:center;color:#6b7280;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:0.08em;">Qty</th>
            <th style="padding:10px 14px;text-align:center;color:#6b7280;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:0.08em;">Rarity</th>
            <th style="padding:10px 14px;text-align:right;color:#6b7280;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:0.08em;">Value</th>
          </tr>
        </thead>
        <tbody>${cardRows}</tbody>
        <tfoot>
          <tr style="background:rgba(16,185,129,0.07);">
            <td colspan="3" style="padding:12px 14px;font-weight:700;color:#ffffff;font-size:14px;">Total (${d.totalCards} cards)</td>
            <td style="padding:12px 14px;text-align:right;font-weight:800;color:#10b981;font-size:16px;">$${d.totalValue.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Shipping -->
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:18px 22px;">
        <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;font-weight:700;">Shipping Address</p>
        <p style="margin:0;color:#ffffff;font-weight:600;font-size:14px;">${d.shippingName}</p>
        <p style="margin:3px 0 0;color:#9ca3af;font-size:13px;">${d.shippingAddress}</p>
        <p style="margin:2px 0 0;color:#9ca3af;font-size:13px;">${d.shippingCity}, ${d.shippingState} ${d.shippingZip}</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:18px 36px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;background:rgba(0,0,0,0.2);">
      <p style="margin:0;font-size:12px;color:#4b5563;">© PocketPull TCG · Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:#9b5cff;text-decoration:none;">${SUPPORT_EMAIL}</a></p>
    </div>
  </div>
</body>
</html>`;
}

export function buildConfirmationEmailText(d: EmailData): string {
  const date = d.submittedAt || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const cardLines = d.cards.map(c => `  ${c.cardName} ×${c.qty}  —  $${(c.value * c.qty).toFixed(2)}`).join('\n');
  return [
    'PocketPull TCG — Cashout Confirmation',
    '=====================================',
    '',
    `Hi ${d.username},`,
    '',
    'Your cashout request has been received and is pending review.',
    'Please check for confirmation tomorrow.',
    '',
    `Confirmation #: ${d.confirmationNumber}`,
    `Date Submitted: ${date}`,
    `Status: Pending`,
    '',
    'Selected Cards:',
    cardLines,
    '',
    `Total: $${d.totalValue.toFixed(2)} (${d.totalCards} cards)`,
    '',
    'Ship to:',
    d.shippingName,
    d.shippingAddress,
    `${d.shippingCity}, ${d.shippingState} ${d.shippingZip}`,
    '',
    '— PocketPull TCG',
    SUPPORT_EMAIL,
  ].join('\n');
}
