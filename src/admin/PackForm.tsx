import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save } from 'lucide-react';
import type { PackCatalog, PackCard } from '../hooks/usePacks';
import { blink } from '../lib/blink';
import { BACKEND_BASE } from '../lib/backend';
import { TcgDexSearchModal } from './tcgdex/TcgDexSearchModal';
import type { ImportedCard } from './tcgdex/types';
import { CardDraft, PackDraft, RARITIES, RARITY_COLOR, PackType } from './pack-form/types';
import { PackDetailsFields } from './pack-form/PackDetailsFields';
import { CardListSection } from './pack-form/CardListSection';

interface Props {
  pack: PackCatalog | null;
  existingCards: PackCard[];
  onSave: () => void;
  onClose: () => void;
}

const emptyCard = (): CardDraft => ({
  id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  cardName: '', rarity: 'common', pullChance: '10', estimatedValue: '0.50', cardImageUrl: '', sortOrder: 0, quantity: '1',
});

export const PackForm: React.FC<Props> = ({ pack, existingCards, onSave, onClose }) => {
  const isNew = !pack;

  const [packDraft, setPackDraft] = useState<PackDraft>({
    packType: pack?.packType === 'mystery' ? 'mystery' : 'standard',
    name: pack?.name ?? '',
    price: String(pack?.price ?? '2.99'),
    description: pack?.description ?? '',
    imageUrl: pack?.imageUrl ?? '',
    glowColor: pack?.glowColor ?? '#00c8ff',
    borderColor: pack?.borderColor ?? '#00c8ff',
    isActive: pack ? Number(pack.isActive) > 0 : true,
    sortOrder: String(pack?.sortOrder ?? '0'),
    quantityLimit: String(pack?.quantityLimit ?? '0'),
    cooldownHours: String(pack?.cooldownHours ?? '0'),
    expiresAt: pack?.expiresAt ?? '',
    nameColor: pack?.nameColor ?? '#ffffff',
    descriptionColor: pack?.descriptionColor ?? '#ffffff',
    priceColor: pack?.priceColor ?? '#ffffff',
    buttonTextColor: pack?.buttonTextColor ?? '#ffffff',
    openAnotherButtonTextColor: pack?.openAnotherButtonTextColor ?? pack?.buttonTextColor ?? '#ffffff',
  });

  const [cards, setCards] = useState<CardDraft[]>(
    existingCards.length > 0
      ? existingCards.map(c => ({
          id: c.id, cardName: c.cardName, rarity: c.rarity,
          pullChance: String(c.pullChance), estimatedValue: String(c.estimatedValue),
          cardImageUrl: c.cardImageUrl ?? '', sortOrder: c.sortOrder,
          quantity: String(c.quantity ?? 0),
          originalQuantity: Number(c.originalQuantity ?? c.quantity ?? 0),
        }))
      : [emptyCard()]
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showTcgDex, setShowTcgDex] = useState(false);

  const handleTcgDexImport = (imported: ImportedCard[]) => {
    const newCards: CardDraft[] = imported.map((c, i) => ({
      id: `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${i}`,
      cardName: c.cardName,
      rarity: packDraft.packType === 'mystery'
        ? (['god', 'secret'].includes(c.rarity) ? 'secret' : ['ultra', 'rare'].includes(c.rarity) ? 'rare' : 'common')
        : c.rarity,
      pullChance: isMystery ? '0' : '5',
      estimatedValue: String(c.estimatedValue.toFixed(2)),
      cardImageUrl: c.cardImageUrl,
      sortOrder: cards.length + i,
      quantity: '1',
    }));
    setCards(cs => [...cs, ...newCards]);
    setShowTcgDex(false);
  };

  useEffect(() => {
    setPackDraft(p => ({ ...p, borderColor: p.glowColor }));
  }, [packDraft.glowColor]);

  const totalOdds = cards.reduce((s, c) => s + (parseFloat(c.pullChance) || 0), 0);
  const isMystery = packDraft.packType === 'mystery';

  const addCard = () => setCards(cs => [...cs, emptyCard()]);
  const removeCard = (i: number) => setCards(cs => cs.filter((_, idx) => idx !== i));
  const updateCard = (i: number, patch: Partial<CardDraft>) =>
    setCards(cs => cs.map((c, idx) => idx === i ? { ...c, ...patch } : c));

  const handlePackImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop() ?? 'png';
      const path = `packs/${Date.now()}.${ext}`;
      const { publicUrl } = await blink.storage.upload(file, path, { upsert: true });
      setPackDraft(p => ({ ...p, imageUrl: publicUrl }));
      setImagePreviewError(false);
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCardImageUpload = async (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const ext = file.name.split('.').pop() ?? 'png';
      const path = `cards/${Date.now()}_${i}.${ext}`;
      const { publicUrl } = await blink.storage.upload(file, path);
      updateCard(i, { cardImageUrl: publicUrl });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    setError(null);
    if (!packDraft.name.trim()) { setError('Pack name is required.'); return; }
    if (isNaN(parseFloat(packDraft.price)) || parseFloat(packDraft.price) < 0) { setError('Valid price required (0 or more).'); return; }
    if (cards.some(c => !c.cardName.trim())) { setError('All cards need a name.'); return; }
    if (!isMystery && Math.abs(totalOdds - 100) > 1) { setError(`Card odds must sum to 100% (currently ${totalOdds.toFixed(1)}%).`); return; }
    if (isMystery && cards.some(c => (parseInt(c.quantity) || 0) < 1)) { setError('Mystery Pack cards must each have at least 1 available copy.'); return; }

    const qLimit = Math.min(50000, Math.max(0, parseInt(packDraft.quantityLimit) || 0));
    setSaving(true);
    try {
      const token = await blink.auth.getValidToken();
      const adminSecret = typeof window !== 'undefined' ? localStorage.getItem('pocketpull_admin_pass') : null;
      const response = await fetch(`${BACKEND_BASE}/admin/packs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(adminSecret ? { 'X-Admin-Secret': adminSecret } : {}),
        },
        body: JSON.stringify({
          pack: {
            id: pack?.id,
            packType: packDraft.packType,
            name: packDraft.name.trim(),
            price: parseFloat(packDraft.price),
            description: packDraft.description.trim(),
            imageUrl: packDraft.imageUrl,
            glowColor: packDraft.glowColor,
            borderColor: packDraft.borderColor,
            isActive: packDraft.isActive,
            sortOrder: parseInt(packDraft.sortOrder) || 0,
            quantityLimit: qLimit,
            cooldownHours: parseInt(packDraft.cooldownHours) || 0,
            expiresAt: packDraft.expiresAt || null,
            nameColor: packDraft.nameColor,
            descriptionColor: packDraft.descriptionColor,
            priceColor: packDraft.priceColor,
            buttonTextColor: packDraft.buttonTextColor,
            openAnotherButtonTextColor: packDraft.openAnotherButtonTextColor,
          },
          cards: cards.map(c => ({
            cardName: c.cardName.trim(),
            rarity: c.rarity,
            pullChance: parseFloat(c.pullChance) || 0,
            estimatedValue: parseFloat(c.estimatedValue) || 0,
            cardImageUrl: c.cardImageUrl || null,
            sortOrder: c.sortOrder,
            quantity: Math.max(0, parseInt(c.quantity) || 0),
            originalQuantity: Math.max(0, Number(c.originalQuantity ?? (parseInt(c.quantity) || 0))),
          })),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || `Pack save failed (${response.status})`);
      }
      onSave();
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const glow = packDraft.glowColor || '#00c8ff';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-6 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-3xl rounded-2xl mb-6"
        style={{ background: '#0d0f1c', border: `1.5px solid ${glow}33`, boxShadow: `0 0 60px -12px ${glow}44` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
          <h2 className="font-display text-lg uppercase tracking-wider text-white">
            {isNew ? '+ New Pack' : `Edit: ${pack!.name}`}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all">
            <X size={15} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-8">
          <div className="space-y-2">
            <label htmlFor="pack-type" className="block text-[10px] font-bold uppercase tracking-wider text-white/40">Pack Type</label>
            <select
              id="pack-type"
              value={packDraft.packType}
              onChange={e => setPackDraft(current => ({ ...current, packType: e.target.value as PackType }))}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none appearance-none cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${glow}44` }}
            >
              <option value="standard" className="bg-[#0d0f1c]">Standard Pack</option>
              <option value="mystery" className="bg-[#0d0f1c]">Mystery Pack</option>
            </select>
            <p className="text-[10px] text-white/25">Mystery Packs are saved separately for the future Vault section.</p>
          </div>

          <PackDetailsFields
            packDraft={packDraft}
            setPackDraft={setPackDraft}
            imagePreviewError={imagePreviewError}
            setImagePreviewError={setImagePreviewError}
            uploadingImage={uploadingImage}
            handlePackImageUpload={handlePackImageUpload}
            glow={glow}
          />

          <CardListSection
            cards={cards}
            setCards={setCards}
            totalOdds={totalOdds}
            updateCard={updateCard}
            removeCard={removeCard}
            handleCardImageUpload={handleCardImageUpload}
            addCard={addCard}
            isMystery={packDraft.packType === 'mystery'}
            setShowTcgDex={setShowTcgDex}
            RARITY_COLOR={RARITY_COLOR}
            RARITIES={RARITIES}
          />

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[12px] text-red-400 text-center">
              ⚠ {error}
            </motion.p>
          )}

          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl font-display text-[13px] uppercase tracking-widest text-white/40 transition-all hover:text-white"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-2 flex-[2] py-3 rounded-xl font-display text-[13px] uppercase tracking-widest font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${glow}cc, #9b5cff)`, color: '#fff', boxShadow: `0 0 24px -6px ${glow}88` }}>
              <Save size={15} /> {saving ? 'Saving...' : isNew ? 'Create Pack' : 'Save Changes'}
            </button>
          </div>
        </div>
      </motion.div>
      <AnimatePresence>
        {showTcgDex && (
          <TcgDexSearchModal onClose={() => setShowTcgDex(false)} onImport={handleTcgDexImport} />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
