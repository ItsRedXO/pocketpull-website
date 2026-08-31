import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Loader2, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { getTcgDexMatches, hydrateTcgDexCards, type TcgDexCard, type ListEntry } from '../../lib/tcgdex';
import { TcgDexCardImage } from './TcgDexCardImage';
import { CardInspector } from './CardInspector';
import { mapRarity, RARITY_COLORS, formatPrice, estimateValue, getBestPrice } from './utils';
import { SortOrder, ImportedCard } from './types';

interface Props {
  onImport: (cards: ImportedCard[]) => void;
  onClose: () => void;
}

const PAGE_SIZE = 25;

export const TcgDexSearchModal: React.FC<Props> = ({ onImport, onClose }) => {
  const [query, setQuery] = useState('');
  const [allMatches, setAllMatches] = useState<ListEntry[]>([]);
  const [results, setResults] = useState<TcgDexCard[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<SortOrder>('name_asc');
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [_scanProgress, setScanProgress] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inspectingCard, setInspectingCard] = useState<TcgDexCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [_hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hydratedCache, setHydratedCache] = useState<Map<string, TcgDexCard>>(new Map());

  useEffect(() => { inputRef.current?.focus(); }, []);

  const doSearch = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) { 
      setAllMatches([]); setResults([]); setHasSearched(false); setError(null); 
      setCurrentPage(1); setHydratedCache(new Map()); return; 
    }
    setLoading(true); setError(null); setHasSearched(true); setCurrentPage(1); 
    setHydratedCache(new Map());
    try {
      const matches = await getTcgDexMatches(trimmed);
      if (!matches || matches.length === 0) { 
        setError(`No cards found for "${trimmed}".`); 
        setAllMatches([]); 
        setResults([]); 
      } else { 
        setAllMatches(matches); 
        setError(null); 
      }
    } catch (err: any) { 
      console.error('[TCGDex] Search failed:', err); 
      if (err.isFriendly) setError(err.message);
      else setError('Search failed. Please try again or narrow your search.'); 
      setAllMatches([]); setResults([]); 
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!allMatches || allMatches.length === 0) { setResults([]); return; }
    
    const priceFilter = (allMatches as any)._priceFilter;
    const start = (currentPage - 1) * PAGE_SIZE;
    
    let listToSort = [...allMatches];
    if (sortOrder === 'name_asc') listToSort.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    if (sortOrder === 'name_desc') listToSort.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    
    const loadPage = async () => {
      setHydrating(true);
      if (priceFilter) setScanning(true);

      try {
        let finalPageResults: TcgDexCard[] = [];
        const nextCache = new Map(hydratedCache);

        if (priceFilter) {
          const CHUNK_SIZE = 40;
          let currentScanIdx = 0;
          let foundCount = 0;
          
          while (foundCount < start + PAGE_SIZE && currentScanIdx < listToSort.length) {
            const chunk = listToSort.slice(currentScanIdx, currentScanIdx + CHUNK_SIZE);
            setScanProgress(Math.round((currentScanIdx / listToSort.length) * 100));
            
            const toFetch = chunk.filter(e => !nextCache.has(e.id));
            if (toFetch.length > 0) {
              const newHydrated = await hydrateTcgDexCards(toFetch);
              newHydrated.forEach(c => { if (c) nextCache.set(c.id, c); });
            }

            for (let i = 0; i < chunk.length; i++) {
              const entry = chunk[i];
              const card = nextCache.get(entry.id);
              if (card) {
                const price = getBestPrice(card);
                const matchesPrice = price !== null && 
                  price >= priceFilter.min && 
                  (priceFilter.max === null || priceFilter.max === priceFilter.min ? Math.abs(price - priceFilter.min) < 0.01 : price <= priceFilter.max);
                
                if (matchesPrice) {
                  if (foundCount >= start && foundCount < start + PAGE_SIZE) {
                    finalPageResults.push(card);
                  }
                  foundCount++;
                }
              }
              if (foundCount >= start + PAGE_SIZE) break;
            }
            currentScanIdx += CHUNK_SIZE;
          }
        } else {
          const pageEntries = listToSort.slice(start, start + PAGE_SIZE);
          const toFetch = pageEntries.filter(e => !nextCache.has(e.id));
          
          if (toFetch.length > 0) {
            const newHydrated = await hydrateTcgDexCards(toFetch);
            newHydrated.forEach(c => { if (c) nextCache.set(c.id, c); });
          }
          
          finalPageResults = pageEntries.map(e => nextCache.get(e.id) || { 
            id: e.id, name: e.name || 'Unknown', image: '', set: '', rarity: '', hp: 0, types: [],
            category: '', description: '', effect: '', attacks: [], abilities: [],
            illustrator: '', dexId: [], stage: '', evolveFrom: '', localId: '',
            tcgplayerPrice: null, cardmarketPrice: null 
          } as TcgDexCard);
        }

        setHydratedCache(nextCache);
        setResults(finalPageResults);
      } catch (err) { 
        console.error('[TCGDex] Hydration error:', err);
      } finally { 
        setHydrating(false); 
        setScanning(false);
      }
    };
    loadPage();
  }, [currentPage, allMatches, sortOrder]);

  const displayResults = useMemo(() => {
    if (!results) return [];
    
    const priceFilter = (allMatches as any)._priceFilter;
    let filtered = results;

    const lowerQuery = query.toLowerCase().trim();
    const isSpecialQuery = lowerQuery.includes('type') || lowerQuery.includes('$');
    
    if (lowerQuery && !isSpecialQuery && !priceFilter) {
      filtered = results.filter(card => {
        if (!card) return false;
        const nameMatch = (card.name || '').toLowerCase().includes(lowerQuery);
        const typeMatch = (card.types || []).some(t => t.toLowerCase().includes(lowerQuery));
        const catMatch = (card.category || '').toLowerCase().includes(lowerQuery);
        const setMatch = (card.set || '').toLowerCase().includes(lowerQuery);
        const descMatch = (card.description || '').toLowerCase().includes(lowerQuery);
        const effectMatch = (card.effect || '').toLowerCase().includes(lowerQuery);
        const attackMatch = (card.attacks || []).some(a => 
          (a.name || '').toLowerCase().includes(lowerQuery) || 
          (a.effect || '').toLowerCase().includes(lowerQuery)
        );
        const abilityMatch = (card.abilities || []).some(a => 
          (a.name || '').toLowerCase().includes(lowerQuery) || 
          (a.effect || '').toLowerCase().includes(lowerQuery)
        );
        return nameMatch || typeMatch || catMatch || setMatch || descMatch || effectMatch || attackMatch || abilityMatch;
      });
    }

    if (sortOrder === 'name_asc' || sortOrder === 'name_desc') return filtered;
    
    return [...filtered].sort((a, b) => {
      if (!a || !b) return 0;
      if (sortOrder === 'price_asc' || sortOrder === 'price_desc') {
        const valA = estimateValue(a), valB = estimateValue(b);
        const hasA = getBestPrice(a) !== null, hasB = getBestPrice(b) !== null;
        if (hasA && !hasB) return -1; if (!hasA && hasB) return 1;
        return sortOrder === 'price_asc' ? valA - valB : valB - valA;
      }
      if (sortOrder === 'set_asc') return (a.set || '').localeCompare(b.set || '');
      if (sortOrder === 'set_desc') return (b.set || '').localeCompare(a.set || '');
      if (sortOrder === 'rarity') {
        const r = ['common', 'uncommon', 'rare', 'ultra', 'secret', 'god'];
        return r.indexOf(mapRarity(a.rarity)) - r.indexOf(mapRarity(b.rarity));
      }
      return 0;
    });
  }, [results, sortOrder, query, allMatches]);

  const toggleSelect = (id: string) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const handleImport = async () => {
    const sel = allMatches.filter(m => selected.has(m.id));
    if (sel.length === 0) return;
    setLoading(true);
    try {
      const hydrated = await hydrateTcgDexCards(sel);
      onImport(hydrated.map(c => ({
        cardName: c.name, rarity: mapRarity(c.rarity), cardImageUrl: c.image,
        estimatedValue: estimateValue(c), tcgdexId: c.id,
      })));
    } catch (err) { 
      console.error('[TCGDex] Import failed:', err); 
      setError('Import failed. Please try again.'); 
    } finally { setLoading(false); }
  };

  const totalPages = Math.ceil((allMatches?.length || 0) / PAGE_SIZE);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-8 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)' }} onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 8 }}
        className="w-full max-w-5xl bg-[#0d0f1c] rounded-2xl mb-8 border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
          <div><h2 className="font-display text-base uppercase text-white tracking-wider">TCGDex Card Search</h2>
          <p className="text-[10px] text-white/30 mt-0.5">Search real Pokémon cards · Select to import</p></div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all"><X size={15} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              <input ref={inputRef} value={query} onChange={e => {
                setQuery(e.target.value); if (debounceRef.current) clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(() => doSearch(e.target.value), 600);
              }} onKeyDown={e => { if (e.key === 'Enter') { if (debounceRef.current) clearTimeout(debounceRef.current); doSearch(query); } if (e.key === 'Escape') onClose(); }}
              placeholder="Search by Pokémon name, type, or set (e.g. Grass, Charizard)…" className="w-full pl-9 pr-10 py-3 rounded-xl text-[13px] text-white outline-none bg-white/5 border border-white/10 focus:border-[#9b5cff55] transition-all" />
              {(loading || hydrating || scanning) && <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9b5cff] animate-spin" />}
            </div>
            <select value={sortOrder} onChange={e => { setSortOrder(e.target.value as SortOrder); setCurrentPage(1); }}
              className="bg-[#1a1c2e] border border-white/10 rounded-xl pl-3 pr-10 py-3 text-[12px] text-white outline-none cursor-pointer min-w-[140px] appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px' }}>
              <option value="name_asc" style={{ background: '#1a1c2e', color: '#fff' }}>Name A-Z</option><option value="name_desc" style={{ background: '#1a1c2e', color: '#fff' }}>Name Z-A</option>
              <option value="price_asc" style={{ background: '#1a1c2e', color: '#fff' }}>Price: Low to High</option><option value="price_desc" style={{ background: '#1a1c2e', color: '#fff' }}>Price: High to Low</option>
              <option value="set_asc" style={{ background: '#1a1c2e', color: '#fff' }}>Set A-Z</option><option value="set_desc" style={{ background: '#1a1c2e', color: '#fff' }}>Set Z-A</option>
              <option value="rarity" style={{ background: '#1a1c2e', color: '#fff' }}>Rarity</option>
            </select>
          </div>
          {allMatches.length > 0 && !loading && (
            <div className="flex justify-between text-[11px]">
              <span className="text-white/30">{allMatches.length} cards found</span>
              {selected.size > 0 && <span className="font-bold text-[#9b5cff]">{selected.size} selected</span>}
            </div>
          )}
          {error && !loading && <div className="text-amber-300/80 text-xs p-3 bg-amber-400/5 border border-amber-400/10 rounded-xl flex gap-2 items-center"><AlertCircle size={14} />{error}</div>}
          {displayResults.length > 0 && (
            <div className="grid gap-2.5 max-h-[400px] overflow-y-auto pr-1" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
              {displayResults.map(card => {
                if (!card) return null;
                const isSel = selected.has(card.id), col = RARITY_COLORS[mapRarity(card.rarity)] ?? '#8892a4', { display: pr } = formatPrice(card);
                return (
                  <motion.div key={card.id} whileHover={{ scale: 1.03 }} className="relative flex flex-col rounded-xl overflow-hidden text-left bg-white/5 border border-white/10 group"
                    style={{ background: isSel ? `${col}15` : undefined, border: isSel ? `1.5px solid ${col}` : undefined }}>
                    <div className="aspect-[2.5/3.5] relative flex items-center justify-center bg-black/20 cursor-pointer" onClick={() => toggleSelect(card.id)}>
                      <TcgDexCardImage url={card.image} alt={card.name} className="w-full h-full object-contain" />
                      {isSel && <div className="absolute top-1 right-1 rounded-full bg-[#0d0f1c] shadow-lg"><CheckCircle2 size={16} style={{ color: col }} /></div>}
                      <button onClick={e => { e.stopPropagation(); setInspectingCard(card); }} className="absolute top-1 left-1 w-6 h-6 flex items-center justify-center rounded bg-black/50 text-white/50 hover:text-white opacity-0 group-hover:opacity-100 transition-all"><Info size={14} /></button>
                      <div className="absolute bottom-1 left-1 flex gap-1">
                        <div className="text-[7px] font-bold px-1 py-0.5 rounded bg-black/40 text-white uppercase shadow-sm" style={{ color: col }}>{mapRarity(card.rarity)}</div>
                        {(card.types || []).slice(0, 1).map(t => <div key={t} className="text-[7px] font-bold px-1 py-0.5 rounded bg-black/40 text-white uppercase shadow-sm">{t}</div>)}
                      </div>
                    </div>
                    <div className="px-2 py-2 flex flex-col gap-0.5 cursor-pointer" onClick={() => toggleSelect(card.id)}>
                      <p className="text-[10px] font-bold text-white/90 truncate">{card.name}</p>
                      <p className="text-[8px] text-white/20 truncate">{card.set}</p>
                      <p className="text-[9px] font-bold mt-0.5" style={{ color: col }}>{pr}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
          {totalPages > 1 && !loading && !hydrating && (
            <div className="flex items-center justify-center gap-4 py-2 border-t border-white/5">
              <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="p-2 rounded bg-white/5 hover:bg-white/10 disabled:opacity-20 transition-all"><ChevronLeft size={16} /></button>
              <span className="text-white/40 text-xs font-mono">Page {currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="p-2 rounded bg-white/5 hover:bg-white/10 disabled:opacity-20 transition-all"><ChevronRight size={16} /></button>
            </div>
          )}
          <div className="flex gap-3 pt-2 border-t border-white/5">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/40 uppercase tracking-widest text-xs font-bold hover:bg-white/5 transition-all">Cancel</button>
            <button onClick={handleImport} disabled={selected.size === 0 || loading} className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-[#9b5cff] to-[#00c8ff] text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-[#9b5cff30] disabled:opacity-30 transition-all">
              {loading ? 'Preparing...' : `Import ${selected.size} Card${selected.size === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </motion.div>
      <AnimatePresence>
        {inspectingCard && (
          <CardInspector 
            card={inspectingCard} 
            isSelected={selected.has(inspectingCard.id)} 
            onToggleSelect={() => toggleSelect(inspectingCard.id)} 
            onClose={() => setInspectingCard(null)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
