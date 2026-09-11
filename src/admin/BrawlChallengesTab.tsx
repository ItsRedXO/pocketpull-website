import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, Trash2, Target } from 'lucide-react';
import {
  getAdminBrawlChallengeTemplates, createAdminBrawlChallengeTemplate, updateAdminBrawlChallengeTemplate, deleteAdminBrawlChallengeTemplate,
  type AdminChallengeTemplate, type ChallengeTemplateType, type ChallengeRewardKind,
} from './brawlAdminApi';

const TYPES: ChallengeTemplateType[] = ['win_matches', 'win_tournament', 'evolve_pokemon', 'open_safari', 'win_mono_type'];
const REWARD_KINDS: ChallengeRewardKind[] = ['pokedollars', 'pokemon'];
const TYPE_LABELS: Record<ChallengeTemplateType, string> = {
  win_matches: 'Win Matches', win_tournament: 'Win Tournament', evolve_pokemon: 'Evolve Pokemon', open_safari: 'Open Safari Zone', win_mono_type: 'Win Mono-Type Battle',
};

interface NewTemplateFields {
  key: string; type: ChallengeTemplateType; label: string; description: string; target: string;
  reward_kind: ChallengeRewardKind; reward_amount: string; reward_overall_min: string; reward_overall_max: string; fixed_type: string; active: boolean;
}
const BLANK_NEW_TEMPLATE: NewTemplateFields = {
  key: '', type: 'win_matches', label: '', description: '', target: '1',
  reward_kind: 'pokedollars', reward_amount: '', reward_overall_min: '', reward_overall_max: '', fixed_type: '', active: true,
};

