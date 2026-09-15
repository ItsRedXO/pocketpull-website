import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Swords, Coins, Save, Trash2, Plus, Star, ChevronDown, RotateCcw, Package } from 'lucide-react';
import {
  getAdminBrawlUser, patchAdminBrawlProfile, adjustAdminBrawlWallet,
  grantAdminBrawlInstance, deleteAdminBrawlInstance, setAdminBrawlInstanceStar, setAdminBrawlTeam, getAdminBrawlSpecies,
  getAdminBrawlUserItems, grantAdminBrawlUserItem, removeAdminBrawlUserItem, getAdminBrawlItems,
  type AdminBrawlProfile, type AdminBrawlInstance, type AdminBrawlSpecies, type AdminBrawlItem,
} from './brawlAdminApi';
import { typeColor } from '../pages/brawl/typeColors';
import { PokemonPortrait } from '../pages/brawl/PokemonPortrait';

const MAX_STAR_LEVEL = 3;

const PROFILE_FIELDS: { key: keyof AdminBrawlProfile; label: string }[] = [
  { key: 'league_rating', label: 'Global Rating' },
  { key: 'wins', label: 'Wins' },
  { key: 'losses', label: 'Losses' },
  { key: 'local_battles_played', label: 'Local Battles Played' },
  { key: 'local_tournament_wins', label: 'Local Tournament Wins' },
  { key: 'state_tournament_wins', label: 'State Tournament Wins' },
  { key: 'regional_tournament_wins', label: 'Regional Tournament Wins' },
  { key: 'elite_four_wins', label: 'Elite Four Wins' },
];

function StarEditor({ level, onSet }: { level: number; onSet: (level: number) => void }) {
  return (
    <div className="flex items-center gap-0.5 mt-0.5">
      {Array.from({ length: MAX_STAR_LEVEL }, (_, i) => {
        const n = i + 1;
        return (
          <button key={n} type="button" onClick={e => { e.stopPropagation(); onSet(level === n ? n - 1 : n); }}
            title={`Set to ${n} star${n > 1 ? 's' : ''}`} className="p-px">
            <Star size={9} fill={n <= level ? '#facc15' : 'none'} className={n <= level ? 'text-[#facc15]' : 'text-white/20 hover:text-white/40'} />
          </button>
        );
      })}
      {level > 0 && (
        <button type="button" onClick={e => { e.stopPropagation(); onSet(0); }} title="Reset to 0 stars" className="ml-0.5 text-white/20 hover:text-red-400">
          <RotateCcw size={9} />
        </button>
      )}
    </div>
  );
}

