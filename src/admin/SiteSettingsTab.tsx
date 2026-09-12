import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Save, Package, Sparkles, Users, Target, Shuffle } from 'lucide-react';
import { fetchSiteSettings, patchSiteSettings } from './siteSettingsAdminApi';
import { getSimulatedLivePlayers } from '../lib/livePlayers';
import type { SiteSimulationSettings } from '../hooks/useSiteSimulationSettings';

interface Props { showToast: (msg: string, ok?: boolean) => void; }

interface DailyTargetKeys {
  targetKey: 'packsOpenedTodayTarget' | 'cardsWonTodayTarget';
  overriddenKey: 'packsOpenedTodayOverridden' | 'cardsWonTodayOverridden';
  overrideField: 'packsOpenedTodayOverride' | 'cardsWonTodayOverride';
}

interface RangeConfig {
  key: 'packsOpened' | 'cardsWon' | 'livePlayers';
  label: string;
  sub: string;
  icon: React.ReactNode;
  color: string;
  sliderMin: number;
  sliderMax: number;
  step: number;
  /** Only Packs Opened / Cards Won accumulate to a specific end-of-day number; Live Players is a continuous curve. */
  dailyTarget?: DailyTargetKeys;
}

const RANGE_CONFIGS: RangeConfig[] = [
  {
    key: 'packsOpened', label: 'Packs Opened Today', sub: 'Hero counter + Platform Activity',
    icon: <Package size={15} />, color: '#00c8ff', sliderMin: 0, sliderMax: 250000, step: 1000,
    dailyTarget: { targetKey: 'packsOpenedTodayTarget', overriddenKey: 'packsOpenedTodayOverridden', overrideField: 'packsOpenedTodayOverride' },
  },
  {
    key: 'cardsWon', label: 'Cards Won Today', sub: 'Hero counter',
    icon: <Sparkles size={15} />, color: '#ffd700', sliderMin: 0, sliderMax: 60000, step: 100,
    dailyTarget: { targetKey: 'cardsWonTodayTarget', overriddenKey: 'cardsWonTodayOverridden', overrideField: 'cardsWonTodayOverride' },
  },
  {
    key: 'livePlayers', label: 'Live Players Online', sub: 'Hero counter (simulated baseline, real players add on top)',
    icon: <Users size={15} />, color: '#9b5cff', sliderMin: 0, sliderMax: 1000, step: 5,
  },
];

const FIELD_KEYS: Record<RangeConfig['key'], { min: keyof SiteSimulationSettings; max: keyof SiteSimulationSettings }> = {
  packsOpened: { min: 'packsOpenedMin', max: 'packsOpenedMax' },
  cardsWon: { min: 'cardsWonMin', max: 'cardsWonMax' },
  livePlayers: { min: 'livePlayersMin', max: 'livePlayersMax' },
};

