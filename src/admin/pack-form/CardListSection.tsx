import React from 'react';
import { Sparkles, Plus } from 'lucide-react';
import { 
  DndContext, 
  closestCenter, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy, 
} from '@dnd-kit/sortable';
import { CardDraft } from './types';
import { SortableCardRow } from './SortableCardRow';

interface Props {
  cards: CardDraft[];
  setCards: React.Dispatch<React.SetStateAction<CardDraft[]>>;
  totalOdds: number;
  updateCard: (i: number, patch: Partial<CardDraft>) => void;
  removeCard: (i: number) => void;
  handleCardImageUpload: (i: number, e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  addCard: () => void;
  setShowTcgDex: (val: boolean) => void;
  RARITY_COLOR: Record<string, string>;
  RARITIES: readonly string[];
  isMystery: boolean;
}

export const CardListSection: React.FC<Props> = ({
  cards, setCards, totalOdds, updateCard, removeCard, handleCardImageUpload, addCard, setShowTcgDex, RARITY_COLOR, RARITIES, isMystery
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleManualSort = (oldIndex: number, newOrder: number) => {
    const newIndex = Math.max(0, Math.min(cards.length - 1, newOrder - 1));
    if (oldIndex === newIndex) return;
    setCards((items) => arrayMove(items, oldIndex, newIndex));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setCards((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] uppercase tracking-[0.25em] text-white/30 font-display">
          {isMystery ? 'Cards & Quantities' : `Cards & Odds — ${cards.length} cards`}
        </h3>
        <span className={`text-[11px] font-display font-bold ${isMystery || Math.abs(totalOdds - 100) <= 1 ? 'text-green-400' : 'text-red-400'}`}>
          {isMystery ? 'Unit-weighted odds ✓' : `Total: ${totalOdds.toFixed(1)}% ${Math.abs(totalOdds - 100) > 1 ? '⚠ must equal 100%' : '✓'}`}
        </span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {cards.map((card, i) => (
              <SortableCardRow 
                key={card.id} 
                id={card.id} 
                index={i} 
                card={card} 
                updateCard={updateCard} 
                removeCard={removeCard} 
                handleCardImageUpload={handleCardImageUpload}
                handleManualSort={handleManualSort}
                isOnlyCard={cards.length <= 1}
                isMystery={isMystery}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-3 flex gap-2">
        <button onClick={addCard}
          className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-[12px] font-display uppercase tracking-widest transition-all hover:bg-white/8"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px dashed rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)' }}>
          <Plus size={13} /> Add Card
        </button>
        <button onClick={() => setShowTcgDex(true)}
          className="flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 text-[12px] font-display uppercase tracking-widest transition-all hover:bg-white/8 text-white/80"
          style={{ background: 'linear-gradient(135deg, #9b5cff, #ff00ff)', border: '1.5px dashed rgba(255,255,255,0.12)' }}>
          <Sparkles size={13} /> Search TCGDex
        </button>
      </div>
    </section>
  );
};
