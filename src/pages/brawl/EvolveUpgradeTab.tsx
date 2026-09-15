import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Star, Sparkles } from 'lucide-react';
import { getBrawlRoster, getBrawlSpeciesCatalog, type BrawlInstance, type BrawlSpecies } from '../../lib/brawlApi';
import { PokemonStatCard } from './PokemonStatCard';
import { EvolveFlowModal } from './EvolveFlowModal';
import { UpgradeFlowModal } from './UpgradeFlowModal';
import { computeMergeEligibility } from './mergeEligibility';

export function EvolveUpgradeTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['brawl-roster'], queryFn: getBrawlRoster });
  const { data: catalogData } = useQuery({ queryKey: ['brawl-species-catalog'], queryFn: getBrawlSpeciesCatalog, staleTime: 60 * 60_000 });
  const speciesCatalog = useMemo(() => new Map((catalogData?.species || []).map(s => [s.id, s] as [number, BrawlSpecies])), [catalogData]);
  const roster = data?.roster || [];
  const [evolveSpeciesId, setEvolveSpeciesId] = useState<number | null>(null);
  const [upgradeSpeciesId, setUpgradeSpeciesId] = useState<number | null>(null);

  const benchGroups = useMemo(() => {
    const groups = new Map<number, BrawlInstance[]>();
    for (const mon of roster) {
      if (Number(mon.is_on_team)) continue;
      const group = groups.get(mon.species_id);
      if (group) group.push(mon); else groups.set(mon.species_id, [mon]);
    }
    return groups;
  }, [roster]);

  const { evolveGroups, upgradeGroups } = useMemo(() => {
    const evolve: BrawlInstance[][] = [];
    const upgrade: BrawlInstance[][] = [];
    for (const group of benchGroups.values()) {
      if (group.length < 2) continue;
      const { canEvolve, canStarUp } = computeMergeEligibility(group);
      if (canEvolve) evolve.push(group);
      if (canStarUp) upgrade.push(group);
    }
    evolve.sort((a, b) => b[0].overall_rating - a[0].overall_rating);
    upgrade.sort((a, b) => b[0].overall_rating - a[0].overall_rating);
    return { evolveGroups: evolve, upgradeGroups: upgrade };
  }, [benchGroups]);

  if (isLoading) return <div className="text-white/40 text-sm py-16 text-center">Loading roster…</div>;

  const closeAndRefresh = () => {
    setEvolveSpeciesId(null);
    setUpgradeSpeciesId(null);
    qc.invalidateQueries({ queryKey: ['brawl-roster'] });
  };

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1.5">
          <ArrowRight size={15} className="text-[#00c8ff]" />
          <h3 className="font-display text-sm uppercase tracking-widest text-[#00c8ff]">Evolve</h3>
        </div>
        <p className="text-[11px] text-white/40 mb-3 max-w-xl">
          Evolving trades in duplicate copies of a Pokémon on your bench for its next evolution stage. Pick a Pokémon below, then confirm which copies get used before anything happens.
        </p>
        {evolveGroups.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {evolveGroups.map((group, i) => (
              <PokemonStatCard key={group[0].species_id} mon={group[0]} index={i} count={group.length} onClick={() => setEvolveSpeciesId(group[0].species_id)} />
            ))}
          </div>
        ) : (
          <p className="text-white/25 text-xs italic py-3 px-1 border border-dashed border-white/10 rounded-xl text-center">Evolve your pokemon here</p>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <Star size={15} className="text-[#facc15]" />
          <h3 className="font-display text-sm uppercase tracking-widest text-[#facc15]">Upgrade</h3>
        </div>
        <p className="text-[11px] text-white/40 mb-3 max-w-xl">
          Star upgrades consume duplicate copies of a Pokémon to permanently boost its stats. Pick a Pokémon below, then confirm which copies get used before anything happens.
        </p>
        {upgradeGroups.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {upgradeGroups.map((group, i) => (
              <PokemonStatCard key={group[0].species_id} mon={group[0]} index={i} count={group.length} onClick={() => setUpgradeSpeciesId(group[0].species_id)} />
            ))}
          </div>
        ) : (
          <p className="text-white/25 text-xs italic py-3 px-1 border border-dashed border-white/10 rounded-xl text-center">Use duplicates to upgrade your pokemon here</p>
        )}
      </div>

      {evolveGroups.length === 0 && upgradeGroups.length === 0 && (
        <div className="flex items-start gap-1.5 text-[10px] text-white/30 px-1 mt-5">
          <Sparkles size={11} className="mt-0.5 shrink-0" />
          Collect more than one of the same Pokémon on your bench to unlock evolving and star upgrades.
        </div>
      )}

      {evolveSpeciesId != null && (
        <EvolveFlowModal
          speciesId={evolveSpeciesId}
          instances={benchGroups.get(evolveSpeciesId) || []}
          speciesCatalog={speciesCatalog}
          onClose={closeAndRefresh}
        />
      )}

      {upgradeSpeciesId != null && (
        <UpgradeFlowModal
          speciesId={upgradeSpeciesId}
          instances={benchGroups.get(upgradeSpeciesId) || []}
          speciesCatalog={speciesCatalog}
          onClose={closeAndRefresh}
        />
      )}
    </div>
  );
}
