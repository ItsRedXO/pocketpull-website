import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Plus, Trash2, Monitor } from 'lucide-react';
import { useLoadingScreenConfig, DEFAULT_LOADING_CONFIG, type LoadingScreenConfig } from '../hooks/useSiteConfig';

interface Props { showToast: (msg: string, ok?: boolean) => void; }

export const LoadingScreenTab: React.FC<Props> = ({ showToast }) => {
  const { config, saveConfig, isSaving } = useLoadingScreenConfig();
  const [draft, setDraft] = useState<LoadingScreenConfig>(DEFAULT_LOADING_CONFIG);
  const [previewProgress, setPreviewProgress] = useState(65);

  useEffect(() => { setDraft(config); }, [config]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(config);

  const handleSave = async () => {
    try {
      await saveConfig(draft);
      showToast('Loading screen saved!');
    } catch {
      showToast('Failed to save', false);
    }
  };

  const setMessage = (idx: number, val: string) =>
    setDraft(d => ({ ...d, messages: d.messages.map((m, i) => (i === idx ? val : m)) }));
  const addMessage = () =>
    setDraft(d => ({ ...d, messages: [...d.messages, 'New message...'] }));
  const removeMessage = (idx: number) => {
    if (draft.messages.length <= 1) return;
    setDraft(d => ({ ...d, messages: d.messages.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg uppercase tracking-widest text-white">Loading Screen</h2>
          <p className="text-xs text-gray-500 mt-1">Customize the bar colors and cycling messages</p>
        </div>
        <button
          onClick={handleSave}
          disabled={!dirty || isSaving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-display text-xs uppercase tracking-wider transition-all disabled:opacity-40"
          style={{ background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.5)', color: '#c084fc' }}
        >
          {isSaving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left: Config ── */}
        <div className="space-y-5">

          {/* Bar colors */}
          <div
            className="rounded-xl p-5 border border-white/8 space-y-4"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Bar Gradient</h3>
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  { key: 'barColor1' as const, label: 'Start (left)' },
                  { key: 'barColor2' as const, label: 'End (right)' },
                ] as const
              ).map(({ key, label }) => (
                <div key={key}>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">{label}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={draft[key]}
                      onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                      className="w-9 h-9 rounded-lg cursor-pointer border border-white/10 shrink-0"
                      style={{ padding: '2px', background: 'rgba(255,255,255,0.05)' }}
                    />
                    <input
                      type="text"
                      value={draft[key]}
                      onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                      className="admin-input font-mono text-[11px]"
                      maxLength={9}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Live gradient preview strip */}
            <div
              className="w-full"
              style={{
                height: '10px',
                background: `linear-gradient(90deg, ${draft.barColor1} 0%, ${draft.barColor2} 100%)`,
                boxShadow: `0 0 10px ${draft.barColor2}88`,
                borderRadius: `${draft.barRadius}px`,
              }}
            />
          </div>

          {/* Bar size & shape */}
          <div
            className="rounded-xl p-5 border border-white/8 space-y-4"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Bar Size &amp; Shape</h3>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Height</p>
                <span className="text-[10px] font-mono text-gray-400">{draft.barHeight}px</span>
              </div>
              <input
                type="range" min={8} max={48} step={1}
                value={draft.barHeight}
                onChange={e => setDraft(d => ({ ...d, barHeight: Number(e.target.value) }))}
                className="w-full accent-violet-500"
              />
              <div className="flex justify-between text-[9px] text-gray-700 mt-0.5">
                <span>8px</span><span>48px</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Corner Radius</p>
                <span className="text-[10px] font-mono text-gray-400">{draft.barRadius}px</span>
              </div>
              <input
                type="range" min={0} max={24} step={1}
                value={draft.barRadius}
                onChange={e => setDraft(d => ({ ...d, barRadius: Number(e.target.value) }))}
                className="w-full accent-violet-500"
              />
              <div className="flex justify-between text-[9px] text-gray-700 mt-0.5">
                <span>Sharp</span><span>Rounded</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div
            className="rounded-xl p-5 border border-white/8 space-y-3"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                Cycling Messages ({draft.messages.length})
              </h3>
              <button
                onClick={addMessage}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] transition-colors"
                style={{ color: '#00c8ff', border: '1px solid rgba(0,200,255,0.2)', background: 'rgba(0,200,255,0.06)' }}
              >
                <Plus size={11} /> Add
              </button>
            </div>
            <div className="space-y-2">
              {draft.messages.map((msg, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-700 w-5 text-right shrink-0 font-mono">{idx + 1}</span>
                  <input
                    type="text"
                    value={msg}
                    onChange={e => setMessage(idx, e.target.value)}
                    className="admin-input flex-1 text-[11px]"
                  />
                  <button
                    onClick={() => removeMessage(idx)}
                    disabled={draft.messages.length <= 1}
                    className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-400/10 disabled:opacity-20 transition-colors shrink-0"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Preview ── */}
        <div className="rounded-xl overflow-hidden border border-white/8" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8">
            <Monitor size={13} className="text-gray-500" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Live Preview</span>
          </div>

          {/* Preview canvas */}
          <div
            className="relative flex flex-col items-center justify-center"
            style={{
              height: '300px',
              backgroundImage: "url('/loading-bg.webp')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="absolute inset-0" style={{ background: 'rgba(4,8,16,0.18)' }} />

            <div className="relative z-10 flex flex-col items-center gap-4" style={{ width: '60%' }}>
              <img
                src="/pocketpull-logo.png"
                alt="PocketPull"
                style={{ width: '72px', height: '72px', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}
              />

              <p
                className="font-display text-white uppercase text-center w-full"
                style={{ fontSize: '0.6rem', letterSpacing: '0.05em', textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}
              >
                {draft.messages[0]}
              </p>

              {/* Bar */}
              <div
                className="relative w-full overflow-hidden"
                style={{
                  height: `${draft.barHeight}px`,
                  borderRadius: `${draft.barRadius}px`,
                  background: 'rgba(4,6,16,0.82)',
                  border: '2px solid rgba(255,255,255,0.45)',
                  boxShadow: '0 0 0 2px rgba(0,0,0,0.72)',
                }}
              >
                <div
                  style={{
                    position: 'absolute', inset: 0,
                    width: `${previewProgress}%`,
                    borderRadius: `${draft.barRadius}px`,
                    background: `linear-gradient(90deg, ${draft.barColor1} 0%, ${draft.barColor2} 100%)`,
                    boxShadow: `0 0 12px ${draft.barColor2}cc`,
                    transition: 'width 0.1s',
                  }}
                />
                <div
                  style={{
                    position: 'absolute', top: '3px', left: 0, height: '4px',
                    width: `${previewProgress}%`,
                    background: 'rgba(255,255,255,0.26)',
                    transition: 'width 0.1s',
                  }}
                />
              </div>

              <p
                className="font-display text-white tabular-nums"
                style={{ fontSize: '0.6rem', textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}
              >
                {Math.round(previewProgress)}%
              </p>
            </div>
          </div>

          {/* Scrubber */}
          <div className="px-5 py-4 border-t border-white/8">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">Drag to preview progress</p>
            <input
              type="range" min={0} max={100} value={previewProgress}
              onChange={e => setPreviewProgress(Number(e.target.value))}
              className="w-full accent-violet-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
