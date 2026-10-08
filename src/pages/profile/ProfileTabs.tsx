import React from 'react';
import { LucideIcon } from 'lucide-react';

export type ProfileTab = 'profile' | 'security' | 'codes' | 'history' | 'referrals' | 'settings';

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
    <div
      className="flex gap-1 mb-6 rounded-xl p-1 backdrop-blur-md"
      style={{
        background: 'rgba(5,8,20,0.72)',
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 6px 24px rgba(0,0,0,0.5)',
      }}
    >
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setActiveTab(id)}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${
            activeTab === id
              ? 'text-[#00c8ff]'
              : 'text-white/40 hover:text-white/70 hover:bg-white/5'
          }`}
          style={activeTab === id ? {
            background: 'rgba(0,200,255,0.12)',
            border: '1px solid rgba(0,200,255,0.25)',
            boxShadow: '0 0 12px rgba(0,200,255,0.1)',
          } : {
            border: '1px solid transparent',
          }}
        >
          <Icon size={14} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
};
