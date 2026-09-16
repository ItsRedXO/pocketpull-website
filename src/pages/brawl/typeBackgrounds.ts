// Landscape art per Pokemon type, shown behind the portrait on team/bench
// cards. Only 6 source images exist, so most types intentionally share one --
// this mapping is a direct reflection of that reuse plan, not a 1:1 set.
const FIRE = '/brawl/backgrounds/fire.png';
const WATER = '/brawl/backgrounds/water.png';
const DRAGON_SKY = '/brawl/backgrounds/dragon.png';
const MEADOW = '/brawl/backgrounds/meadow.png';
const VOID = '/brawl/backgrounds/void.png';
const CANYON = '/brawl/backgrounds/canyon.png';

export const TYPE_BACKGROUNDS: Record<string, string> = {
  fire: FIRE,
  water: WATER,
  ice: WATER,
  flying: DRAGON_SKY,
  dragon: DRAGON_SKY,
  grass: MEADOW,
  bug: MEADOW,
  normal: MEADOW,
  fairy: MEADOW,
  electric: MEADOW,
  psychic: VOID,
  dark: VOID,
  poison: VOID,
  ghost: VOID,
  fighting: CANYON,
  ground: CANYON,
  rock: CANYON,
  steel: CANYON,
};

export const typeBackground = (type: string) => TYPE_BACKGROUNDS[type] || MEADOW;
