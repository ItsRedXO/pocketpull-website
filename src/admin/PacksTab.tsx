import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Plus, Edit2, Trash2, RefreshCw, Eye, EyeOff, ChevronDown } from 'lucide-react';
import { blink } from '../lib/blink';
import type { PackCatalog, PackCard } from '../hooks/usePacks';
import { PackForm } from './PackForm';
import { BACKEND_BASE } from '../lib/backend';

async function logAdminAction(action: string, targetUser: string, details: Record<string, any> = {}) {
  try {
    await fetch(`${BACKEND_BASE}/admin/logs/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': 'true' },
      body: JSON.stringify({ adminUsername: 'Admin', action, targetUser, details }),
    });
  } catch { /* non-critical */ }
}

async function adminPackDelete(packId: string) {
  const token = await blink.auth.getValidToken();
  const secret = typeof window !== 'undefined' ? localStorage.getItem('pocketpull_admin_pass') : null;
  const response = await fetch(`${BACKEND_BASE}/admin/packs/${encodeURIComponent(packId)}`, {
    method: 'DELETE',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(secret ? { 'X-Admin-Secret': secret } : {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) throw new Error(payload?.error || `Delete failed (${response.status})`);
  return payload as { deleted: boolean; archived: boolean; name: string | null };
}

const RARITY_COLOR: Record<string, string> = {
  common: '#8892a4', uncommon: '#10b981', rare: '#00c8ff',
  ultra: '#9b5cff', secret: '#ffd700', god: '#ff00ff',
};

export function PacksTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const qc = useQueryClient();
  const [editingPack, setEditingPack] = useState<PackCatalog | null | 'new'>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<'standard' | 'mystery' | null>('standard');

  const { data: packs = [], isLoading, refetch } = useQuery<PackCatalog[]>({
    queryKey: ['admin-packs'],
    queryFn: async () => {
      // packs_catalog does not have a sortOrder database column.
      // Fetch without SQL ordering, then sort the normalized rows in memory.
      const rows = await blink.db.packsCatalog.list();
      return rows
        .filter((r: any) => !r.adminDeleted)
        .map((r: any) => ({
          ...r,
          packType: r.packType === 'mystery' ? 'mystery' : 'standard',
          price: Number(r.price),
          sortOrder: Number(r.sortOrder ?? 0), isActive: Number(r.isActive ?? 1),
        }))
        .sort((a: any, b: any) => (a.sortOrder - b.sortOrder) || String(a.name || '').localeCompare(String(b.name || ''))) as PackCatalog[];
    },
    staleTime: 0,
    refetchInterval: 3000,
  });

  const { data: allCards = [] } = useQuery<PackCard[]>({
    queryKey: ['admin-all-cards'],
    queryFn: async () => {
      const rows = await blink.db.packCards.list({ orderBy: { sortOrder: 'asc' } });
      return rows.map((r: any) => ({
        ...r, pullChance: Number(r.pullChance),
        estimatedValue: Number(r.estimatedValue), sortOrder: Number(r.sortOrder ?? 0),
        quantity: Number(r.quantity ?? 0),
      })) as PackCard[];
    },
    staleTime: 0,
    refetchInterval: 3000,
  });

  const cardsForPack = (id: string) => allCards.filter(c => c.packId === id);

  const toggleActive = async (pack: PackCatalog) => {
    try {
      await blink.db.packsCatalog.update(pack.id, { isActive: Number(pack.isActive) > 0 ? 0 : 1 });
      qc.invalidateQueries({ queryKey: ['admin-packs'] });
      qc.invalidateQueries({ queryKey: ['packs-catalog'] });
      const nextActive = Number(pack.isActive) > 0 ? 'hidden' : 'shown';
      showToast(`${pack.name} ${nextActive} on site.`);
      logAdminAction(`Admin ${nextActive === 'hidden' ? 'Hid' : 'Showed'} Pack`, 'system', { packName: pack.name, packId: pack.id });
    } catch (err: any) { showToast(`Toggle failed: ${err?.message || 'Unknown error'}`, false); }
  };

  const deletePack = async (pack: PackCatalog) => {
    setDeletingId(pack.id);
    try {
      const result = await adminPackDelete(pack.id);
      qc.invalidateQueries({ queryKey: ['admin-packs'] });
      qc.invalidateQueries({ queryKey: ['admin-all-cards'] });
      qc.invalidateQueries({ queryKey: ['packs-catalog'] });
      showToast(result.archived ? `${pack.name} archived (history preserved).` : `${pack.name} deleted.`);
      logAdminAction('Admin Deleted Pack', 'system', { packName: pack.name, packId: pack.id, archived: result.archived });
    } catch (err: any) { showToast(`Delete failed: ${err?.message || 'Unknown error'}`, false); }
    finally { setDeletingId(null); }
  };

  const handleSaved = () => {
    setEditingPack(null);
    qc.invalidateQueries({ queryKey: ['admin-packs'] });
    qc.invalidateQueries({ queryKey: ['admin-all-cards'] });
    qc.invalidateQueries({ queryKey: ['packs-catalog'] });
    qc.invalidateQueries({ queryKey: ['pack-cards'] });
    showToast('Pack saved — live site updated! ✓');
    logAdminAction('Admin Saved Pack', 'system', { packId: editTarget?.id, packName: editTarget?.name });
  };

  const editTarget = editingPack && editingPack !== 'new' ? editingPack : null;
  const normalPacks = packs.filter(pack => pack.packType !== 'mystery');
  const mysteryPacks = packs.filter(pack => pack.packType === 'mystery');
  const visiblePacks = expandedCategory === 'mystery' ? mysteryPacks : normalPacks;

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-display text-xl uppercase tracking-wider text-white">Pack Manager</h2>
          <p className="text-[11px] text-white/30 mt-0.5">{packs.length} packs · {allCards.length} cards total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { refetch(); qc.invalidateQueries({ queryKey: ['admin-all-cards'] }); }}
            className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all" title="Refresh">
            <RefreshCw size={14} />
          </button>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => setEditingPack('new')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-display text-[12px] uppercase tracking-widest font-bold"
            style={{ background: 'linear-gradient(135deg, #9b5cff, #00c8ff)', color: '#fff', boxShadow: '0 0 20px -6px rgba(155,92,255,0.5)' }}>
            <Plus size={14} /> New Pack
          </motion.button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">{[1,2,3].map(i => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />)}</div>
      ) : packs.length === 0 ? (
        <div className="text-center py-16">
          <Package size={36} className="text-white/15 mx-auto mb-3" />
          <p className="text-white/30 font-display uppercase tracking-wider text-sm">No packs yet</p>
          <p className="text-white/15 text-[11px] mt-1">Click "New Pack" to get started.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
            {(['standard', 'mystery'] as const).map(category => {
              const count = category === 'standard' ? normalPacks.length : mysteryPacks.length;
              const isExpanded = expandedCategory === category;
              return (
                <button key={category} type="button" onClick={() => setExpandedCategory(isExpanded ? null : category)} className="flex items-center justify-between rounded-2xl px-4 py-4 text-left transition-all hover:bg-white/[0.06]" style={{ background: isExpanded ? 'rgba(155,92,255,0.12)' : 'rgba(255,255,255,0.025)', border: `1.5px solid ${isExpanded ? '#9b5cff66' : 'rgba(255,255,255,0.08)'}` }}>
                  <span>
                    <span className="block text-[10px] uppercase tracking-[0.2em] text-white/35">{category === 'standard' ? 'Normal Packs' : 'Mystery Packs'}</span>
                    <span className="block mt-1 text-2xl font-display font-bold text-white">{count}</span>
                  </span>
                  <ChevronDown size={18} className={`text-white/35 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              );
            })}
          </div>
          {expandedCategory && (
            <div className="flex flex-col gap-3">
              {visiblePacks.length === 0 && (
                <div className="text-center py-12 rounded-2xl border border-white/8 bg-white/[0.02]">
                  <Package size={30} className="text-white/15 mx-auto mb-3" />
                  <p className="text-white/30 font-display uppercase tracking-wider text-sm">No {expandedCategory === 'mystery' ? 'mystery' : 'normal'} packs yet</p>
                </div>
              )}
              {visiblePacks.map(pack => {
                const cards = cardsForPack(pack.id);
                const active = Number(pack.isActive) > 0;
                const glow = pack.glowColor ?? '#00c8ff';
                return (
                  <motion.div key={pack.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.025)', border: `1.5px solid ${active ? glow + '30' : 'rgba(255,255,255,0.07)'}` }}>
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-12 h-14 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                        style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${glow}22` }}>
                        {pack.imageUrl
                          ? <img src={pack.imageUrl} alt={pack.name} className="h-full w-auto object-contain" />
                          : <Package size={18} className="text-white/20" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display text-sm text-white uppercase tracking-wide truncate">{pack.name}</h3>
                          {pack.packType === 'mystery' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase text-[#ffd700] bg-[#ffd700]/10 border border-[#ffd700]/25">Vault</span>
                          )}
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{ background: active ? `${glow}18` : 'rgba(255,255,255,0.06)', color: active ? glow : '#555', border: `1px solid ${active ? glow + '30' : 'rgba(255,255,255,0.08)'}` }}>
                            {active ? 'LIVE' : 'HIDDEN'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-sm font-bold" style={{ color: glow }}>${Number(pack.price).toFixed(2)}</span>
                          <span className="text-[10px] text-white/30">{cards.length} cards</span>
                          {pack.quantityLimit > 0 && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${pack.currentQuantity <= 5 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                              STOCK: {pack.currentQuantity} / {pack.quantityLimit}
                            </span>
                          )}
                          {pack.cooldownHours > 0 && (
                            <span className="text-[9px] text-white/20 uppercase tracking-widest border border-white/5 px-1.5 py-0.5 rounded">
                              {pack.cooldownHours}H Cooldown
                            </span>
                          )}
                          {pack.expiresAt && (
                            <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded ${new Date(pack.expiresAt) < new Date() ? 'bg-red-500/20 text-red-400' : 'text-white/30'}`}>
                              EXPIRES: {new Date(pack.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {Object.entries(RARITY_COLOR).map(([r, col]) => {
                            const n = cards.filter(c => c.rarity === r).length;
                            if (!n) return null;
                            return <span key={r} className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded"
                              style={{ background: col + '15', color: col, border: `1px solid ${col}20` }}>{n} {r}</span>;
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => toggleActive(pack)} title={active ? 'Hide' : 'Show'}
                          className="p-2 rounded-lg transition-all hover:bg-white/8" style={{ color: active ? glow : 'rgba(255,255,255,0.2)' }}>
                          {active ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button onClick={() => setEditingPack(pack)}
                          className="p-2 rounded-lg text-white/30 hover:text-[#00c8ff] hover:bg-[#00c8ff]/10 transition-all">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => { if (window.confirm(`Delete "${pack.name}"? This removes all ${cards.length} cards.`)) deletePack(pack); }}
                          disabled={deletingId === pack.id}
                          className="p-2 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-40 transition-all">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {cards.length > 0 && (
                      <div className="px-4 pb-3 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                        {cards.map(c => (
                          <div key={c.id} className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[9px]"
                            style={{ background: RARITY_COLOR[c.rarity] + '12', border: `1px solid ${RARITY_COLOR[c.rarity]}20` }}>
                            <span className="font-bold" style={{ color: RARITY_COLOR[c.rarity] }}>{c.pullChance}%</span>
                            <span className="text-white/40 truncate max-w-[80px]">{c.cardName}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {editingPack !== null && (
        <PackForm
          key={editTarget?.id ?? 'new'}
          pack={editTarget}
          existingCards={editTarget ? cardsForPack(editTarget.id) : []}
          onSave={handleSaved}
          onClose={() => setEditingPack(null)}
        />
      )}
    </>
  );
}
