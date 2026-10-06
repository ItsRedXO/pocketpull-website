import React, { useState, useEffect, useRef } from 'react';
import { Save, RefreshCw, Plus, Trash2, Monitor } from 'lucide-react';
import { useLoadingScreenConfig, DEFAULT_LOADING_CONFIG, type LoadingScreenConfig } from '../hooks/useSiteConfig';

interface Props { showToast: (msg: string, ok?: boolean) => void; }

type DragMode = 'none' | 'position' | 'width';

export const LoadingScreenTab: React.FC<Props> = ({ showToast }) => {
  const { config, saveConfig, isSaving } = useLoadingScreenConfig();
  const [draft, setDraft] = useState<LoadingScreenConfig>(DEFAULT_LOADING_CONFIG);
  const [previewProgress, setPreviewProgress] = useState(65);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const previewRef = useRef<HTMLDivElement>(null);
  const contentBlockRef = useRef<HTMLDivElement>(null);

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

  const onPreviewMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragMode === 'none' || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();

    if (dragMode === 'position') {
      const pct = Math.round(((e.clientY - rect.top) / rect.height) * 100);
      setDraft(d => ({ ...d, barY: Math.max(5, Math.min(95, pct)) }));
    } else if (dragMode === 'width' && contentBlockRef.current) {
      const blockRect = contentBlockRef.current.getBoundingClientRect();
      const pct = Math.round(((e.clientX - blockRect.left) / blockRect.width) * 100);
      setDraft(d => ({ ...d, barWidth: Math.max(20, Math.min(100, pct)) }));
    }
  };

  const stopDrag = () => setDragMode('none');

  const SliderRow = ({
    label, field, min, max, unit = 'px',
  }: { label: string; field: keyof LoadingScreenConfig; min: number; max: number; unit?: string }) => (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
        <span className="text-[10px] font-mono text-gray-400">{draft[field]}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={1}
        value={draft[field] as number}
        onChange={e => setDraft(d => ({ ...d, [field]: Number(e.target.value) }))}
        className="w-full accent-violet-500"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg uppercase tracking-widest text-white">Loading Screen</h2>
          <p className="text-xs text-gray-500 mt-1">Drag the preview — block to reposition, right edge of bar to resize width</p>
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
          <div className="rounded-xl p-5 border border-white/8 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Bar Gradient</h3>
            <div className="grid grid-cols-2 gap-4">
              {([
                { key: 'barColor1' as const, label: 'Start (left)' },
                { key: 'barColor2' as const, label: 'End (right)' },
              ] as const).map(({ key, label }) => (
                <div key={key}>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">{label}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="color" value={draft[key]}
                      onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                      className="w-9 h-9 rounded-lg cursor-pointer border border-white/10 shrink-0"
                      style={{ padding: '2px', background: 'rgba(255,255,255,0.05)' }}
                    />
                    <input
                      type="text" value={draft[key]} maxLength={9}
                      onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                      className="admin-input font-mono text-[11px]"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div
              className="w-full"
              style={{
                height: '10px',
                background: `linear-gradient(90deg, ${draft.barColor1} 0%, ${draft.barColor2} 100%)`,
                boxShadow: `0 0 10px ${draft.barColor2}88`,
                borderRadius: `${draft.barRadius}px`,
                width: `${draft.barWidth}%`,
              }}
            />
          </div>

          {/* Bar size, shape & position */}
          <div className="rounded-xl p-5 border border-white/8 space-y-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Bar Size, Shape &amp; Position</h3>
            <SliderRow label="Width" field="barWidth" min={20} max={100} unit="%" />
            <SliderRow label="Height" field="barHeight" min={8} max={48} />
            <SliderRow label="Corner Radius" field="barRadius" min={0} max={24} />
            <SliderRow label="Vertical Position" field="barY" min={5} max={95} unit="%" />
            <p className="text-[9px] text-gray-600">Or use the preview: drag block to move, drag bar right-edge to resize width</p>
          </div>

          {/* Messages */}
          <div className="rounded-xl p-5 border border-white/8 space-y-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
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
                    type="text" value={msg}
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
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <div className="flex items-center gap-2">
              <Monitor size={13} className="text-gray-500" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Live Preview</span>
            </div>
            <span className="text-[9px] text-gray-600 uppercase tracking-wider">
              {dragMode === 'position' ? '↕ repositioning...' : dragMode === 'width' ? '↔ resizing...' : 'Drag to edit'}
            </span>
          </div>

          {/* Preview canvas */}
          <div
            ref={previewRef}
            className="relative"
            style={{
              height: '380px',
              backgroundImage: "url('/loading-bg.webp')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              cursor: dragMode === 'position' ? 'ns-resize' : dragMode === 'width' ? 'ew-resize' : 'default',
              userSelect: 'none',
            }}
            onMouseMove={onPreviewMouseMove}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
          >
            <div className="absolute inset-0" style={{ background: 'rgba(4,8,16,0.18)' }} />

            {/* Horizontal guideline */}
            <div
              className="absolute left-0 right-0 pointer-events-none"
              style={{ top: `${draft.barY}%`, height: '1px', background: 'rgba(255,255,255,0.12)' }}
            />

            {/* Content block — drag to reposition vertically */}
            <div
              ref={contentBlockRef}
              className="absolute flex flex-col items-center gap-3"
              style={{
                top: `${draft.barY}%`,
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '70%',
                zIndex: 10,
                cursor: dragMode === 'position' ? 'ns-resize' : 'grab',
              }}
              onMouseDown={e => { e.preventDefault(); setDragMode('position'); }}
            >
              {dragMode === 'none' && (
                <div
                  className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] uppercase tracking-widest whitespace-nowrap px-2 py-0.5 rounded pointer-events-none"
                  style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.4)' }}
                >
                  ↕ drag to move
                </div>
              )}

              <img
                src="/pocketpull-logo.png"
                alt="PocketPull"
                draggable={false}
                style={{ width: '60px', height: '60px', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))' }}
              />

              <p
                className="font-display text-white uppercase text-center w-full"
                style={{ fontSize: '0.55rem', letterSpacing: '0.05em', textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}
              >
                {draft.messages[0]}
              </p>

              {/* Bar + right-edge resize handle */}
              <div className="relative w-full flex items-center">
                <div
                  className="relative overflow-hidden"
                  style={{
                    height: `${draft.barHeight}px`,
                    width: `${draft.barWidth}%`,
                    borderRadius: `${draft.barRadius}px`,
                    background: 'rgba(4,6,16,0.82)',
                    border: '2px solid rgba(255,255,255,0.45)',
                    boxShadow: '0 0 0 2px rgba(0,0,0,0.72)',
                    flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute', inset: 0,
                    width: `${previewProgress}%`,
                    borderRadius: `${draft.barRadius}px`,
                    background: `linear-gradient(90deg, ${draft.barColor1} 0%, ${draft.barColor2} 100%)`,
                    boxShadow: `0 0 12px ${draft.barColor2}cc`,
                  }} />
                  <div style={{
                    position: 'absolute', top: '3px', left: 0, height: '4px',
                    width: `${previewProgress}%`,
                    background: 'rgba(255,255,255,0.26)',
                  }} />
                </div>

                {/* Right-edge resize handle */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${draft.barWidth}%`,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '14px',
                    height: `${Math.max(draft.barHeight + 8, 20)}px`,
                    cursor: 'ew-resize',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 20,
                  }}
                  onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setDragMode('width'); }}
                >
                  <div style={{
                    width: '5px',
                    height: '70%',
                    borderRadius: '3px',
                    background: dragMode === 'width' ? '#c084fc' : 'rgba(255,255,255,0.6)',
                    boxShadow: dragMode === 'width' ? '0 0 8px #c084fc' : 'none',
                    transition: 'background 0.15s',
                  }} />
                </div>
              </div>

              <p
                className="font-display text-white tabular-nums"
                style={{ fontSize: '0.55rem', textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}
              >
                {Math.round(previewProgress)}%
              </p>
            </div>
          </div>

          {/* Progress scrubber */}
          <div className="px-5 py-4 border-t border-white/8">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Preview progress</p>
              <span className="text-[10px] font-mono text-gray-400">{previewProgress}%</span>
            </div>
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