export function BrawlChallengesTab({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-brawl-challenges'], queryFn: getAdminBrawlChallengeTemplates, staleTime: 15000 });
  const templates = data?.templates || [];

  const [edits, setEdits] = useState<Record<string, Record<string, string>>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState<NewTemplateFields>(BLANK_NEW_TEMPLATE);
  const [creating, setCreating] = useState(false);

  const setEdit = (key: string, field: string, value: string) => setEdits(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  const rowEdits = (key: string) => edits[key] || {};
  const valueFor = (row: AdminChallengeTemplate, field: string) => rowEdits(row.key)[field] ?? String((row as any)[field] ?? '');
  const isDirty = (key: string) => Object.keys(edits[key] || {}).length > 0;

  const handleSave = async (row: AdminChallengeTemplate) => {
    const changes = rowEdits(row.key);
    if (!Object.keys(changes).length) return;
    setSavingKey(row.key);
    try {
      const numericKeys = new Set(['target', 'reward_amount', 'reward_overall_min', 'reward_overall_max']);
      const fields: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(changes)) fields[k] = numericKeys.has(k) ? (v === '' ? null : Number(v)) : (k === 'fixed_type' && v === '' ? null : v);
      const res = await updateAdminBrawlChallengeTemplate(row.key, fields);
      qc.setQueryData<{ templates: AdminChallengeTemplate[] }>(['admin-brawl-challenges'], prev => ({ templates: (prev?.templates || []).map(t => (t.key === res.template.key ? res.template : t)) }));
      setEdits(prev => { const next = { ...prev }; delete next[row.key]; return next; });
      showToast(`${res.template.label} updated`);
    } catch (e: any) {
      showToast(e.message || 'Failed to save', false);
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggleActive = async (row: AdminChallengeTemplate) => {
    try {
      const res = await updateAdminBrawlChallengeTemplate(row.key, { active: !row.active });
      qc.setQueryData<{ templates: AdminChallengeTemplate[] }>(['admin-brawl-challenges'], prev => ({ templates: (prev?.templates || []).map(t => (t.key === res.template.key ? res.template : t)) }));
      showToast(`${res.template.label} ${res.template.active ? 'activated' : 'deactivated'}`);
    } catch (e: any) {
      showToast(e.message || 'Failed to update', false);
    }
  };

  const handleDelete = async (row: AdminChallengeTemplate) => {
    if (!window.confirm(`Delete "${row.label}"? This can't be undone. Players with it already locked in keep their progress -- only future offers stop including it.`)) return;
    try {
      await deleteAdminBrawlChallengeTemplate(row.key);
      qc.setQueryData<{ templates: AdminChallengeTemplate[] }>(['admin-brawl-challenges'], prev => ({ templates: (prev?.templates || []).filter(t => t.key !== row.key) }));
      showToast(`${row.label} deleted`);
    } catch (e: any) {
      showToast(e.message || 'Failed to delete', false);
    }
  };

  const handleCreate = async () => {
    const target = Number(newTemplate.target);
    if (!newTemplate.key.trim() || !newTemplate.label.trim() || !newTemplate.description.trim() || !Number.isInteger(target) || target < 1) {
      showToast('Key, label, description, and a valid target are required', false);
      return;
    }
    if (newTemplate.reward_kind === 'pokedollars' && !Number(newTemplate.reward_amount)) {
      showToast('reward_amount is required for pokedollar rewards', false);
      return;
    }
    if (newTemplate.reward_kind === 'pokemon' && (!Number(newTemplate.reward_overall_min) || !Number(newTemplate.reward_overall_max))) {
      showToast('reward_overall_min and reward_overall_max are required for pokemon rewards', false);
      return;
    }
    setCreating(true);
    try {
      const res = await createAdminBrawlChallengeTemplate({
        key: newTemplate.key.trim().toLowerCase(), type: newTemplate.type, label: newTemplate.label.trim(), description: newTemplate.description.trim(), target,
        reward_kind: newTemplate.reward_kind,
        reward_amount: newTemplate.reward_kind === 'pokedollars' ? Number(newTemplate.reward_amount) : null,
        reward_overall_min: newTemplate.reward_kind === 'pokemon' ? Number(newTemplate.reward_overall_min) : null,
        reward_overall_max: newTemplate.reward_kind === 'pokemon' ? Number(newTemplate.reward_overall_max) : null,
        fixed_type: newTemplate.fixed_type.trim() || null,
        active: newTemplate.active,
      });
      qc.setQueryData<{ templates: AdminChallengeTemplate[] }>(['admin-brawl-challenges'], prev => ({ templates: [...(prev?.templates || []), res.template] }));
      setNewTemplate(BLANK_NEW_TEMPLATE);
      setShowNewForm(false);
      showToast(`${res.template.label} created`);
    } catch (e: any) {
      showToast(e.message || 'Failed to create challenge', false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-[#9b5cff]" />
          <h2 className="font-display text-sm uppercase tracking-widest text-white/70">Poke Brawl — Challenges</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full text-white/40 bg-white/5">{templates.length} templates</span>
        </div>
        <button onClick={() => setShowNewForm(v => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase bg-[#9b5cff]/20 text-[#9b5cff] hover:bg-[#9b5cff]/30">
          <Plus size={13} /> New Challenge
        </button>
      </div>

      <p className="text-[11px] text-white/30 mb-4">Only active templates are offered to players. Editing or deleting a template never touches a challenge a player already picked -- that's a locked-in snapshot. Use <code className="text-[#00c8ff]">{'{Type}'}</code> / <code className="text-[#00c8ff]">{'{type}'}</code> in label/description for Win Mono-Type challenges to interpolate the rolled type.</p>

      {showNewForm && (
        <div className="rounded-xl border border-[#9b5cff]/30 bg-[#9b5cff]/5 p-3 mb-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <input placeholder="key (e.g. win-10-battles)" value={newTemplate.key} onChange={e => setNewTemplate(v => ({ ...v, key: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-md text-xs text-white px-2 py-1.5 outline-none focus:border-[#9b5cff]" />
          <select value={newTemplate.type} onChange={e => setNewTemplate(v => ({ ...v, type: e.target.value as ChallengeTemplateType }))}
            className="bg-white/5 border border-white/10 rounded-md text-xs text-white px-2 py-1.5 outline-none focus:border-[#9b5cff]">
            {TYPES.map(t => <option key={t} value={t} className="bg-[#0d0e14]">{TYPE_LABELS[t]}</option>)}
          </select>
          <input type="number" min={1} placeholder="Target" value={newTemplate.target} onChange={e => setNewTemplate(v => ({ ...v, target: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-md text-xs text-white px-2 py-1.5 outline-none focus:border-[#9b5cff]" />
          <input placeholder="Fixed type (optional, e.g. fire)" value={newTemplate.fixed_type} onChange={e => setNewTemplate(v => ({ ...v, fixed_type: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-md text-xs text-white px-2 py-1.5 outline-none focus:border-[#9b5cff]" />
          <input placeholder="Label" value={newTemplate.label} onChange={e => setNewTemplate(v => ({ ...v, label: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-md text-xs text-white px-2 py-1.5 outline-none focus:border-[#9b5cff] lg:col-span-2" />
          <input placeholder="Description" value={newTemplate.description} onChange={e => setNewTemplate(v => ({ ...v, description: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-md text-xs text-white px-2 py-1.5 outline-none focus:border-[#9b5cff] lg:col-span-2" />
          <select value={newTemplate.reward_kind} onChange={e => setNewTemplate(v => ({ ...v, reward_kind: e.target.value as ChallengeRewardKind }))}
            className="bg-white/5 border border-white/10 rounded-md text-xs text-white px-2 py-1.5 outline-none focus:border-[#9b5cff]">
            {REWARD_KINDS.map(r => <option key={r} value={r} className="bg-[#0d0e14]">{r}</option>)}
          </select>
          {newTemplate.reward_kind === 'pokedollars' ? (
            <input type="number" placeholder="Reward amount" value={newTemplate.reward_amount} onChange={e => setNewTemplate(v => ({ ...v, reward_amount: e.target.value }))}
              className="bg-white/5 border border-white/10 rounded-md text-xs text-white px-2 py-1.5 outline-none focus:border-[#facc15]" />
          ) : (
            <>
              <input type="number" placeholder="Reward OVR min" value={newTemplate.reward_overall_min} onChange={e => setNewTemplate(v => ({ ...v, reward_overall_min: e.target.value }))}
                className="bg-white/5 border border-white/10 rounded-md text-xs text-white px-2 py-1.5 outline-none focus:border-[#00c8ff]" />
              <input type="number" placeholder="Reward OVR max" value={newTemplate.reward_overall_max} onChange={e => setNewTemplate(v => ({ ...v, reward_overall_max: e.target.value }))}
                className="bg-white/5 border border-white/10 rounded-md text-xs text-white px-2 py-1.5 outline-none focus:border-[#00c8ff]" />
            </>
          )}
          <label className="flex items-center gap-1.5 text-xs text-white/60">
            <input type="checkbox" checked={newTemplate.active} onChange={e => setNewTemplate(v => ({ ...v, active: e.target.checked }))} /> Active (eligible to be offered)
          </label>
          <div className="flex gap-2 lg:col-span-4">
            <button disabled={creating} onClick={handleCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase bg-[#4ade80]/20 text-[#4ade80] hover:bg-[#4ade80]/30 disabled:opacity-50">
              <Save size={12} /> {creating ? 'Creating…' : 'Create Challenge'}
            </button>
            <button onClick={() => { setShowNewForm(false); setNewTemplate(BLANK_NEW_TEMPLATE); }} className="px-3 py-1.5 rounded-md text-[11px] font-bold uppercase text-white/40 hover:text-white">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-white/40 text-sm py-10 text-center">Loading challenges…</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-white/5 text-white/40 uppercase tracking-wider">
              <tr>
                <th className="px-2 py-2 text-left">Key</th>
                <th className="px-2 py-2 text-left">Type</th>
                <th className="px-2 py-2 text-left">Label</th>
                <th className="px-2 py-2 text-left">Description</th>
                <th className="px-2 py-2 text-center">Target</th>
                <th className="px-2 py-2 text-center">Reward</th>
                <th className="px-2 py-2 text-center">Fixed Type</th>
                <th className="px-2 py-2 text-center">Active</th>
                <th className="px-2 py-2 text-center">Save</th>
                <th className="px-2 py-2 text-center">Delete</th>
              </tr>
            </thead>
            <tbody>
              {templates.map(row => {
                const rewardKind = valueFor(row, 'reward_kind') as ChallengeRewardKind;
                return (
                  <tr key={row.key} className={`border-t border-white/5 ${isDirty(row.key) ? 'bg-[#9b5cff]/5' : ''}`}>
                    <td className="px-2 py-1.5 text-white/40 font-mono">{row.key}</td>
                    <td className="px-2 py-1.5">
                      <select value={valueFor(row, 'type')} onChange={e => setEdit(row.key, 'type', e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-md text-[10px] px-1.5 py-1 outline-none text-white/60">
                        {TYPES.map(t => <option key={t} value={t} className="bg-[#0d0e14] normal-case">{TYPE_LABELS[t]}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={valueFor(row, 'label')} onChange={e => setEdit(row.key, 'label', e.target.value)}
                        className="w-40 bg-transparent border-b border-white/10 focus:border-[#9b5cff] text-white outline-none" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input value={valueFor(row, 'description')} onChange={e => setEdit(row.key, 'description', e.target.value)}
                        className="w-64 bg-transparent border-b border-white/10 focus:border-[#9b5cff] text-white/70 outline-none" />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min={1} value={valueFor(row, 'target')} onChange={e => setEdit(row.key, 'target', e.target.value)}
                        className="w-12 bg-transparent border-b border-white/10 focus:border-[#00c8ff] text-[#00c8ff] font-bold text-center outline-none" />
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1 justify-center">
                        <select value={rewardKind} onChange={e => setEdit(row.key, 'reward_kind', e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-md text-[10px] px-1 py-1 outline-none text-white/60">
                          {REWARD_KINDS.map(r => <option key={r} value={r} className="bg-[#0d0e14]">{r}</option>)}
                        </select>
                        {rewardKind === 'pokedollars' ? (
                          <input type="number" value={valueFor(row, 'reward_amount')} onChange={e => setEdit(row.key, 'reward_amount', e.target.value)}
                            className="w-16 bg-transparent border-b border-white/10 focus:border-[#facc15] text-[#facc15] font-bold text-center outline-none" />
                        ) : (
                          <>
                            <input type="number" value={valueFor(row, 'reward_overall_min')} onChange={e => setEdit(row.key, 'reward_overall_min', e.target.value)}
                              className="w-10 bg-transparent border-b border-white/10 focus:border-[#00c8ff] text-[#00c8ff] text-center outline-none" />
                            <span className="text-white/20">–</span>
                            <input type="number" value={valueFor(row, 'reward_overall_max')} onChange={e => setEdit(row.key, 'reward_overall_max', e.target.value)}
                              className="w-10 bg-transparent border-b border-white/10 focus:border-[#00c8ff] text-[#00c8ff] text-center outline-none" />
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <input placeholder="random" value={valueFor(row, 'fixed_type')} onChange={e => setEdit(row.key, 'fixed_type', e.target.value)}
                        className="w-16 bg-transparent border-b border-white/10 focus:border-[#9b5cff] text-white/60 text-center outline-none" />
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
