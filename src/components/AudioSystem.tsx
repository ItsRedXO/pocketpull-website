/**
 * src/components/AudioSystem.tsx
 *
 * Top-level provider for shared audio state (sound effects on/off,
 * floating mute button). The actual audio generation lives in:
 *   • src/hooks/useTickSound.ts — pack-reel tick sounds (synthesised WAV)
 *   • src/hooks/useUpgraderAudio.ts — upgrader suspense + win/lose stings
 *
 * This component is now THIN: it only manages a single global "Sound
 * Effects On/Off" preference (shared with the Settings tab via
 * localStorage) and exposes a small floating mute button (desktop only).
 */

import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useAuth, useUserStats } from '../hooks/useAuth';
import { useSoundSetting } from '../hooks/useSoundSetting';

/**
 * Provider — currently a no-op wrapper (kept for backwards compat with
 * existing imports). In future it could host shared audio context state.
 */
export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

/**
 * Floating mute button (desktop only). Hides for admins.
 * Click toggles sound effects via the shared hook.
 */
export const AudioButton: React.FC = React.memo(() => {
  const { enabled, toggle } = useSoundSetting();

  const { user } = useAuth();
  const { stats } = useUserStats(user?.id, user?.email, user?.displayName, user?.emailVerified);
  const isAdmin = stats?.role === 'admin';

  if (isAdmin) return null;

  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); toggle(); }}
      title={enabled ? 'Mute sound effects' : 'Unmute sound effects'}
      aria-label={enabled ? 'Mute sound effects' : 'Unmute sound effects'}
      className="hidden lg:flex fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full glass-card border border-primary/30 items-center justify-center text-primary hover:neon-glow-blue transition-all active:scale-90 group cursor-pointer"
      style={{ background: 'rgba(13,14,20,0.85)' }}
    >
      {enabled ? (
        <Volume2 size={20} className="animate-pulse-glow text-[#00c8ff]" />
      ) : (
        <VolumeX size={20} className="opacity-50 group-hover:opacity-100 text-gray-400" />
      )}
    </button>
  );
});

// Backwards-compat re-export
export const AudioSystem: React.FC = () => <AudioButton />;