import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { MODE_INFO } from '../battleUtils';

interface Props {
  mode: string;
  status: string;
  isPublic: boolean;
  onBack: () => void;
}

export const BattleRoomHeader: React.FC<Props> = ({ mode, status, isPublic, onBack }) => {
  const safeMode = mode || 'standard';
  const modeInfo = MODE_INFO[safeMode] || MODE_INFO.standard;

  return (
    <div className="flex items-center gap-4 mb-6">
      <button 
        onClick={onBack} 
        className="w-10 h-10 rounded-xl bg-white/6 hover:bg-white/12 flex items-center justify-center transition-colors"
      >
        <ArrowLeft size={18} className="text-gray-400" />
      </button>
      <div>
        <h1 className="font-display text-3xl uppercase tracking-tight">
          {modeInfo.icon} <span style={{ color: modeInfo.color }}>{modeInfo.label}</span> Battle
        </h1>
        <p className="text-gray-500 text-sm">{modeInfo.desc}</p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <StatusBadge status={status} />
        {!isPublic && <span className="text-xs text-[#9b5cff] font-bold">🔒 PRIVATE</span>}
      </div>
    </div>
  );
};

function StatusBadge({ status }: { status: string }) {
  if (status === 'waiting') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#00c8ff]/10 text-[#00c8ff] border border-[#00c8ff]/20">
      <span className="w-1.5 h-1.5 rounded-full bg-[#00c8ff]" /> Waiting
    </span>
  );
  if (status === 'live') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-500/10 text-green-400 border border-green-500/20">
      <motion.span 
        className="w-1.5 h-1.5 rounded-full bg-green-400" 
        animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }} 
        transition={{ repeat: Infinity, duration: 1 }} 
      /> LIVE
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/5 text-gray-500 border border-white/10">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-500" /> Finished
    </span>
  );
}
