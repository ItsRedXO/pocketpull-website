import React from 'react';
import { LucideIcon } from 'lucide-react';

export type ProfileTab = 'profile' | 'security' | 'history' | 'referrals' | 'settings';

interface TabConfig {
  id: ProfileTab;
  label: string;
  icon: LucideIcon;
}

interface ProfileTabsProps {
  tabs: TabConfig[];
  activeTab: ProfileTab;
  setActiveTab: (id: ProfileTab) => void;
}

export const ProfileTabs: React.FC<ProfileTabsProps> = ({
  tabs,
  activeTab,
  setActiveTab,
}) => {
  return (
    <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setActiveTab(id)}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${
            activeTab === id
              ? 'bg-[#00c8ff]/10 text-[#00c8ff] border border-[#00c8ff]/20'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Icon size={14} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
};
