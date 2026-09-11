import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, Trash2, RefreshCw, Zap, X, ShoppingBag, Clock } from 'lucide-react';
import {
  getAdminBrawlItems, createAdminBrawlItem, updateAdminBrawlItem, deleteAdminBrawlItem,
  getAdminBrawlShop, setAdminBrawlShopSlate, regenerateAdminBrawlNextShop, rotateAdminBrawlShopNow,
  type AdminBrawlItem, type ItemRarity, type ItemKind,
} from './brawlAdminApi';

const RARITIES: ItemRarity[] = ['common', 'uncommon', 'rare'];
const KINDS: ItemKind[] = ['stone', 'held', 'other'];
const RARITY_COLORS: Record<ItemRarity, string> = { common: '#8892a4', uncommon: '#4ade80', rare: '#facc15' };

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function useCountdown(endsAt: string | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!endsAt) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [endsAt]);
  if (!endsAt) return 0;
  return Math.max(0, new Date(endsAt).getTime() - now);
}

interface NewItemFields { key: string; name: string; description: string; rarity: ItemRarity; kind: ItemKind; price: string; spriteUrl: string; active: boolean; }
const BLANK_NEW_ITEM: NewItemFields = { key: '', name: '', description: '', rarity: 'common', kind: 'other', price: '', spriteUrl: '', active: false };

function ShopSlate({ title, subtitle, itemKeys, allItems, onAdd, onRemove, pending }: {
  title: string; subtitle: string; itemKeys: string[]; allItems: AdminBrawlItem[];
  onAdd: (key: string) => void; onRemove: (key: string) => void; pending: boolean;
}) {
  const byKey = new Map(allItems.map(i => [i.key, i]));
  const available = allItems.filter(i => i.active && !itemKeys.includes(i.key));
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex-1 min-w-[280px]">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-white/70">{title}</h4>
        <span className="text-[10px] text-white/30">{subtitle}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[2rem]">
        {itemKeys.length === 0 && <span className="text-[11px] text-white/25">Empty</span>}
        {itemKeys.map(key => {
          const item = byKey.get(key);
          const color = item ? RARITY_COLORS[item.rarity] : '#8892a4';
          return (
            <span key={key} className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full text-[10px] font-bold"
              style={{ background: `${color}20`, color, border: `1px solid ${color}45` }}>
              {item?.name || key}
              <button disabled={pending} onClick={() => onRemove(key)} className="hover:text-white"><X size={11} /></button>
            </span>
          );
        })}
      </div>
      <select disabled={pending} value="" onChange={e => { if (e.target.value) onAdd(e.target.value); }}
        className="w-full bg-white/5 border border-white/10 rounded-md text-[11px] text-white/70 px-2 py-1.5 outline-none focus:border-[#9b5cff]">
        <option value="" className="bg-[#0d0e14]">+ Add item…</option>
        {available.map(i => <option key={i.key} value={i.key} className="bg-[#0d0e14]">{i.name} ({i.rarity})</option>)}
      </select>
    </div>
  );
}

