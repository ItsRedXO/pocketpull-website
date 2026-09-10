import React, { useState } from 'react';
import { Swords, Users } from 'lucide-react';
import { BrawlSpeciesTab } from './BrawlSpeciesTab';
import { BrawlTrainersTab } from './BrawlTrainersTab';

type SubTab = 'species' | 'trainers';

export function AdminPokeBrawlPanel({ showToast }: { showToast: (m: string, ok?: boolean) => void }) {
  const [subTab, setSubTab] = useState<SubTab>('trainers');
  const tabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'trainers', label: 'Trainers', icon: <Users size={13} /> },
    { id: 'species', label: 'Species', icon: <Swords size={13} /> },
  ];
  return (
    <div>
      <div className="flex items-center gap-1 mb-4 border-b border-white/5 pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider ${
              subTab === t.id ? 'text-black bg-gradient-to-r from-[#9b5cff] to-[#00c8ff]' : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {subTab === 'trainers' ? <BrawlTrainersTab showToast={showToast} /> : <BrawlSpeciesTab showToast={showToast} />}
    </div>
  );
}
