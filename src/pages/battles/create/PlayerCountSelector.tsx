import React from 'react';
import { motion } from 'framer-motion';

interface PlayerCountSelectorProps {
  isSharedMode: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
}

const PC_OPTIONS: { count: number; team: boolean; id: string }[] = [
  { count: 2, team: false, id: '1v1' },
  { count: 4, team: true,  id: '2v2' },   // hidden in Shared mode
  { count: 3, team: false, id: '3ffa' },
  { count: 4, team: false, id: '4ffa' },
];

function PlayerIcon({ dim = 22 }: { dim?: number }) {
  return (
    <svg width={dim} height={dim} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="7" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function SwordsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
      <line x1="13" y1="19" x2="15" y2="17" />
      <line x1="16" y1="16" x2="21" y2="21" />
      <line x1="7" y1="4" x2="9" y2="7" />
    </svg>
  );
}

function PlayerLayout({ id, active, isShared = false }: { id: string; active: boolean; isShared?: boolean }) {
  const iconColor = active ? '#00c8ff' : 'rgba(156,163,175,0.65)';
  const swordColor = active ? '#00c8ff' : 'rgba(156,163,175,0.5)';

  const P = ({ dim = 18 }: { dim?: number }) => (
    <span style={{ color: iconColor, display: 'flex' }}>
      <PlayerIcon dim={dim} />
    </span>
  );

  const S = () => isShared ? null : (
    <span style={{ color: swordColor, display: 'flex' }}>
      <SwordsIcon />
    </span>
  );

  if (id === '1v1') {
    return <><P /><S /><P /></>;
  }
  if (id === '2v2') {
    return <><P /><P /><S /><P /><P /></>;
  }
  if (id === '3ffa') {
    return (
      <span className="flex items-center gap-2.5">
        <P dim={19} /><P dim={19} /><P dim={19} />
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2">
      <P dim={17} /><P dim={17} /><P dim={17} /><P dim={17} />
    </span>
  );
}

export const PlayerCountSelector: React.FC<PlayerCountSelectorProps> = ({ 
  isSharedMode, 
  selectedId, 
  onSelect 
}) => {
  const visible = isSharedMode ? PC_OPTIONS.filter(o => o.id !== '2v2') : PC_OPTIONS;

  return (
    <div className="flex flex-col gap-2.5">
      {visible.map(opt => {
        const isActive = selectedId === opt.id;
        return (
          <motion.button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
            className="relative w-full rounded-xl px-4 py-3 flex items-center justify-center cursor-pointer transition-all overflow-hidden"
            style={{
              background: isActive
                ? 'linear-gradient(135deg, rgba(0,200,255,0.14), rgba(0,200,255,0.06))'
                : 'rgba(255,255,255,0.03)',
              border: `1.5px solid ${isActive ? 'rgba(0,200,255,0.55)' : 'rgba(255,255,255,0.07)'}`,
              boxShadow: isActive
                ? '0 0 18px -4px rgba(0,200,255,0.45), inset 0 0 20px -12px rgba(0,200,255,0.25)'
                : 'none',
            }}
          >
            {isActive && (
              <motion.div
                className="absolute inset-0 rounded-xl pointer-events-none"
                animate={{ opacity: [0, 0.07, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                style={{ background: 'radial-gradient(ellipse at center, #00c8ff, transparent 70%)' }}
              />
            )}

            <div className="relative z-10 flex items-center gap-1.5"
              style={{ color: isActive ? '#00c8ff' : 'rgba(156,163,175,0.7)' }}>
              <PlayerLayout id={opt.id} active={isActive} isShared={isSharedMode} />
            </div>
          </motion.button>
        );
      })}
    </div>
  );
};
