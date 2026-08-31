import { CashoutCard, GroupedCard, IndividualCard } from './CashoutTypes';

export const PAGE_SIZE = 20;

export function groupCards(cards: CashoutCard[]): GroupedCard[] {
  const map = new Map<string, GroupedCard>();
  for (const c of cards) {
    const existing = map.get(c.card_name);
    if (existing) {
      existing.quantity += 1;
      existing.value += Number(c.value) || 0;
    } else {
      map.set(c.card_name, {
        card_name: c.card_name,
        quantity: 1,
        value: Number(c.value) || 0,
        rarity: c.rarity,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.card_name.localeCompare(b.card_name));
}

export function parseCards(json: string): IndividualCard[] {
  try { return JSON.parse(json) || []; } catch { return []; }
}

export function extractIdImageUrl(notes?: string): string | null {
  if (!notes) return null;
  // Handle both "ID uploaded: URL" and "ID: URL" formats
  const match = notes.match(/ID(?: uploaded)?:\s*(https?:\/\/\S+)/i);
  return match ? match[1].replace(/\|$/, '') : null;
}

export function statusColor(s: string) {
  switch (s) {
    case 'pending': return { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' };
    case 'processing': return { color: '#00c8ff', bg: 'rgba(0,200,255,0.12)', border: 'rgba(0,200,255,0.3)' };
    case 'shipped': return { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)' };
    case 'partial': return { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' };
    case 'completed': return { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' };
    case 'cancelled': return { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' };
    case 'returned': return { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)' };
    default: return { color: '#9ca3af', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.3)' };
  }
}

export function fmt(n: number | string) { return `$${Number(n).toFixed(2)}`; }

export function fmtDate(s: string) {
  if (!s) return '—';
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return s; }
}

export function getRarityColor(r: string): string {
  const map: Record<string, string> = {
    common: '#8892a4', uncommon: '#10b981', rare: '#00c8ff',
    ultra: '#9b5cff', secret: '#ffd700', god: '#ff00ff',
  };
  return map[r?.toLowerCase()] ?? '#8892a4';
}
