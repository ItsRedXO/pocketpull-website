import { CashoutRequest, GroupedCard } from './CashoutTypes';
import { fmt, fmtDate, groupCards, parseCards } from './CashoutHelpers';

export function printHtml(html: string, title: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head>
    <title>${title}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; color: #111; padding: 32px; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      .subtitle { font-size: 13px; color: #555; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th { background: #1a1a2e; color: #fff; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
      td { padding: 9px 12px; font-size: 13px; border-bottom: 1px solid #e5e7eb; }
      tr:nth-child(even) td { background: #f9fafb; }
      .total-row td { font-weight: 700; background: #f3f4f6; font-size: 14px; }
      .meta { display: flex; gap: 32px; margin-bottom: 20px; }
      .meta-item { font-size: 13px; }
      .meta-label { color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
      @media print { body { padding: 16px; } }
    </style>
  </head><body>${html}<script>window.onload=()=>{window.print();}<\/script></body></html>`);
  w.document.close();
}

export function generateSinglePdf(req: CashoutRequest) {
  const cards = parseCards(req.cardsJson);
  const grouped = groupCards(cards);
  const rows = grouped.map(c => `<tr>
    <td>${c.card_name}</td>
    <td style="text-align:center">${c.quantity}</td>
    <td style="text-align:right">${fmt(c.value)}</td>
  </tr>`).join('');

  const html = `
    <h1>PocketPull TCG — Cashout Request</h1>
    <p class="subtitle">Printed on ${new Date().toLocaleString()}</p>
    <div class="meta">
      <div class="meta-item"><div class="meta-label">Username</div>${req.username}</div>
      <div class="meta-item"><div class="meta-label">Confirmation #</div>${req.confirmationNumber}</div>
      <div class="meta-item"><div class="meta-label">Date Submitted</div>${fmtDate(req.createdAt)}</div>
      <div class="meta-item"><div class="meta-label">Status</div>${req.status}</div>
    </div>
    ${req.shippingAddress ? `<div class="meta" style="margin-bottom:20px">
      <div class="meta-item"><div class="meta-label">Ship To</div>
        ${req.shippingName || ''}<br>
        ${req.shippingAddress || ''}<br>
        ${req.shippingCity || ''}, ${req.shippingState || ''} ${req.shippingZip || ''}
      </div>
    </div>` : ''}
    <table>
      <thead><tr><th>Card Name</th><th style="text-align:center">Qty</th><th style="text-align:right">Value</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="total-row">
        <td colspan="2">TOTAL</td>
        <td style="text-align:right">${fmt(req.totalValue)}</td>
      </tr></tfoot>
    </table>
  `;
  printHtml(html, `Cashout #${req.confirmationNumber}`);
}

export function generateAllPdf(allCards: GroupedCard[], totalValue: number) {
  const rows = allCards.map(c => `<tr>
    <td>${c.card_name}</td>
    <td style="text-align:center">${c.quantity}</td>
    <td style="text-align:right">${c.value > 0 ? fmt(c.value) : '—'}</td>
  </tr>`).join('');

  const html = `
    <h1>PocketPull TCG — All Pending Cashout Cards</h1>
    <p class="subtitle">Printed on ${new Date().toLocaleString()} · Combined master pull list</p>
    <table>
      <thead><tr><th>Card Name</th><th style="text-align:center">Total Qty</th><th style="text-align:right">Total Value</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="total-row">
        <td colspan="2">TOTAL</td>
        <td style="text-align:right">${fmt(totalValue)}</td>
      </tr></tfoot>
    </table>
  `;
  printHtml(html, 'All Pending Cashouts — Master List');
}
