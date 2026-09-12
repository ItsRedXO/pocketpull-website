import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Save, Package, Sparkles, Users } from 'lucide-react';
import { fetchSiteSettings, patchSiteSettings } from './siteSettingsAdminApi';
import { getSimulatedLivePlayers } from '../lib/livePlayers';
import { getDailyIncrementalValue } from '../lib/simulation';
import type { SiteSimulationSettings } from '../hooks/useSiteSimulationSettings';

interface Props { showToast: (msg: string, ok?: boolean) => void; }

interface RangeConfig {
  key: 'packsOpened' | 'cardsWon' | 'livePlayers';
  label: string;
  sub: string;
  icon: React.ReactNode;
  color: string;
  sliderMin: number;
  sliderMax: number;
  step: number;
  preview: (min: number, max: number) => string;
}

const RANGE_CONFIGS: RangeConfig[] = [
  {
    key: 'packsOpened', label: 'Packs Opened Today', sub: 'Hero counter + Platform Activity',
    icon: <Package size={15} />, color: '#00c8ff', sliderMin: 0, sliderMax: 250000, step: 1000,
    preview: (min, max) => getDailyIncrementalValue(min, Math.max(0, max - min)).toLocaleString(),
  },
  {
    key: 'cardsWon', label: 'Cards Won Today', sub: 'Hero counter',
    icon: <Sparkles size={15} />, color: '#ffd700', sliderMin: 0, sliderMax: 60000, step: 100,
    preview: (min, max) => getDailyIncrementalValue(min, Math.max(0, max - min)).toLocaleString(),
  },
  {
    key: 'livePlayers', label: 'Live Players Online', sub: 'Hero counter (simulated baseline, real players add on top)',
    icon: <Users size={15} />, color: '#9b5cff', sliderMin: 0, sliderMax: 1000, step: 5,
    preview: (min, max) => getSimulatedLivePlayers(min, max).toLocaleString(),
  },
];

const FIELD_KEYS: Record<RangeConfig['key'], { min: keyof SiteSimulationSettings; max: keyof SiteSimulationSettings }> = {
  packsOpened: { min: 'packsOpenedMin', max: 'packsOpenedMax' },
  cardsWon: { min: 'cardsWonMin', max: 'cardsWonMax' },
  livePlayers: { min: 'livePlayersMin', max: 'livePlayersMax' },
};

export const SiteSettingsTab: React.FC<Props> = ({ showToast }) => {
  const { data, isLoading, refetch, isFetching } = useQuery({ queryKey: ['admin-site-settings'], queryFn: fetchSiteSettings, staleTime: 0 });
  const [draft, setDraft] = useState<SiteSimulationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewTick, setPreviewTick] = useState(0);

  useEffect(() => { if (data && !draft) setDraft(data); }, [data, draft]);
  // Re-render previews every few seconds so the live-players preview visibly
  // drifts the same way the real homepage counter will.
  useEffect(() => { const i = setInterval(() => setPreviewTick(t => t + 1), 4000); return () => clearInterval(i); }, []);

  const isDirty = draft && data && JSON.stringify(draft) !== JSON.stringify(data);

  const setField = (key: keyof SiteSimulationSettings, value: number) => {
    setDraft(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const result = await patchSiteSettings(draft);
      setDraft(result.settings);
      showToast('Site settings saved', true);
      void refetch();
    } catch (e: any) {
      showToast(e?.message || 'Failed to save site settings', false);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => { if (data) setDraft(data); };

  if (isLoading || !draft) {
    return <div className="flex items-center justify-center py-24 text-white/30 text-xs uppercase tracking-widest font-display">Loading settings...</div>;
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl uppercase tracking-wider text-white">Site Settings</h2>
          <p className="text-[11px] text-white/30 mt-0.5">Control the ranges behind the homepage's simulated live numbers</p>
        </div>
        <button onClick={() => refetch()} disabled={isFetching} className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 disabled:opacity-30">
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="space-y-4">
        {RANGE_CONFIGS.map(cfg => {
          const { min: minKey, max: maxKey } = FIELD_KEYS[cfg.key];
          const min = Number(draft[minKey]);
          const max = Number(draft[maxKey]);
          void previewTick;
          return (
            <div key={cfg.key} className="rounded-2xl p-4 sm:p-5" style={{ background: `${cfg.color}08`, border: `1.5px solid ${cfg.color}22` }}>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span style={{ color: cfg.color }}>{cfg.icon}</span>
                  <div>
                    <p className="text-[12px] font-bold text-white">{cfg.label}</p>
                    <p className="text-[10px] text-white/30">{cfg.sub}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-widest text-white/30">Current sample</p>
                  <p className="text-sm font-display font-bold" style={{ color: cfg.color }}>{cfg.preview(min, max)}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-white/40">Min</label>
                    <span className="text-[12px] font-display font-bold text-white">{min.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min={cfg.sliderMin}
                    max={cfg.sliderMax}
                    step={cfg.step}
                    value={min}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setField(minKey, v);
                      if (v > max) setField(maxKey, v);
                    }}
                    className="w-full accent-current"
                    style={{ accentColor: cfg.color }}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] uppercase tracking-widest text-white/40">Max</label>
                    <span className="text-[12px] font-display font-bold text-white">{max.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min={cfg.sliderMin}
                    max={cfg.sliderMax}
                    step={cfg.step}
                    value={max}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setField(maxKey, v);
                      if (v < min) setField(minKey, v);
                    }}
                    className="w-full accent-current"
                    style={{ accentColor: cfg.color }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={save}
          disabled={!isDirty || saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-display text-[11px] uppercase tracking-wider disabled:opacity-30"
          style={{ background: '#9b5cff', color: '#fff' }}
        >
          <Save size={13} /> {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {isDirty && <button onClick={reset} className="px-4 py-2.5 rounded-xl text-[11px] uppercase tracking-wider text-white/40 hover:text-white/70">Discard</button>}
        <p className="text-[10px] text-white/25 ml-auto hidden sm:block">Live values on the site update within ~60s of saving</p>
      </div>
    </section>
  );
};
