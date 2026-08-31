import { TcgDexCard } from '../../lib/tcgdex';

export type MappedRarity = 'common' | 'uncommon' | 'rare' | 'ultra' | 'secret' | 'god';

export interface ImportedCard {
  cardName: string;
  rarity: MappedRarity;
  cardImageUrl: string;
  estimatedValue: number;
  tcgdexId: string;
}

export type SortOrder = 'price_asc' | 'price_desc' | 'set_asc' | 'set_desc' | 'rarity' | 'name_asc' | 'name_desc';

export interface CardImageProps {
  url: string;
  alt: string;
  className?: string;
}

export interface PriceFilter {
  min: number;
  max: number | null;
}
