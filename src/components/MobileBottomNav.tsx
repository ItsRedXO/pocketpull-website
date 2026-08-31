import React from 'react';
import { motion } from 'framer-motion';
import { Package, Zap, Swords, ArrowLeftRight, Archive } from 'lucide-react';

type Page = 'home' | 'upgrader' | 'battle' | 'exchanger' | 'inventory' | 'profile';

interface MobileBottomNavProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

const bottomNavTabs: { id: Page; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: 'home',      label: 'Packs',      icon: Package },
  { id: 'upgrader',  label: 'Upgrader',   icon: Zap },
  { id: 'battle',    label: 'Battles',    icon: Swords },
  { id: 'exchanger', label: 'Exchanger',  icon: ArrowLeftRight },
  { id: 'inventory', label: 'Collection', icon: Archive },
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = React.memo(({ currentPage, onPageChange }) => {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'linear-gradient(to top, #0a0b0f 80%, rgba(10,11,15,0.97))',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="flex items-stretch h-16">
        {bottomNavTabs.map((tab) => {
          const isActive = currentPage === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onPageChange(tab.id)}
              className="relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-150 active:scale-95"
            >
              {/* Active glow pill */}
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-active"
                  className="absolute top-0 inset-x-2 h-0.5 rounded-b-full"
                  style={{ background: '#00c8ff', boxShadow: '0 0 8px #00c8ff' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              <Icon
                size={20}
                className={`transition-colors duration-150 ${
                  isActive ? 'text-[#00c8ff]' : 'text-gray-500'
                }`}
              />
              <span
                className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-150 ${
                  isActive ? 'text-[#00c8ff]' : 'text-gray-600'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});
