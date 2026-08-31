import React from 'react';
import { GripVertical, Trash2, Image } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CardDraft, RARITY_COLOR, RARITIES, Rarity } from './types';

interface Props {
  id: string;
  index: number;
  card: CardDraft;
  updateCard: (i: number, patch: Partial<CardDraft>) => void;
  removeCard: (i: number) => void;
  handleCardImageUpload: (i: number, e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleManualSort: (oldIndex: number, newOrder: number) => void;
  isOnlyCard: boolean;
  isMystery: boolean;
}

export const SortableCardRow: React.FC<Props> = ({ 
  id, index, card, updateCard, removeCard, handleCardImageUpload, handleManualSort, isOnlyCard, isMystery
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [localSort, setLocalSort] = React.useState<string>(String(index + 1));

  // Sync localSort when index changes (e.g. after drag or others moving)
  React.useEffect(() => {
    setLocalSort(String(index + 1));
  }, [index]);

  const onSortBlur = () => {
    const val = parseInt(localSort);
    if (isNaN(val) || val < 1) {
      setLocalSort(String(index + 1));
    } else {
      handleManualSort(index, val);
    }
  };

  const onSortKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSortBlur();
    }
  };
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
    background: 'rgba(255,255,255,0.03)',
    border: `1.5px solid ${isDragging ? '#9b5cff' : `${RARITY_COLOR[card.rarity]}22`}`,
    boxShadow: isDragging ? '0 20px 40px -10px rgba(0,0,0,0.6)' : 'none',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}
      className="rounded-xl p-4 flex flex-col gap-4 group/card transition-all">
      <div className="flex gap-4 items-start">
        {/* Left Controls: Drag Handle & Trash */}
        <div className="flex flex-col items-center justify-between self-stretch py-1">
          <div className="cursor-grab active:cursor-grabbing p-2 -m-2 opacity-20 hover:opacity-100 transition-opacity" {...listeners}>
            <GripVertical size={16} />
          </div>
          <button 
            onClick={() => removeCard(index)} 
            disabled={isOnlyCard}
            className="p-2 -m-2 text-red-400/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg disabled:opacity-0 transition-all"
            title="Remove card"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* Sort Order */}
        <div className="w-14 shrink-0">
          <label className="text-[10px] uppercase tracking-wider text-white/25 font-bold block mb-1.5 text-center">#</label>
          <input 
            type="number" 
            value={localSort} 
            onChange={e => setLocalSort(e.target.value)}
            onBlur={onSortBlur}
            onKeyDown={onSortKeyDown}
            className="admin-input text-sm text-center px-0 h-10 font-bold" 
          />
        </div>

        {/* Thumbnail - Larger */}
        <div className="shrink-0 pt-0.5">
          <div className="w-16 h-22 rounded-lg bg-black/40 border border-white/5 overflow-hidden flex items-center justify-center shadow-2xl group-hover/card:border-white/10 transition-colors">
            {card.cardImageUrl ? (
              <img src={card.cardImageUrl} alt="" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white/5">
                <Image size={20} className="text-white/10" />
              </div>
            )}
          </div>
        </div>

        {/* Name & Rarity Stack */}
        <div className="flex-1 grid grid-cols-1 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/25 font-bold block mb-1.5">Name</label>
            <input value={card.cardName} onChange={e => updateCard(index, { cardName: e.target.value })}
              placeholder="Card name" className="admin-input text-sm h-10" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/25 font-bold block mb-1.5">{isMystery ? 'Tier' : 'Rarity'}</label>
            <select value={card.rarity} onChange={e => updateCard(index, { rarity: e.target.value as Rarity })}
              className="admin-input text-sm font-bold h-10 px-3" style={{ color: RARITY_COLOR[card.rarity] }}>
              {isMystery ? (
                <>
                  <option value="secret" style={{ color: RARITY_COLOR.secret, background: '#111' }}>Chase</option>
                  <option value="rare" style={{ color: RARITY_COLOR.rare, background: '#111' }}>Premium</option>
                  <option value="common" style={{ color: RARITY_COLOR.common, background: '#111' }}>Base</option>
                </>
              ) : RARITIES.map(r => <option key={r} value={r} style={{ color: RARITY_COLOR[r], background: '#111' }}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
        </div>

        {/* Odds & Value Stack */}
        <div className="w-40 shrink-0 grid grid-cols-1 gap-3">
          {isMystery ? (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/25 font-bold block mb-1.5">Quantity</label>
              <input type="number" min="1" step="1" value={card.quantity}
                onChange={e => updateCard(index, { quantity: e.target.value })}
                className="admin-input text-sm px-3 h-10 font-mono" />
              <p className="mt-1 text-[9px] text-white/25">Odds calculated from units</p>
            </div>
          ) : (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-white/25 font-bold block mb-1.5">Odds%</label>
              <input type="number" min="0.001" step="0.001" max="100" value={card.pullChance}
                onChange={e => updateCard(index, { pullChance: e.target.value })}
                className="admin-input text-sm px-3 h-10 font-mono" />
            </div>
          )}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/25 font-bold block mb-1.5">Value ($)</label>
            <input type="number" min="0" step="0.01" value={card.estimatedValue}
              onChange={e => updateCard(index, { estimatedValue: e.target.value })}
              className="admin-input text-sm font-bold text-green-400 px-3 h-10 font-mono" />
          </div>
        </div>

        {/* Mystery and Standard card image uploader */}
        <div className="self-end pb-0.5">
          <button
            type="button"
            onClick={() => document.getElementById(`card-image-${id}`)?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer text-[12px] font-bold text-white/40 hover:text-white hover:bg-white/5 border border-white/5 hover:border-white/20 transition-all"
          >
            <Image size={14} /> {card.cardImageUrl ? 'Replace' : 'Upload'}
          </button>
          <input
            id={`card-image-${id}`}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => handleCardImageUpload(index, e)}
          />
        </div>
      </div>
    </div>
  );
};
