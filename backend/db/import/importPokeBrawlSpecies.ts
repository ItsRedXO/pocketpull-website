// Populates brawl_pokemon_species from PokeAPI (https://pokeapi.co, public, no key needed).
// Run once per national-dex range to add species to the Poke Brawl catalog:
//   tsx backend/db/import/importPokeBrawlSpecies.ts 1 151
// Safe to re-run: upserts on the PokeAPI national dex id, existing rows are refreshed in place.
import { query } from '../../lib/postgres';
import { computeOverallRating, scaleBaseStat } from '../../lib/brawl/rating';
import type { PokeType } from '../../lib/brawl/typeChart';

const API = 'https://pokeapi.co/api/v2';
const CONCURRENCY = 8;

interface PokemonPayload {
  name: string;
  types: { type: { name: string } }[];
  stats: { base_stat: number; stat: { name: string } }[];
  sprites: { front_default: string | null; other: { 'official-artwork': { front_default: string | null }; home: { front_default: string | null } } };
}
interface SpeciesPayload {
  evolves_from_species: { name: string } | null;
  evolution_chain: { url: string };
  is_legendary: boolean;
  is_mythical: boolean;
}
interface EvolutionChainNode {
  species: { name: string; url: string };
  evolves_to: EvolutionChainNode[];
}
interface EvolutionChainPayload {
  chain: EvolutionChainNode;
}

interface ChainInfo { stages: Map<string, number>; evolvesTo: Map<string, number[]> }
const evolutionChainCache = new Map<number, ChainInfo>();

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json() as Promise<T>;
}

function dexIdFromSpeciesUrl(url: string): number {
  const match = url.match(/\/pokemon-species\/(\d+)\//);
  if (!match) throw new Error(`Could not parse species id from ${url}`);
  return Number(match[1]);
}

function chainIdFromUrl(url: string): number {
  const match = url.match(/\/evolution-chain\/(\d+)\//);
  if (!match) throw new Error(`Could not parse evolution chain id from ${url}`);
  return Number(match[1]);
}

/** Walks one PokeAPI evolution chain once (cached per chain id) into both the
 * existing stage-per-species map and a species-name -> direct evolves_to dex
 * id[] map (usually one target; a branch like Eevee has several so the merge
 * UI can let the player choose which evolution to merge into). */
async function getEvolutionChainInfo(chainId: number): Promise<ChainInfo> {
  const cached = evolutionChainCache.get(chainId);
  if (cached) return cached;
  const payload = await fetchJson<EvolutionChainPayload>(`${API}/evolution-chain/${chainId}/`);
  const stages = new Map<string, number>();
  const evolvesTo = new Map<string, number[]>();
  const walk = (node: EvolutionChainNode, stage: number) => {
    stages.set(node.species.name, stage);
    evolvesTo.set(node.species.name, node.evolves_to.map(n => dexIdFromSpeciesUrl(n.species.url)));
    for (const next of node.evolves_to) walk(next, stage + 1);
  };
  walk(payload.chain, 1);
  const info = { stages, evolvesTo };
  evolutionChainCache.set(chainId, info);
  return info;
}

function statFor(stats: PokemonPayload['stats'], name: string): number {
  return stats.find(s => s.stat.name === name)?.base_stat ?? 0;
}

async function importOne(dexId: number): Promise<void> {
  const [pokemon, species] = await Promise.all([
    fetchJson<PokemonPayload>(`${API}/pokemon/${dexId}/`),
    fetchJson<SpeciesPayload>(`${API}/pokemon-species/${dexId}/`),
  ]);
  const chainId = chainIdFromUrl(species.evolution_chain.url);
  const { stages, evolvesTo } = await getEvolutionChainInfo(chainId);
  const evolutionStage = stages.get(pokemon.name) ?? 1;
  const evolvesToIds = evolvesTo.get(pokemon.name) ?? [];

  // PokeAPI's real base stats run well past 100 for outliers (Chansey HP 250,
  // Onix DEF 160); scale every stat down to the game's 1-100 range before it's
  // ever stored (see scaleBaseStat for the curve and why).
  const stats = {
    hp: scaleBaseStat(statFor(pokemon.stats, 'hp')),
    attack: scaleBaseStat(statFor(pokemon.stats, 'attack')),
    defense: scaleBaseStat(statFor(pokemon.stats, 'defense')),
    spAttack: scaleBaseStat(statFor(pokemon.stats, 'special-attack')),
    spDefense: scaleBaseStat(statFor(pokemon.stats, 'special-defense')),
    speed: scaleBaseStat(statFor(pokemon.stats, 'speed')),
  };
  const overall = computeOverallRating(stats, species.is_legendary || species.is_mythical);
  const primaryType = pokemon.types.find(t => true) ? (pokemon.types[0].type.name as PokeType) : null;
  const secondaryType = pokemon.types[1]?.type.name as PokeType | undefined;
  if (!primaryType) throw new Error(`No type data for dex id ${dexId}`);

  await query(
    `INSERT INTO brawl_pokemon_species
      (id, name, primary_type, secondary_type, base_hp, base_attack, base_defense, base_sp_attack, base_sp_defense, base_speed,
       overall_rating, evolution_stage, evolution_chain_id, evolves_to, is_legendary, is_mythical, sprite_url, artwork_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (id) DO UPDATE SET
       name=EXCLUDED.name, primary_type=EXCLUDED.primary_type, secondary_type=EXCLUDED.secondary_type,
       base_hp=EXCLUDED.base_hp, base_attack=EXCLUDED.base_attack, base_defense=EXCLUDED.base_defense,
       base_sp_attack=EXCLUDED.base_sp_attack, base_sp_defense=EXCLUDED.base_sp_defense, base_speed=EXCLUDED.base_speed,
       overall_rating=EXCLUDED.overall_rating, evolution_stage=EXCLUDED.evolution_stage, evolution_chain_id=EXCLUDED.evolution_chain_id,
       evolves_to=EXCLUDED.evolves_to,
       is_legendary=EXCLUDED.is_legendary, is_mythical=EXCLUDED.is_mythical, sprite_url=EXCLUDED.sprite_url, artwork_url=EXCLUDED.artwork_url`,
    [
      dexId, pokemon.name, primaryType, secondaryType ?? null,
      stats.hp, stats.attack, stats.defense, stats.spAttack, stats.spDefense, stats.speed,
      overall, evolutionStage, chainId, evolvesToIds, species.is_legendary ? 1 : 0, species.is_mythical ? 1 : 0,
      pokemon.sprites.front_default, pokemon.sprites.other['official-artwork'].front_default ?? pokemon.sprites.other.home.front_default,
    ],
  );
}

async function run() {
  const start = Number(process.argv[2] ?? 1);
  const end = Number(process.argv[3] ?? 151);
  const ids = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  let done = 0, failed: number[] = [];
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(batch.map(importOne));
    results.forEach((r, idx) => {
      if (r.status === 'rejected') { failed.push(batch[idx]); console.error(`[brawl-import] dex ${batch[idx]} failed:`, r.reason?.message ?? r.reason); }
    });
    done += batch.length;
    console.log(`[brawl-import] ${done}/${ids.length}`);
  }
  if (failed.length) console.warn(`[brawl-import] ${failed.length} species failed: ${failed.join(', ')}`);
  console.log(`[brawl-import] Done. Imported dex ${start}-${end} (${ids.length - failed.length} succeeded).`);
  process.exit(failed.length ? 1 : 0);
}

run();
