/**
 * SettingsTab — user-facing sound-effects toggle + Test Sound button.
 *
 * Uses the global useSoundSetting() hook (localStorage-backed) so the
 * preference persists across reloads AND is shared with the rest of
 * the app (pack openings, pack battles, audio context provider).
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Volume2, VolumeX, Settings as SettingsIcon, Play } from 'lucide-react';
import { useSoundSetting } from '../../../hooks/useSoundSetting';
import { useTickSound } from '../../../hooks/useTickSound';

export const SettingsTab: React.FC = () => {
  const { enabled, toggle } = useSoundSetting();
  const { test } = useTickSound(true);   // always plays (ignores enabled for testing)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-5"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(155,92,255,0.1)', border: '1px solid rgba(155,92,255,0.2)' }}
        >
          <SettingsIcon size={16} className="text-[#9b5cff]" />
        </div>
        <h3 className="font-display text-lg text-white uppercase tracking-wide">
          Settings
        </h3>
      </div>

      {/* Sound Effects toggle */}
      <div
        className="flex items-center justify-between gap-4 p-4 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{
              background: enabled ? 'rgba(0,200,255,0.1)' : 'rgba(255,255,255,0.05)',
              border: enabled ? '1px solid rgba(0,200,255,0.2)' : '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {enabled ? (
              <Volume2 size={18} className="text-[#00c8ff]" />
            ) : (
              <VolumeX size={18} className="text-gray-500" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">Sound Effects</p>
            <p className="text-[10px] text-gray-500 truncate">
              Animation sounds for pack openings and battles
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? 'Turn sound effects off' : 'Turn sound effects on'}
          data-testid="sound-effects-toggle"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle();
          }}
          className="relative shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#00c8ff]/50 cursor-pointer"
          style={{
            width: 52,
            height: 28,
            background: enabled ? '#00c8ff' : 'rgba(255,255,255,0.15)',
            boxShadow: enabled ? '0 0 12px -2px rgba(0,200,255,0.5)' : 'none',
            padding: 0,
            border: 'none',
          }}
        >
          <span
            aria-hidden="true"
            className="absolute top-0.5 block rounded-full bg-white shadow-md transition-all duration-200"
            style={{
              width: 22,
              height: 22,
              left: enabled ? 27 : 3,
            }}
          />
        </button>
      </div>

      {/* Test Sound button — plays a 1.5s blip via the same Howler instance */}
      <button
        type="button"
        data-testid="test-sound-button"
        onClick={test}
        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
        style={{
          background: 'rgba(0,200,255,0.1)',
          border: '1px solid rgba(0,200,255,0.3)',
          color: '#00c8ff',
        }}
      >
        <Play size={16} />
        Test Sound
      </button>

      <p className="mt-2 text-[10px] text-gray-500 text-center uppercase tracking-wider">
        {enabled ? 'Sound effects: ON' : 'Sound effects: OFF'}
      </p>
    </motion.div>
  );
};