export function BrawlItemsTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const qc = useQueryClient();
  const { data: itemsData, isLoading } = useQuery({ queryKey: ['admin-brawl-items'], queryFn: getAdminBrawlItems, staleTime: 15000 });
  const { data: shop } = useQuery({ queryKey: ['admin-brawl-shop'], queryFn: getAdminBrawlShop, staleTime: 10000 });
  const items = itemsData?.items || [];

  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newItem, setNewItem] = useState<NewItemFields>(BLANK_NEW_ITEM);
  const [creating, setCreating] = useState(false);
  const [slatePending, setSlatePending] = useState(false);
  const remainingMs = useCountdown(shop?.nextRotateAt);

  const setEdit = (key: string, field: string, value: string) => setEdits(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  const rowEdits = (key: string) => edits[key] || {};
  const valueFor = (row: AdminBrawlItem, field: string) => rowEdits(row.key)[field] ?? String((row as any)[field] ?? '');
  const isDirty = (key: string) => Object.keys(edits[key] || {}).length > 0;

  const handleSave = async (row: AdminBrawlItem) => {
    const changes = rowEdits(row.key);
    if (!Object.keys(changes).length) return;
    setSavingKey(row.key);
    try {
      const fields: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(changes)) fields[k] = k === 'price' ? Number(v) : v;
      const res = await updateAdminBrawlItem(row.key, fields);
      qc.setQueryData<{ items: AdminBrawlItem[] }>(['admin-brawl-items'], prev => ({ items: (prev?.items || []).map(i => (i.key === res.item.key ? res.item : i)) }));
      setEdits(prev => { const next = { ...prev }; delete next[row.key]; return next; });
      showToast(`${res.item.name} updated`);
    } catch (e: any) {
      showToast(e.message || 'Failed to save', false);
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggleActive = async (row: AdminBrawlItem) => {
    try {
      const res = await updateAdminBrawlItem(row.key, { active: !row.active });
      qc.setQueryData<{ items: AdminBrawlItem[] }>(['admin-brawl-items'], prev => ({ items: (prev?.items || []).map(i => (i.key === res.item.key ? res.item : i)) }));
      showToast(`${res.item.name} ${res.item.active ? 'activated' : 'deactivated'}`);
    } catch (e: any) {
      showToast(e.message || 'Failed to update', false);
    }
  };

  const handleDelete = async (row: AdminBrawlItem) => {
    if (!window.confirm(`Delete "${row.name}"? This can't be undone.`)) return;
    try {
      await deleteAdminBrawlItem(row.key);
      qc.setQueryData<{ items: AdminBrawlItem[] }>(['admin-brawl-items'], prev => ({ items: (prev?.items || []).filter(i => i.key !== row.key) }));
      showToast(`${row.name} deleted`);
    } catch (e: any) {
      showToast(e.message || 'Failed to delete', false);
    }
  };

  const handleCreate = async () => {
    const price = Number(newItem.price);
    if (!newItem.key.trim() || !newItem.name.trim() || !newItem.description.trim() || !Number.isFinite(price)) {
      showToast('Key, name, description, and a valid price are required', false);
      return;
    }
    setCreating(true);
    try {
      const res = await createAdminBrawlItem({
        key: newItem.key.trim().toLowerCase(), name: newItem.name.trim(), description: newItem.description.trim(),
        rarity: newItem.rarity, kind: newItem.kind, price: Math.round(price), sprite_url: newItem.spriteUrl.trim() || null, active: newItem.active,
      });
      qc.setQueryData<{ items: AdminBrawlItem[] }>(['admin-brawl-items'], prev => ({ items: [...(prev?.items || []), res.item] }));
      setNewItem(BLANK_NEW_ITEM);
      setShowNewForm(false);
      showToast(`${res.item.name} created`);
    } catch (e: any) {
      showToast(e.message || 'Failed to create item', false);
    } finally {
      setCreating(false);
    }
  };

  const handleSlateAdd = async (target: 'current' | 'next', key: string) => {
    if (!shop) return;
    const keys = target === 'current' ? shop.current.itemKeys : shop.next.itemKeys;
    setSlatePending(true);
    try {
      const res = await setAdminBrawlShopSlate(target, [...keys, key]);
      qc.setQueryData(['admin-brawl-shop'], res);
    } catch (e: any) {
      showToast(e.message || 'Failed to update shop', false);
    } finally {
      setSlatePending(false);
    }
  };
  const handleSlateRemove = async (target: 'current' | 'next', key: string) => {
    if (!shop) return;
    const keys = (target === 'current' ? shop.current.itemKeys : shop.next.itemKeys).filter(k => k !== key);
    setSlatePending(true);
    try {
      const res = await setAdminBrawlShopSlate(target, keys);
      qc.setQueryData(['admin-brawl-shop'], res);
    } catch (e: any) {
      showToast(e.message || 'Failed to update shop', false);
    } finally {
      setSlatePending(false);
    }
  };
  const handleRegenerateNext = async () => {
    setSlatePending(true);
    try {
      const res = await regenerateAdminBrawlNextShop();
      qc.setQueryData(['admin-brawl-shop'], res);
      showToast('Next rotation queue shuffled');
    } catch (e: any) {
      showToast(e.message || 'Failed to shuffle', false);
    } finally {
      setSlatePending(false);
    }
  };
  const handleRotateNow = async () => {
    if (!window.confirm('Rotate the shop right now? This immediately replaces the live shop for every player with the staged queue.')) return;
    setSlatePending(true);
    try {
      const res = await rotateAdminBrawlShopNow();
      qc.setQueryData(['admin-brawl-shop'], res);
      showToast('Shop rotated');
    } catch (e: any) {
      showToast(e.message || 'Failed to rotate', false);
    } finally {
      setSlatePending(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ShoppingBag size={16} className="text-[#9b5cff]" />
          <h2 className="font-display text-sm uppercase tracking-widest text-white/70">Poke Brawl — Items</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full text-white/40 bg-white/5">{items.length} in catalog</span>
        </div>
        <button onClick={() => setShowNewForm(v => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase bg-[#9b5cff]/20 text-[#9b5cff] hover:bg-[#9b5cff]/30">
          <Plus size={13} /> New Item
        </button>
      </div>

      {showNewForm && (
        <div className="rounded-xl border border-[#9b5cff]/30 bg-[#9b5cff]/5 p-3 mb-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <input placeholder="key (e.g. razor-claw)" value={newItem.key} onChange={e => setNewItem(v => ({ ...v, key: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-md text-xs text-white px-2 py-1.5 outline-none focus:border-[#9b5cff]" />
          <input placeholder="Name" value={newItem.name} onChange={e => setNewItem(v => ({ ...v, name: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-md text-xs text-white px-2 py-1.5 outline-none focus:border-[#9b5cff]" />
          <input placeholder="Description" value={newItem.description} onChange={e => setNewItem(v => ({ ...v, description: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-md text-xs text-white px-2 py-1.5 outline-none focus:border-[#9b5cff] lg:col-span-2" />
          <select value={newItem.rarity} onChange={e => setNewItem(v => ({ ...v, rarity: e.target.value as ItemRarity }))}
            className="bg-white/5 border border-white/10 rounded-md text-xs text-white px-2 py-1.5 outline-none focus:border-[#9b5cff]">
            {RARITIES.map(r => <option key={r} value={r} className="bg-[#0d0e14]">{r}</option>)}
          </select>
          <select value={newItem.kind} onChange={e => setNewItem(v => ({ ...v, kind: e.target.value as ItemKind }))}
            className="bg-white/5 border border-white/10 rounded-md text-xs text-white px-2 py-1.5 outline-none focus:border-[#9b5cff]">
            {KINDS.map(k => <option key={k} value={k} className="bg-[#0d0e14]">{k}</option>)}
          </select>
          <input type="number" placeholder="Price" value={newItem.price} onChange={e => setNewItem(v => ({ ...v, price: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-md text-xs text-white px-2 py-1.5 outline-none focus:border-[#9b5cff]" />
          <input placeholder="Sprite URL (optional)" value={newItem.spriteUrl} onChange={e => setNewItem(v => ({ ...v, spriteUrl: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-md text-xs text-white px-2 py-1.5 outline-none focus:border-[#9b5cff] lg:col-span-2" />
          <label className="flex items-center gap-1.5 text-xs text-white/60">
            <input type="checkbox" checked={newItem.active} onChange={e => setNewItem(v => ({ ...v, active: e.target.checked }))} /> Active (eligible for shop rotation)
          </label>
          <div className="flex gap-2 lg:col-span-4">
            <button disabled={creating} onClick={handleCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase bg-[#4ade80]/20 text-[#4ade80] hover:bg-[#4ade80]/30 disabled:opacity-50">
              <Save size={12} /> {creating ? 'Creating…' : 'Create Item'}
            </button>
            <button onClick={() => { setShowNewForm(false); setNewItem(BLANK_NEW_ITEM); }} className="px-3 py-1.5 rounded-md text-[11px] font-bold uppercase text-white/40 hover:text-white">Cancel</button>
          </div>
        </div>
      )}

      {shop && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2 text-[11px] text-white/40"><Clock size={12} /> Next rotation in {formatCountdown(remainingMs)}</div>
          <div className="flex flex-wrap gap-3">
            <ShopSlate title="Live Shop" subtitle="What players see now" itemKeys={shop.current.itemKeys} allItems={items}
              onAdd={k => handleSlateAdd('current', k)} onRemove={k => handleSlateRemove('current', k)} pending={slatePending} />
            <ShopSlate title="Next Rotation Queue" subtitle="Staged for when the timer hits 0" itemKeys={shop.next.itemKeys} allItems={items}
              onAdd={k => handleSlateAdd('next', k)} onRemove={k => handleSlateRemove('next', k)} pending={slatePending} />
          </div>
          <div className="flex gap-2 mt-2">
            <button disabled={slatePending} onClick={handleRegenerateNext} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-50">
              <RefreshCw size={12} /> Shuffle Queue
            </button>
            <button disabled={slatePending} onClick={handleRotateNow} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase bg-[#facc15]/15 text-[#facc15] hover:bg-[#facc15]/25 disabled:opacity-50">
              <Zap size={12} /> Rotate Now
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-white/40 text-sm py-10 text-center">Loading items…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-white/40 uppercase tracking-wider">
              <tr>
                <th className="px-2 py-2 text-left">Key</th>
                <th className="px-2 py-2 text-left">Name</th>
                <th className="px-2 py-2 text-left">Description</th>
                <th className="px-2 py-2 text-center">Rarity</th>
                <th className="px-2 py-2 text-center">Kind</th>
                <th className="px-2 py-2 text-center">Price</th>
                <th className="px-2 py-2 text-center">Active</th>
                <th className="px-2 py-2 text-center">Save</th>
                <th className="px-2 py-2 text-center">Delete</th>
              </tr>
            </thead>
            <tbody>
              {items.map(row => (
                <tr key={row.key} className={`border-t border-white/5 ${isDirty(row.key) ? 'bg-[#9b5cff]/5' : ''}`}>
                  <td className="px-2 py-1.5 text-white/40 font-mono">{row.key}</td>
                  <td className="px-2 py-1.5">
                    <input value={valueFor(row, 'name')} onChange={e => setEdit(row.key, 'name', e.target.value)}
                      className="w-32 bg-transparent border-b border-white/10 focus:border-[#9b5cff] text-white outline-none" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input value={valueFor(row, 'description')} onChange={e => setEdit(row.key, 'description', e.target.value)}
                      className="w-64 bg-transparent border-b border-white/10 focus:border-[#9b5cff] text-white/70 outline-none" />
                  </td>
                  <td className="px-2 py-1.5">
                    <select value={valueFor(row, 'rarity')} onChange={e => setEdit(row.key, 'rarity', e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-md text-[10px] font-bold uppercase px-1.5 py-1 outline-none"
                      style={{ color: RARITY_COLORS[valueFor(row, 'rarity') as ItemRarity] }}>
                      {RARITIES.map(r => <option key={r} value={r} className="bg-[#0d0e14] text-white normal-case">{r}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <select value={valueFor(row, 'kind')} onChange={e => setEdit(row.key, 'kind', e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-md text-[10px] px-1.5 py-1 outline-none text-white/60">
                      {KINDS.map(k => <option key={k} value={k} className="bg-[#0d0e14] normal-case">{k}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" value={valueFor(row, 'price')} onChange={e => setEdit(row.key, 'price', e.target.value)}
                      className="w-16 bg-transparent border-b border-white/10 focus:border-[#facc15] text-[#facc15] font-bold text-center outline-none" />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button onClick={() => handleToggleActive(row)}
                      className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase ${row.active ? 'bg-[#4ade80]/20 text-[#4ade80]' : 'bg-white/5 text-white/30'}`}>
                      {row.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button disabled={!isDirty(row.key) || savingKey === row.key} onClick={() => handleSave(row)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase ${isDirty(row.key) ? 'bg-[#9b5cff]/20 text-[#9b5cff] hover:bg-[#9b5cff]/30' : 'text-white/15 cursor-default'}`}>
                      <Save size={11} /> {savingKey === row.key ? '...' : 'Save'}
                    </button>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button onClick={() => handleDelete(row)} className="text-white/25 hover:text-red-400"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
