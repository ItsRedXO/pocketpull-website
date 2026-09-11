import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, ShoppingBag, Target } from 'lucide-react';
import { BrawlSpeciesTab } from './BrawlSpeciesTab';
import { BrawlItemsTab } from './BrawlItemsTab';
import { BrawlChallengesTab } from './BrawlChallengesTab';

type BrawlSubTab = 'species' | 'items' | 'challenges';

const SUB_TABS: { id: BrawlSubTab; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: 'species', label: 'Species', icon: Swords },
  { id: 'items', label: 'Items', icon: ShoppingBag },
  { id: 'challenges', label: 'Challenges', icon: Target },
];

export function AdminPokeBrawlPanel({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const [tab, setTab] = useState<BrawlSubTab>('species');

  return (
    <div>
      <div className="flex items-center gap-1 mb-4 overflow-x-auto" role="tablist">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} role="tab" aria-selected={tab === t.id}
            className={`relative flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap rounded-lg ${
              tab === t.id ? 'text-black' : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}>
            {tab === t.id && (
              <motion.span layoutId="admin-brawl-subtab-pill" className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#9b5cff] to-[#00c8ff]"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
            )}
            <span className="relative flex items-center gap-1.5"><t.icon size={13} /> {t.label}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
          {tab === 'species' && <BrawlSpeciesTab showToast={showToast} />}
          {tab === 'items' && <BrawlItemsTab showToast={showToast} />}
          {tab === 'challenges' && <BrawlChallengesTab showToast={showToast} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