function PokemonCard({ mon, selected, order, onToggle, onDelete, onSetStar }: {
  mon: AdminBrawlInstance; selected: boolean; order: number | null; onToggle: () => void; onDelete: () => void; onSetStar: (level: number) => void;
}) {
  return (
    <div className={`relative rounded-lg border p-2 flex flex-col items-center transition-colors ${selected ? 'border-[#00c8ff] bg-[#00c8ff]/10' : 'border-white/10 bg-white/[0.03] hover:border-white/20'}`}>
      {selected && <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-[#00c8ff] text-black text-[9px] font-bold flex items-center justify-center">{order}</span>}
      <button onClick={onDelete} className="absolute top-1 right-1 text-white/20 hover:text-red-400" title="Remove from roster"><Trash2 size={11} /></button>
      <button onClick={onToggle}>
        <PokemonPortrait artworkUrl={mon.artwork_url} alt={mon.name} scale={mon.portrait_scale} offsetX={mon.portrait_offset_x} offsetY={mon.portrait_offset_y} className="w-12 h-12 rounded-lg bg-black/20" />
      </button>
      <div className="text-[9px] font-bold text-white capitalize mt-1 truncate w-full text-center">{mon.name}</div>
      <span className="text-[7px] px-1 py-0.5 rounded-full uppercase font-bold mt-0.5" style={{ background: `${typeColor(mon.primary_type)}30`, color: typeColor(mon.primary_type) }}>{mon.primary_type}</span>
      <div className="text-[8px] text-[#00c8ff] font-bold mt-0.5">OVR {mon.overall_rating}</div>
      <StarEditor level={mon.star_level} onSet={onSetStar} />
    </div>
  );
}

function SpeciesPicker({ species, value, onChange }: { species: AdminBrawlSpecies[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = species.find(s => String(s.id) === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return species;
    return species.filter(s => s.name.toLowerCase().includes(q));
  }, [species, query]);

  return (
    <div className="relative" ref={rootRef}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs min-w-[220px] hover:border-white/20 transition-colors">
        <span className={selected ? 'text-white font-bold' : 'text-white/40'}>{selected ? `${selected.name} (OVR ${selected.overall_rating})` : 'Grant a Pokemon…'}</span>
        <ChevronDown size={13} className="text-white/40 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-72 rounded-lg border border-white/10 shadow-2xl overflow-hidden" style={{ background: '#14151f' }}>
          <div className="p-2 border-b border-white/10">
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search species…"
              className="w-full px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 outline-none focus:border-[#9b5cff]" />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-white/30 text-center">No species match "{query}"</div>
            ) : filtered.map(s => (
              <button key={s.id} type="button" onClick={() => { onChange(String(s.id)); setOpen(false); setQuery(''); }}
                className={`w-full flex items-center justify-between text-left px-3 py-1.5 text-xs capitalize ${String(s.id) === value ? 'bg-[#9b5cff]/20 text-[#9b5cff] font-bold' : 'text-white/80 hover:bg-white/5'}`}>
                <span>{s.name}</span>
                <span className="text-[10px] text-[#00c8ff] font-bold">OVR {s.overall_rating}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemPicker({ items, value, onChange }: { items: AdminBrawlItem[]; value: string; onChange: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = items.find(i => i.key === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => i.name.toLowerCase().includes(q) || i.key.includes(q));
  }, [items, query]);

  return (
    <div className="relative" ref={rootRef}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs min-w-[220px] hover:border-white/20 transition-colors">
        <span className={selected ? 'text-white font-bold' : 'text-white/40'}>{selected ? `${selected.name} (${selected.rarity})` : 'Grant an item…'}</span>
        <ChevronDown size={13} className="text-white/40 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-72 rounded-lg border border-white/10 shadow-2xl overflow-hidden" style={{ background: '#14151f' }}>
          <div className="p-2 border-b border-white/10">
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search items…"
              className="w-full px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 outline-none focus:border-[#9b5cff]" />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-white/30 text-center">No items match "{query}"</div>
            ) : filtered.map(i => (
              <button key={i.key} type="button" onClick={() => { onChange(i.key); setOpen(false); setQuery(''); }}
                className={`w-full flex items-center justify-between text-left px-3 py-1.5 text-xs ${i.key === value ? 'bg-[#9b5cff]/20 text-[#9b5cff] font-bold' : 'text-white/80 hover:bg-white/5'}`}>
                <span>{i.name}{!i.active && <span className="text-white/30"> (inactive)</span>}</span>
                <span className="text-[10px] text-[#facc15] font-bold capitalize">{i.rarity}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface UserPokeBrawlSectionProps {
  userId: string;
  showToast: (m: string, ok?: boolean) => void;
}

export function UserPokeBrawlSection({ userId, showToast }: UserPokeBrawlSectionProps) {
  const qc = useQueryClient();
  const [profileEdits, setProfileEdits] = useState<Record<string, string>>({});
  const [teamSelection, setTeamSelection] = useState<string[]>([]);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletReason, setWalletReason] = useState('');
  const [grantSpeciesId, setGrantSpeciesId] = useState('');
  const [grantItemKey, setGrantItemKey] = useState('');
  const [grantItemQty, setGrantItemQty] = useState('1');
  const [saving, setSaving] = useState(false);

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['admin-brawl-user-detail', userId],
    queryFn: () => getAdminBrawlUser(userId),
  });
  const { data: speciesData } = useQuery({ queryKey: ['admin-brawl-species-all'], queryFn: getAdminBrawlSpecies, staleTime: 60_000 });
  const allSpecies = speciesData?.species || [];
  const { data: itemsData } = useQuery({ queryKey: ['admin-brawl-items-all'], queryFn: getAdminBrawlItems, staleTime: 60_000 });
  const allItems = itemsData?.items || [];
  const { data: userItemsData, isLoading: loadingUserItems } = useQuery({
    queryKey: ['admin-brawl-user-items', userId],
    queryFn: () => getAdminBrawlUserItems(userId),
  });
  const userItems = userItemsData?.inventory || [];

  useEffect(() => {
    if (detail) {
      setProfileEdits({});
      setTeamSelection(detail.roster.filter(m => Number(m.is_on_team)).sort((a, b) => (a.team_slot || 0) - (b.team_slot || 0)).map(m => m.id));
    }
  }, [detail?.user.id]);

  useEffect(() => { setGrantItemKey(''); setGrantItemQty('1'); }, [userId]);

  const refreshDetail = () => qc.invalidateQueries({ queryKey: ['admin-brawl-user-detail', userId] });
  const refreshUserItems = () => qc.invalidateQueries({ queryKey: ['admin-brawl-user-items', userId] });

  const profileValue = (key: keyof AdminBrawlProfile) => profileEdits[key] ?? String(detail?.profile[key] ?? '');
  const profileDirty = Object.keys(profileEdits).length > 0;

  const handleSaveProfile = async () => {
    if (!profileDirty) return;
    setSaving(true);
    try {
      const fields: Record<string, number> = {};
      for (const [k, v] of Object.entries(profileEdits)) fields[k] = Number(v);
      await patchAdminBrawlProfile(userId, fields as any);
      setProfileEdits({});
      refreshDetail();
      showToast('Profile updated');
    } catch (e: any) { showToast(e.message || 'Failed to update profile', false); } finally { setSaving(false); }
  };

  const handleWalletApply = async () => {
    const amount = Number(walletAmount);
    if (!Number.isFinite(amount) || amount === 0) return;
    setSaving(true);
    try {
      await adjustAdminBrawlWallet(userId, Math.round(amount), walletReason || undefined);
      setWalletAmount(''); setWalletReason('');
      refreshDetail();
      showToast('Wallet updated');
    } catch (e: any) { showToast(e.message || 'Failed to adjust wallet', false); } finally { setSaving(false); }
  };

  const handleToggleTeam = (instanceId: string) => {
    setTeamSelection(prev => {
      if (prev.includes(instanceId)) return prev.filter(id => id !== instanceId);
      if (prev.length >= 6) { showToast('Active team is full (6/6)', false); return prev; }
      return [...prev, instanceId];
    });
  };

  const teamDirty = useMemo(() => {
    if (!detail) return false;
    const current = detail.roster.filter(m => Number(m.is_on_team)).map(m => m.id).sort().join(',');
    return teamSelection.slice().sort().join(',') !== current;
  }, [detail, teamSelection]);

  const handleSaveTeam = async () => {
    if (teamSelection.length < 1) return;
    setSaving(true);
    try {
      await setAdminBrawlTeam(userId, teamSelection);
      refreshDetail();
      showToast('Team updated');
    } catch (e: any) { showToast(e.message || 'Failed to update team', false); } finally { setSaving(false); }
  };

  const handleDeleteInstance = async (instanceId: string) => {
    try {
      await deleteAdminBrawlInstance(userId, instanceId);
      setTeamSelection(prev => prev.filter(id => id !== instanceId));
      refreshDetail();
      showToast('Pokemon removed');
    } catch (e: any) { showToast(e.message || 'Failed to remove Pokemon', false); }
  };

  const handleGrant = async () => {
    const id = Number(grantSpeciesId);
    if (!Number.isInteger(id)) return;
    setSaving(true);
    try {
      await grantAdminBrawlInstance(userId, id);
      setGrantSpeciesId('');
      refreshDetail();
      showToast('Pokemon granted');
    } catch (e: any) { showToast(e.message || 'Failed to grant Pokemon', false); } finally { setSaving(false); }
  };

  const handleSetStar = async (instanceId: string, level: number) => {
    try {
      await setAdminBrawlInstanceStar(userId, instanceId, level);
      refreshDetail();
      showToast(level === 0 ? 'Stars reset' : `Set to ${level}★`);
    } catch (e: any) { showToast(e.message || 'Failed to update star level', false); }
  };

  const handleGrantItem = async () => {
    if (!grantItemKey) return;
    const qty = Math.max(1, Math.round(Number(grantItemQty) || 1));
    setSaving(true);
    try {
      await grantAdminBrawlUserItem(userId, grantItemKey, qty);
      setGrantItemKey(''); setGrantItemQty('1');
      refreshUserItems();
      showToast('Item granted');
    } catch (e: any) { showToast(e.message || 'Failed to grant item', false); } finally { setSaving(false); }
  };

  const handleRemoveItem = async (itemKey: string) => {
    try {
      await removeAdminBrawlUserItem(userId, itemKey);
      refreshUserItems();
      showToast('Item removed');
    } catch (e: any) { showToast(e.message || 'Failed to remove item', false); }
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <h4 className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-display flex items-center gap-2 mb-3">
        <Swords size={12} className="text-[#9b5cff]" />
        Poke Brawl
      </h4>

      {loadingDetail || !detail ? (
        <div className="text-white/40 text-sm py-10 text-center">Loading trainer data…</div>
      ) : (
        <div className="space-y-4">
          {/* Wallet */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold uppercase tracking-widest text-white/40">Pokedollar Wallet</div>
              <div className="flex items-center gap-1.5 text-[#facc15] font-bold text-sm"><Coins size={13} /> {detail.balance.toLocaleString()}</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <input type="number" value={walletAmount} onChange={e => setWalletAmount(e.target.value)} placeholder="+/- amount"
                className="w-32 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30" />
              <input value={walletReason} onChange={e => setWalletReason(e.target.value)} placeholder="Reason (optional)"
                className="flex-1 min-w-[140px] px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30" />
              <button onClick={handleWalletApply} disabled={saving || !walletAmount} className="px-3 py-1.5 rounded-lg bg-[#facc15]/20 text-[#facc15] text-xs font-bold disabled:opacity-30">Apply</button>
            </div>
          </div>

          {/* Profile stats */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold uppercase tracking-widest text-white/40">Profile Stats</div>
              <button onClick={handleSaveProfile} disabled={!profileDirty || saving}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${profileDirty ? 'bg-[#9b5cff]/20 text-[#9b5cff]' : 'text-white/15'}`}>
                <Save size={11} /> Save
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PROFILE_FIELDS.map(f => (
                <label key={f.key} className="block">
                  <div className="text-[9px] text-white/40 mb-0.5">{f.label}</div>
                  <input type="number" value={profileValue(f.key)} onChange={e => setProfileEdits(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-white" />
                </label>
              ))}
            </div>
          </div>

          {/* Roster */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/40"><Star size={12} /> Roster ({detail.roster.length}) — click to toggle active team</div>
              <button onClick={handleSaveTeam} disabled={!teamDirty || saving || teamSelection.length < 1}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${teamDirty ? 'bg-[#00c8ff]/20 text-[#00c8ff]' : 'text-white/15'}`}>
                <Save size={11} /> Save Team ({teamSelection.length}/6)
              </button>
            </div>
            {detail.roster.length === 0 ? (
              <p className="text-white/30 text-xs py-4 text-center">This trainer owns no Pokemon yet.</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {detail.roster.map(mon => {
                  const idx = teamSelection.indexOf(mon.id);
                  return <PokemonCard key={mon.id} mon={mon} selected={idx !== -1} order={idx !== -1 ? idx + 1 : null}
                    onToggle={() => handleToggleTeam(mon.id)} onDelete={() => handleDeleteInstance(mon.id)} onSetStar={level => handleSetStar(mon.id, level)} />;
                })}
              </div>
            )}
            <div className="flex gap-2 mt-3 flex-wrap items-center">
              <SpeciesPicker species={allSpecies} value={grantSpeciesId} onChange={setGrantSpeciesId} />
              <button onClick={handleGrant} disabled={!grantSpeciesId || saving} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-bold disabled:opacity-30">
                <Plus size={12} /> Grant
              </button>
            </div>
          </div>

          {/* Items */}
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/40"><Package size={12} /> Items ({userItems.length})</div>
            </div>
            {loadingUserItems ? (
              <p className="text-white/30 text-xs py-4 text-center">Loading items…</p>
            ) : userItems.length === 0 ? (
              <p className="text-white/30 text-xs py-4 text-center">This trainer owns no items yet.</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {userItems.map(entry => (
                  <div key={entry.itemKey} className="relative rounded-lg border border-white/10 bg-white/[0.03] hover:border-white/20 p-2 flex flex-col items-center transition-colors">
                    <button onClick={() => handleRemoveItem(entry.itemKey)} className="absolute top-1 right-1 text-white/20 hover:text-red-400" title="Remove item">
                      <Trash2 size={11} />
                    </button>
                    <div className="w-12 h-12 rounded-lg bg-black/20 flex items-center justify-center">
                      {entry.item.spriteUrl ? (
                        <img src={entry.item.spriteUrl} alt={entry.item.name} className="w-8 h-8 object-contain" style={{ imageRendering: 'pixelated' }} />
                      ) : <Package size={16} className="text-white/20" />}
                    </div>
                    <div className="text-[9px] font-bold text-white mt-1 truncate w-full text-center">{entry.item.name}</div>
                    <span className="text-[7px] px-1 py-0.5 rounded-full uppercase font-bold mt-0.5 capitalize" style={{ background: entry.item.rarity === 'rare' ? 'rgba(250,204,21,0.2)' : entry.item.rarity === 'uncommon' ? 'rgba(74,222,128,0.2)' : 'rgba(136,146,164,0.2)', color: entry.item.rarity === 'rare' ? '#facc15' : entry.item.rarity === 'uncommon' ? '#4ade80' : '#8892a4' }}>{entry.item.rarity}</span>
                    <div className="text-[8px] text-[#00c8ff] font-bold mt-0.5">×{entry.quantity}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 mt-3 flex-wrap items-center">
              <ItemPicker items={allItems} value={grantItemKey} onChange={setGrantItemKey} />
              <input type="number" min={1} value={grantItemQty} onChange={e => setGrantItemQty(e.target.value)}
                className="w-16 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white" />
              <button onClick={handleGrantItem} disabled={!grantItemKey || saving} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-bold disabled:opacity-30">
                <Plus size={12} /> Grant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