export const SiteSettingsTab: React.FC<Props> = ({ showToast }) => {
  const { data, isLoading, isError, refetch, isFetching } = useQuery({ queryKey: ['admin-site-settings'], queryFn: fetchSiteSettings, staleTime: 0 });
  const [draft, setDraft] = useState<SiteSimulationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [targetInputs, setTargetInputs] = useState<Record<string, string>>({});
  const [pinning, setPinning] = useState<string | null>(null);

  useEffect(() => { if (data && !draft) setDraft(data); }, [data, draft]);
  useEffect(() => {
    if (!data) return;
    setTargetInputs(prev => ({
      packsOpened: prev.packsOpened ?? String(data.packsOpenedTodayTarget),
      cardsWon: prev.cardsWon ?? String(data.cardsWonTodayTarget),
    }));
  }, [data]);

  const isDirty = draft && data && (
    draft.packsOpenedMin !== data.packsOpenedMin || draft.packsOpenedMax !== data.packsOpenedMax ||
    draft.cardsWonMin !== data.cardsWonMin || draft.cardsWonMax !== data.cardsWonMax ||
    draft.livePlayersMin !== data.livePlayersMin || draft.livePlayersMax !== data.livePlayersMax
  );

  const setField = (key: keyof SiteSimulationSettings, value: number) => {
    setDraft(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const result = await patchSiteSettings({
        packsOpenedMin: draft.packsOpenedMin, packsOpenedMax: draft.packsOpenedMax,
        cardsWonMin: draft.cardsWonMin, cardsWonMax: draft.cardsWonMax,
        livePlayersMin: draft.livePlayersMin, livePlayersMax: draft.livePlayersMax,
      });
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

  const pinTarget = async (cfg: DailyTargetKeys, cardKey: string) => {
    const raw = Number(targetInputs[cardKey]);
    if (!Number.isFinite(raw)) { showToast('Enter a valid number', false); return; }
    setPinning(cardKey);
    try {
      const result = await patchSiteSettings({ [cfg.overrideField]: Math.round(raw) });
      showToast(`Today's ${cardKey === 'packsOpened' ? 'Packs Opened' : 'Cards Won'} total pinned`, true);
      setTargetInputs(prev => ({ ...prev, [cardKey]: String(result.settings[cfg.targetKey]) }));
      void refetch();
    } catch (e: any) {
      showToast(e?.message || 'Failed to pin today\'s target', false);
    } finally {
      setPinning(null);
    }
  };

  const clearTarget = async (cfg: DailyTargetKeys, cardKey: string) => {
    setPinning(cardKey);
    try {
      const result = await patchSiteSettings({ [cfg.overrideField]: null });
      showToast(`Today's ${cardKey === 'packsOpened' ? 'Packs Opened' : 'Cards Won'} total is auto-rolling again`, true);
      setTargetInputs(prev => ({ ...prev, [cardKey]: String(result.settings[cfg.targetKey]) }));
      void refetch();
    } catch (e: any) {
      showToast(e?.message || 'Failed to clear pin', false);
    } finally {
      setPinning(null);
    }
  };

  if (isLoading || !draft) {
    if (isError) return <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-300">Failed to load site settings.</div>;
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
          const isPinning = pinning === cfg.key;
          const overridden = cfg.dailyTarget && data ? Boolean(data[cfg.dailyTarget.overriddenKey]) : false;
          const liveTarget = cfg.dailyTarget && data ? Number(data[cfg.dailyTarget.targetKey]) : null;

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
                {cfg.key === 'livePlayers' && (
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-widest text-white/30">Sample right now</p>
                    <p className="text-sm font-display font-bold" style={{ color: cfg.color }}>{getSimulatedLivePlayers(min, max).toLocaleString()}</p>
                  </div>
                )}
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

              {cfg.dailyTarget && (
                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      {overridden ? <Target size={12} style={{ color: cfg.color }} /> : <Shuffle size={12} className="text-white/30" />}
                      <span className="text-[10px] uppercase tracking-widest text-white/40">
                        Today ends at{' '}
                        <span className="font-display font-bold text-[12px] normal-case tracking-normal" style={{ color: cfg.color }}>
                          {liveTarget?.toLocaleString()}
                        </span>
                      </span>
                      <span
                        className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase"
                        style={{ color: overridden ? cfg.color : 'rgba(255,255,255,0.4)', background: overridden ? `${cfg.color}18` : 'rgba(255,255,255,0.05)' }}
                      >
                        {overridden ? 'Pinned' : 'Auto-rolled'}
                      </span>
                    </div>
                    <p className="text-[9px] text-white/25">Resets to a new random pick every midnight Pacific unless pinned</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="number"
                      min={min}
                      max={max}
                      value={targetInputs[cfg.key] ?? ''}
                      onChange={e => setTargetInputs(prev => ({ ...prev, [cfg.key]: e.target.value }))}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-display font-bold text-white bg-white/5 border border-white/10 w-32"
                    />
                    <button
                      onClick={() => cfg.dailyTarget && pinTarget(cfg.dailyTarget, cfg.key)}
                      disabled={isPinning}
                      className="px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider font-bold disabled:opacity-40"
                      style={{ background: `${cfg.color}18`, color: cfg.color, border: `1px solid ${cfg.color}33` }}
                    >
                      {isPinning ? 'Pinning...' : `Pin for Today`}
                    </button>
                    {overridden && (
                      <button
                        onClick={() => cfg.dailyTarget && clearTarget(cfg.dailyTarget, cfg.key)}
                        disabled={isPinning}
                        className="px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider text-white/40 hover:text-white/70 disabled:opacity-40"
                      >
                        Clear Pin
                      </button>
                    )}
                  </div>
                </div>
              )}
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
          <Save size={13} /> {saving ? 'Saving...' : 'Save Range Changes'}
        </button>
        {isDirty && <button onClick={reset} className="px-4 py-2.5 rounded-xl text-[11px] uppercase tracking-wider text-white/40 hover:text-white/70">Discard</button>}
        <p className="text-[10px] text-white/25 ml-auto hidden sm:block">Live values on the site update within ~60s of saving</p>
      </div>
    </section>
  );
};
