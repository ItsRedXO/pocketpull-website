import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Coins, Save, Trash2, Plus, Star, User } from 'lucide-react';
import {
  searchAdminBrawlUsers, getAdminBrawlUser, patchAdminBrawlProfile, adjustAdminBrawlWallet,
  grantAdminBrawlInstance, deleteAdminBrawlInstance, setAdminBrawlTeam, getAdminBrawlSpecies,
  type AdminBrawlProfile, type AdminBrawlInstance,
} from './brawlAdminApi';
import { typeColor } from '../pages/brawl/typeColors';
import { PokemonPortrait } from '../pages/brawl/PokemonPortrait';

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

function PokemonCard({ mon, selected, order, onToggle, onDelete }: { mon: AdminBrawlInstance; selected: boolean; order: number | null; onToggle: () => void; onDelete: () => void }) {
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
    </div>
  );
}

export function BrawlTrainersTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [profileEdits, setProfileEdits] = useState<Record<string, string>>({});
  const [teamSelection, setTeamSelection] = useState<string[]>([]);
  const [teamInitialized, setTeamInitialized] = useState(false);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletReason, setWalletReason] = useState('');
  const [grantSpeciesId, setGrantSpeciesId] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: searchData, isLoading: searching } = useQuery({ queryKey: ['admin-brawl-users-search', search], queryFn: () => searchAdminBrawlUsers(search) });
  const users = searchData?.users || [];

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ['admin-brawl-user-detail', selectedUserId],
    queryFn: () => getAdminBrawlUser(selectedUserId as string),
    enabled: !!selectedUserId,
  });
  const { data: speciesData } = useQuery({ queryKey: ['admin-brawl-species-all'], queryFn: getAdminBrawlSpecies, staleTime: 60_000 });
  const allSpecies = speciesData?.species || [];

  useEffect(() => {
    if (detail) {
      setProfileEdits({});
      setTeamSelection(detail.roster.filter(m => Number(m.is_on_team)).sort((a, b) => (a.team_slot || 0) - (b.team_slot || 0)).map(m => m.id));
      setTeamInitialized(true);
    } else {
      setTeamInitialized(false);
    }
  }, [detail?.user.id]);

  const refreshDetail = () => qc.invalidateQueries({ queryKey: ['admin-brawl-user-detail', selectedUserId] });

  const profileValue = (key: keyof AdminBrawlProfile) => profileEdits[key] ?? String(detail?.profile[key] ?? '');
  const profileDirty = Object.keys(profileEdits).length > 0;

  const handleSaveProfile = async () => {
    if (!selectedUserId || !profileDirty) return;
    setSaving(true);
    try {
      const fields: Record<string, number> = {};
      for (const [k, v] of Object.entries(profileEdits)) fields[k] = Number(v);
      await patchAdminBrawlProfile(selectedUserId, fields as any);
      setProfileEdits({});
      refreshDetail();
      showToast('Profile updated');
    } catch (e: any) { showToast(e.message || 'Failed to update profile', false); } finally { setSaving(false); }
  };

  const handleWalletApply = async () => {
    if (!selectedUserId) return;
    const amount = Number(walletAmount);
    if (!Number.isFinite(amount) || amount === 0) return;
    setSaving(true);
    try {
      await adjustAdminBrawlWallet(selectedUserId, Math.round(amount), walletReason || undefined);
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
    if (!selectedUserId || teamSelection.length < 1) return;
    setSaving(true);
    try {
      await setAdminBrawlTeam(selectedUserId, teamSelection);
      refreshDetail();
      showToast('Team updated');
    } catch (e: any) { showToast(e.message || 'Failed to update team', false); } finally { setSaving(false); }
  };

  const handleDeleteInstance = async (instanceId: string) => {
    if (!selectedUserId) return;
    try {
      await deleteAdminBrawlInstance(selectedUserId, instanceId);
      setTeamSelection(prev => prev.filter(id => id !== instanceId));
      refreshDetail();
      showToast('Pokemon removed');
    } catch (e: any) { showToast(e.message || 'Failed to remove Pokemon', false); }
  };

  const handleGrant = async () => {
    if (!selectedUserId) return;
    const id = Number(grantSpeciesId);
    if (!Number.isInteger(id)) return;
    setSaving(true);
    try {
      await grantAdminBrawlInstance(selectedUserId, id);
      setGrantSpeciesId('');
      refreshDetail();
      showToast('Pokemon granted');
    } catch (e: any) { showToast(e.message || 'Failed to grant Pokemon', false); } finally { setSaving(false); }
  };

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4">
      <div>
        <div className="relative mb-2">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search username or user id"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30" />
        </div>
        <div className="rounded-xl border border-white/10 overflow-hidden max-h-[520px] overflow-y-auto">
          {searching ? (
            <div className="text-white/30 text-xs py-6 text-center">Searching…</div>
          ) : users.length === 0 ? (
            <div className="text-white/30 text-xs py-6 text-center">No trainers found.</div>
          ) : users.map(u => (
            <button key={u.user_id} onClick={() => setSelectedUserId(u.user_id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-white/5 last:border-b-0 ${selectedUserId === u.user_id ? 'bg-[#9b5cff]/15' : 'hover:bg-white/[0.04]'}`}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#1b1d2a] text-[10px] font-bold text-[#00c8ff]">
                {u.avatar_url ? <img src={u.avatar_url} alt="" className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <User size={12} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">{u.username || u.user_id}</div>
                <div className="text-[10px] text-white/40">{u.league_rating} rating · {u.wins}-{u.losses} · {u.roster_count} owned</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        {!selectedUserId ? (
          <div className="text-white/30 text-sm py-24 text-center border border-dashed border-white/10 rounded-xl">Select a trainer to view and edit their Poke Brawl data.</div>
        ) : loadingDetail || !detail ? (
          <div className="text-white/40 text-sm py-24 text-center">Loading trainer…</div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#00c8ff]/40 bg-[#1b1d2a] text-sm font-bold text-[#00c8ff]">
                {detail.user.avatar_url ? <img src={detail.user.avatar_url} alt="" className="h-full w-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} /> : (detail.user.username || 'T').slice(0, 1).toUpperCase()}
              </span>
              <div>
                <div className="text-base font-bold text-white">{detail.user.username || 'Trainer'}</div>
                <div className="text-[10px] text-white/30">{detail.user.id}</div>
              </div>
            </div>

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
                      onToggle={() => handleToggleTeam(mon.id)} onDelete={() => handleDeleteInstance(mon.id)} />;
                  })}
                </div>
              )}
              <div className="flex gap-2 mt-3 flex-wrap items-center">
                <select value={grantSpeciesId} onChange={e => setGrantSpeciesId(e.target.value)}
                  className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white max-w-[220px]">
                  <option value="">Grant a Pokemon…</option>
                  {allSpecies.map(s => <option key={s.id} value={s.id}>{s.name} (OVR {s.overall_rating})</option>)}
                </select>
                <button onClick={handleGrant} disabled={!grantSpeciesId || saving} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-bold disabled:opacity-30">
                  <Plus size={12} /> Grant
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
