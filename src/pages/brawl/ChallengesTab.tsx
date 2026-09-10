import React from 'react';
import { Target } from 'lucide-react';

export function ChallengesTab() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4"><Target size={16} className="text-[#9b5cff]" /><h3 className="font-display text-sm uppercase tracking-widest text-white/70">Challenges</h3></div>
      <div className="text-white/30 text-sm py-16 text-center border border-dashed border-white/10 rounded-xl">
        Daily and weekly objectives are launching soon. Keep battling — your progress will count toward them once they go live.
      </div>
    </div>
  );
}
