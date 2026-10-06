import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface CardPosition {
  name: string;
  left: number;
  top: number;
}

export const DEFAULT_CARD_POSITIONS: CardPosition[] = [
  { name: 'Umbreon VMAX', left: 47.5, top: 36 },
  { name: 'Mewtwo',       left: 68,   top: 41 },
  { name: 'Charizard',    left: 81,   top: 32 },
];

const QUERY_KEY = ['site_config', 'hero_card_positions'];

export function useHeroCardPositions() {
  const queryClient = useQueryClient();

  const { data: positions = DEFAULT_CARD_POSITIONS } = useQuery<CardPosition[]>({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      if (!supabase) return DEFAULT_CARD_POSITIONS;
      const { data, error } = await supabase
        .from('site_config')
        .select('value')
        .eq('key', 'hero_card_positions')
        .single();
      if (error || !data) return DEFAULT_CARD_POSITIONS;
      return data.value as CardPosition[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const { mutateAsync: savePositions, isPending: isSaving } = useMutation({
    mutationFn: async (newPositions: CardPosition[]) => {
      if (!supabase) throw new Error('Supabase unavailable');
      const { error } = await supabase
        .from('site_config')
        .upsert({ key: 'hero_card_positions', value: newPositions, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: (_, newPositions) => {
      queryClient.setQueryData(QUERY_KEY, newPositions);
    },
  });

  return { positions, savePositions, isSaving };
}

// ── Loading screen config ─────────────────────────────────────────────────────

export interface LoadingScreenConfig {
  barX: number;
  barY: number;
  barWidth: number;
  messages: string[];
}

export const DEFAULT_LOADING_CONFIG: LoadingScreenConfig = {
  barX: 50,
  barY: 75,
  barWidth: 60,
  messages: ['Loading…', 'Almost there…', 'Preparing your packs…'],
};

const LOADING_SCREEN_KEY = ['site_config', 'loading_screen'];

export function useLoadingScreenConfig() {
  const queryClient = useQueryClient();

  const { data: config = DEFAULT_LOADING_CONFIG } = useQuery<LoadingScreenConfig>({
    queryKey: LOADING_SCREEN_KEY,
    queryFn: async () => {
      if (!supabase) return DEFAULT_LOADING_CONFIG;
      const { data, error } = await supabase
        .from('site_config')
        .select('value')
        .eq('key', 'loading_screen')
        .single();
      if (error || !data) return DEFAULT_LOADING_CONFIG;
      return { ...DEFAULT_LOADING_CONFIG, ...(data.value as Partial<LoadingScreenConfig>) };
    },
    staleTime: 5 * 60 * 1000,
  });

  const { mutateAsync: saveConfig, isPending: isSaving } = useMutation({
    mutationFn: async (newConfig: LoadingScreenConfig) => {
      if (!supabase) throw new Error('Supabase unavailable');
      const { error } = await supabase
        .from('site_config')
        .upsert({ key: 'loading_screen', value: newConfig, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: (_, newConfig) => {
      queryClient.setQueryData(LOADING_SCREEN_KEY, newConfig);
    },
  });

  return { config, saveConfig, isSaving };
}

// ── Brawl card layout ─────────────────────────────────────────────────────────

export interface BrawlCardLayout {
  /** scale(N) applied to the frame group — pushes border to card edges. Default 1.16 */
  scale: number;
  /** LAYOUT.stats top % — where the stats row starts in the frame. Default 79.5 */
  statsTop: number;
  /** LAYOUT.stats height % — how tall the stats row is. Default 9.3 */
  statsHeight: number;
  /** grid columns for active team grid on lg+ screens. Default 4 */
  teamCols: number;
}

export const DEFAULT_BRAWL_CARD_LAYOUT: BrawlCardLayout = {
  scale: 1.16,
  statsTop: 79.5,
  statsHeight: 9.3,
  teamCols: 4,
};

const BRAWL_LAYOUT_KEY = ['site_config', 'brawl_card_layout'];

export function useBrawlCardLayout() {
  const queryClient = useQueryClient();

  const { data: layout = DEFAULT_BRAWL_CARD_LAYOUT } = useQuery<BrawlCardLayout>({
    queryKey: BRAWL_LAYOUT_KEY,
    queryFn: async () => {
      if (!supabase) return DEFAULT_BRAWL_CARD_LAYOUT;
      const { data, error } = await supabase
        .from('site_config')
        .select('value')
        .eq('key', 'brawl_card_layout')
        .single();
      if (error || !data) return DEFAULT_BRAWL_CARD_LAYOUT;
      return { ...DEFAULT_BRAWL_CARD_LAYOUT, ...(data.value as Partial<BrawlCardLayout>) };
    },
    staleTime: 5 * 60 * 1000,
  });

  const { mutateAsync: saveLayout, isPending: isSaving } = useMutation({
    mutationFn: async (newLayout: BrawlCardLayout) => {
      if (!supabase) throw new Error('Supabase unavailable');
      const { error } = await supabase
        .from('site_config')
        .upsert({ key: 'brawl_card_layout', value: newLayout, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: (_, newLayout) => {
      queryClient.setQueryData(BRAWL_LAYOUT_KEY, newLayout);
    },
  });

  return { layout, saveLayout, isSaving };
}
